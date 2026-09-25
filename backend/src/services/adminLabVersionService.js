import mongoose from "mongoose";

import Lab from "../models/Lab.js";
import Task from "../models/Task.js";


function createError(
  message,
  statusCode
) {
  const error =
    new Error(message);

  error.statusCode =
    statusCode;

  return error;
}


export async function createDraftVersion(
  sourceLabId
) {
  const session =
    await mongoose.startSession();

  let createdLab = null;

  try {
    await session.withTransaction(
      async () => {

        /* =========================
           1. PRONAĐI STARI LAB
        ========================= */

        const sourceLab =
          await Lab.findById(
            sourceLabId
          ).session(session);


        if (!sourceLab) {
          throw createError(
            "Lab nije pronađen.",
            404
          );
        }


        /* =========================
           2. NE KOPIRAMO DRAFT
        ========================= */

        if (
          sourceLab.status ===
          "draft"
        ) {
          throw createError(
            "Ova verzija je već draft i može direktno da se menja.",
            409
          );
        }


        /* =========================
           3. DA LI VEĆ POSTOJI DRAFT?
        ========================= */

        const existingDraft =
          await Lab.findOne({
            slug:
              sourceLab.slug,

            status:
              "draft",
          }).session(session);


        if (existingDraft) {
          throw createError(
            `Već postoji draft verzija v${existingDraft.version}.`,
            409
          );
        }


        /* =========================
           4. NAĐI POSLEDNJU VERZIJU
        ========================= */

        const latestLab =
          await Lab.findOne({
            slug:
              sourceLab.slug,
          })
            .sort({
              version: -1,
            })
            .session(session);


        const nextVersion =
          (latestLab?.version || 0) +
          1;


        /* =========================
           5. NAPRAVI NOVI LAB
        ========================= */

        const createdLabs =
          await Lab.create(
            [
              {
                slug:
                  sourceLab.slug,

                title:
                  sourceLab.title,

                track:
                  sourceLab.track,

                version:
                  nextVersion,

                sandboxProfile:
                  sourceLab
                    .sandboxProfile,

                status:
                  "draft",
              },
            ],
            {
              session,
            }
          );


        createdLab =
          createdLabs[0];


        /* =========================
           6. UČITAJ STARE TASKOVE

           +checker je VAŽNO,
           jer je checker u modelu
           select: false.
        ========================= */

        const sourceTasks =
          await Task.find({
            labId:
              sourceLab._id,
          })
            .sort({
              order: 1,
            })
            .select("+checker")
            .session(session)
            .lean();


        /* =========================
           7. KOPIRAJ TASKOVE
        ========================= */

        if (
          sourceTasks.length > 0
        ) {
          const copiedTasks =
            sourceTasks.map(
              (task) => ({
                labId:
                  createdLab._id,

                order:
                  task.order,

                title:
                  task.title,

                instructions:
                  task.instructions,

                taskType:
                  task.taskType,

                starterFiles:
                  task.starterFiles ||
                  [],

                language:
                  task.language,

                hints:
                  task.hints ||
                  [],

                checker:
                  task.checker,

                resourceLimits:
                  task.resourceLimits,
              })
            );


          await Task.insertMany(
            copiedTasks,
            {
              session,
            }
          );
        }
      }
    );


    return createdLab;

  } catch (error) {

    /*
      Ako dve admin akcije u isto vreme
      pokušaju da naprave istu verziju,
      unique index slug + version nas štiti.
    */

    if (
      error?.code === 11000
    ) {
      throw createError(
        "Nova verzija je već kreirana. Osveži stranicu.",
        409
      );
    }

    throw error;

  } finally {
    await session.endSession();
  }
}