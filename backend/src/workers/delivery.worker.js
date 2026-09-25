import { Worker } from "bullmq";
import { getWorkerRedis } from "../config/redis.js";
import { env } from "../config/env.js";
import WebhookDelivery from "../models/WebhookDelivery.js";
import IntegrationPartner from "../models/IntegrationPartner.js";
import Attempt from "../models/Attempt.js";
import { decryptSecret } from "../security/secretBox.js";
import { signWebhook } from "../security/webhookSignature.js";
import { logger } from "../config/logger.js";

export function startDeliveryWorker() {
  return new Worker("result-delivery", async (job) => {
    const delivery = await WebhookDelivery.findById(job.data.deliveryId);
    if (!delivery || delivery.status !== "pending") return;
    const [attempt, partner] = await Promise.all([
      Attempt.findById(delivery.attemptId).lean(),
      IntegrationPartner.findById(delivery.partnerId).lean()
    ]);
    if (!attempt || !partner) throw new Error("Delivery dependencies missing");

    const payload = JSON.stringify({
      event: "lab.attempt.completed",
      eventId: delivery.eventId,
      attemptId: String(attempt._id),
      assignmentId: attempt.externalAssignmentId,
      learnerRef: attempt.externalUserIdHash,
      status: attempt.status,
      score: attempt.score,
      finishedAt: attempt.finishedAt
    });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const secret = decryptSecret(partner.webhookSecretEnc);
    const signature = signWebhook({ secret, timestamp, rawBody: payload });

    const response = await fetch(partner.callbackUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-skilllab-event-id": delivery.eventId,
        "x-skilllab-timestamp": timestamp,
        "x-skilllab-signature": `v1=${signature}`
      },
      body: payload,
      signal: AbortSignal.timeout(10_000)
    });
    delivery.tries += 1;
    if (!response.ok) throw new Error(`Partner callback returned ${response.status}`);
    delivery.status = "delivered";
    await delivery.save();
  }, { connection: getWorkerRedis(), concurrency: 10 }).on("failed", async (job, err) => {
    logger.error({ jobId: job?.id, err }, "result delivery failed");
    if (!job?.data?.deliveryId) return;
    const delivery = await WebhookDelivery.findById(job.data.deliveryId);
    if (!delivery) return;
    delivery.tries += 1;
    delivery.lastError = String(err.message || err).slice(0, 2000);
    if (delivery.tries >= env.WEBHOOK_MAX_ATTEMPTS) delivery.status = "dead";
    await delivery.save();
  });
}
