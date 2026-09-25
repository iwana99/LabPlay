import crypto from "node:crypto";

import Attempt from "../models/Attempt.js";
import TaskAttempt from "../models/TaskAttempt.js";
import WebhookDelivery from "../models/WebhookDelivery.js";
import IntegrationPartner from "../models/IntegrationPartner.js";

import {
  deliveryQueue,
  cleanupQueue,
} from "../queues/queues.js";


export async function finishAttempt(
  attemptId
) {
  const attempt =
    await Attempt.findById(
      attemptId
    );


  if (!attempt) {
    throw Object.assign(
      new Error(
        "Attempt not found"
      ),
      {
        statusCode: 404,
      }
    );
  }


  /* =========================
     1. AKO JOŠ NIJE COMPLETED,
        PROVERI ZADATKE
  ========================= */

  if (
    attempt.status !==
    "completed"
  ) {
    const remaining =
      await TaskAttempt
        .countDocuments({
          attemptId,

          status: {
            $ne: "passed",
          },
        });


    if (remaining > 0) {
      throw Object.assign(
        new Error(
          "All tasks must pass before finishing"
        ),
        {
          statusCode: 409,
        }
      );
    }


    attempt.status =
      "completed";

    attempt.finishedAt =
      new Date();

    attempt.score = 100;

    await attempt.save();
  }


  /* =========================
     2. WEBHOOK DELIVERY

     Ako je prethodni Finish pukao
     nakon kreiranja delivery zapisa,
     NE pravimo novi.
  ========================= */

  let delivery =
    await WebhookDelivery.findOne({
      attemptId:
        attempt._id,
    }).sort({
      createdAt: -1,
    });


  if (!delivery) {
    const eventId =
      crypto.randomUUID();


    delivery =
      await WebhookDelivery.create({
        eventId,

        attemptId:
          attempt._id,

        partnerId:
          attempt.partnerId,
      });
  }


  /*
    BullMQ custom jobId
    NE SME da sadrži ":".

    Zato:
    delivery-ABC ✅
    delivery:ABC ❌
  */

  if (
    delivery.status ===
    "pending"
  ) {
    await deliveryQueue.add(
      "deliver-result",

      {
        deliveryId:
          delivery.id,
      },

      {
        jobId:
          `delivery-${delivery.id}`,
      }
    );
  }


  /* =========================
     3. SANDBOX CLEANUP
  ========================= */

  if (
    attempt.sandboxStatus !==
    "destroyed"
  ) {
    await cleanupQueue.add(
      "destroy-sandbox",

      {
        attemptId:
          attempt.id,
      },

      {
        delay:
          30_000,

        jobId:
          `cleanup-${attempt.id}`,
      }
    );
  }


  /* =========================
     4. RETURN URL
  ========================= */

  const partner =
    await IntegrationPartner
      .findById(
        attempt.partnerId
      )
      .lean();


  if (!partner) {
    throw Object.assign(
      new Error(
        "Integration partner not found"
      ),
      {
        statusCode: 404,
      }
    );
  }


  return {
    returnUrl:
      partner.returnUrl,
  };
}