import { Worker } from "bullmq";
import { getWorkerRedis } from "../config/redis.js";
import Attempt from "../models/Attempt.js";
import Lab from "../models/Lab.js";
import { RunnerClient } from "../runners/runnerClient.js";
import { logger } from "../config/logger.js";

export function startProvisionWorker() {
  return new Worker("sandbox-provision", async (job) => {
    const attempt = await Attempt.findById(job.data.attemptId);
    if (!attempt || attempt.status !== "provisioning") return;
    const lab = await Lab.findById(attempt.labId).lean();
    const sandbox = await RunnerClient.provision({
      attemptId: attempt.id,
      profile: lab.sandboxProfile,
      expiresAt: attempt.expiresAt.toISOString()
    });
    attempt.sandboxId = sandbox.id;
    attempt.sandboxStatus = "ready";
    attempt.status = "active";
    await attempt.save();
  }, { connection: getWorkerRedis(), concurrency: 10 }).on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "provision job failed");
  });
}
