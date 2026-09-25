import { Worker } from "bullmq";
import { getWorkerRedis } from "../config/redis.js";

import Submission from "../models/Submission.js";
import Attempt from "../models/Attempt.js";
import Task from "../models/Task.js";
import TaskAttempt from "../models/TaskAttempt.js";

import { RunnerClient } from "../runners/runnerClient.js";
import { logger } from "../config/logger.js";


export function startGradingWorker() {
  return new Worker(
    "submission-grade",

    async (job) => {
      const submission =
        await Submission.findById(
          job.data.submissionId
        );

      if (
        !submission ||
        submission.status !== "queued"
      ) {
        return;
      }


      /* =========================
         SUBMISSION STARTUJE
      ========================= */

      submission.status =
        "running";

      await submission.save();


      /* =========================
         UČITAJ ATTEMPT I TASK
      ========================= */

      const [
        attempt,
        task,
      ] =
        await Promise.all([
          Attempt.findById(
            submission.attemptId
          ),

          Task.findById(
            submission.taskId
          ).select("+checker"),
        ]);


      if (!attempt || !task) {
        throw new Error(
          "Attempt or task disappeared"
        );
      }


      console.log(
        "[CHECK DEBUG]",
        {
          attemptId:
            String(attempt._id),

          sandboxId:
            attempt.sandboxId,

          taskId:
            String(task._id),

          taskOrder:
            task.order,

          mode:
            submission.mode,

          checker:
            task.checker,
        }
      );


      /* =========================
         RUNNER PROVERA
      ========================= */

      const result =
        await RunnerClient.grade({
          sandboxId:
            attempt.sandboxId,

          taskType:
            task.taskType,

          mode:
            submission.mode,

          files:
            submission.files,

          checker:
            submission.mode ===
            "check"
              ? task.checker
              : {
                  type:
                    "visible_run",
                },

          resourceLimits:
            task.resourceLimits,
        });


      /* =========================
         PRIPREMI SUBMISSION RESULT
      ========================= */

      submission.status =
        result.systemError
          ? "system_error"
          : result.passed
            ? "passed"
            : "failed";

      submission.output =
        String(
          result.output || ""
        ).slice(
          0,
          100_000
        );

      submission.feedback =
        Array.isArray(
          result.feedback
        )
          ? result.feedback.slice(
              0,
              20
            )
          : [];

      submission.runtimeMs =
        result.runtimeMs;

      submission.completedAt =
        new Date();


      /* =========================
         AKO JE CHECK PROŠAO
         PREĐI NA SLEDEĆI TASK
      ========================= */

      if (
        submission.mode ===
          "check" &&
        result.passed
      ) {
        const state =
          await TaskAttempt.findOne({
            attemptId:
              attempt.id,

            taskId:
              task.id,
          });


        if (
          state?.status ===
          "active"
        ) {
          state.status =
            "passed";

          state.tries += 1;

          state.passedAt =
            new Date();

          await state.save();


          /* =========================
             PRONAĐI SLEDEĆI TASK
          ========================= */

          const next =
            await TaskAttempt.findOne({
              attemptId:
                attempt.id,

              order:
                state.order + 1,
            });


          if (next) {
            next.status =
              "active";

            await next.save();

            attempt.currentTaskOrder =
              next.order;

          } else {
            /*
              Nema više zadataka.
              Lab je završen.
            */

            attempt.status =
              "completing";
          }


          await attempt.save();
        }

      } else if (
        submission.mode ===
        "check"
      ) {
        /*
          Check nije prošao.

          Samo povećavamo broj pokušaja.
        */

        await TaskAttempt.updateOne(
          {
            attemptId:
              attempt.id,

            taskId:
              task.id,
          },
          {
            $inc: {
              tries: 1,
            },
          }
        );
      }


      /* =========================
         VAŽNO

         Submission postaje PASSED
         tek NAKON što je backend već
         prebacio Attempt na sledeći task.
      ========================= */

      await submission.save();
    },


    {
      connection:
        getWorkerRedis(),

      concurrency:
        20,
    }
  )


  .on(
    "failed",

    async (job, err) => {
      logger.error(
        {
          jobId:
            job?.id,

          err,
        },

        "grading job failed"
      );


      if (
        job?.data
          ?.submissionId
      ) {
        await Submission.updateOne(
          {
            _id:
              job.data
                .submissionId,
          },

          {
            $set: {
              status:
                "system_error",

              feedback: [
                "Privremena greška u izvršnom okruženju. Pokušaj ponovo.",
              ],

              completedAt:
                new Date(),
            },
          }
        );
      }
    }
  );
}