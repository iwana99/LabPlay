import {
  Worker,
} from "bullmq";

import {
  getWorkerRedis,
} from "../config/redis.js";

import Attempt from "../models/Attempt.js";

import {
  RunnerClient,
} from "../runners/runnerClient.js";

import {
  logger,
} from "../config/logger.js";


export function startCleanupWorker() {
  return new Worker(
    "sandbox-cleanup",

    async (job) => {
      const attemptId =
        String(
          job.data.attemptId
        );


      console.log(
        "[CLEANUP START]",
        {
          attemptId,
          jobName: job.name,
        }
      );


      const attempt =
        await Attempt.findById(
          attemptId
        );


      if (!attempt) {
        console.log(
          "[CLEANUP SKIP]",
          {
            attemptId,
            reason:
              "attempt-not-found",
          }
        );

        return;
      }


      /* =========================
         EXPIRATION
      ========================= */

      if (
        job.name ===
        "expire-sandbox"
      ) {
        /*
          Ako učenik još radi lab,
          vreme mu je isteklo.
        */

        if (
          [
            "provisioning",
            "active",
            "completing",
          ].includes(
            attempt.status
          )
        ) {
          attempt.status =
            "expired";

          attempt.finishedAt =
            attempt.finishedAt ||
            new Date();

          await attempt.save();


          console.log(
            "[ATTEMPT EXPIRED]",
            {
              attemptId,
            }
          );
        }
      }


      /* =========================
         SANDBOX JE VEĆ OBRISAN
      ========================= */

      if (
        attempt.sandboxStatus ===
        "destroyed"
      ) {
        console.log(
          "[CLEANUP SKIP]",
          {
            attemptId,
            reason:
              "already-destroyed",
          }
        );

        return;
      }


      /* =========================
         OBRIŠI CONTAINER + VOLUME
      ========================= */

      await RunnerClient.destroy({
        attemptId,

        sandboxId:
          attempt.sandboxId ||
          "",
      });


      attempt.sandboxStatus =
        "destroyed";

      await attempt.save();


      console.log(
        "[CLEANUP DONE]",
        {
          attemptId,

          status:
            attempt.status,

          sandboxStatus:
            attempt.sandboxStatus,
        }
      );
    },

    {
      connection:
        getWorkerRedis(),

      concurrency: 10,
    }
  ).on(
    "failed",

    (job, error) => {
      logger.error(
        {
          jobId:
            job?.id,

          attemptId:
            job?.data
              ?.attemptId,

          jobName:
            job?.name,

          err:
            error,
        },

        "sandbox cleanup failed"
      );
    }
  );
}