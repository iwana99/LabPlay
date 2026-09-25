import { connectDB } from "../config/db.js";
import { getWorkerRedis } from "../config/redis.js";
import { logger } from "../config/logger.js";
import { startProvisionWorker } from "./provision.worker.js";
import { startGradingWorker } from "./grading.worker.js";
import { startDeliveryWorker } from "./delivery.worker.js";
import { startCleanupWorker } from "./cleanup.worker.js";

async function start() {
  await connectDB();
  await getWorkerRedis().ping();
  const workers = [startProvisionWorker(), startGradingWorker(), startDeliveryWorker(), startCleanupWorker()];
  logger.info({ workers: workers.length }, "workers started");

  const close = async () => {
    await Promise.allSettled(workers.map((w) => w.close()));
    process.exit(0);
  };
  process.on("SIGTERM", close);
  process.on("SIGINT", close);
}

start().catch((err) => {
  logger.fatal({ err }, "workers failed to start");
  process.exit(1);
});
