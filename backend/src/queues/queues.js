import { Queue } from "bullmq";
import { getRedis } from "../config/redis.js";

const connection = getRedis();
const defaults = {
  attempts: 5,
  removeOnComplete: { age: 3600, count: 5000 },
  removeOnFail: { age: 7 * 24 * 3600, count: 20000 },
  backoff: { type: "exponential", delay: 1000 }
};

export const provisionQueue = new Queue("sandbox-provision", { connection, defaultJobOptions: defaults });
export const gradingQueue = new Queue("submission-grade", { connection, defaultJobOptions: defaults });
export const deliveryQueue = new Queue("result-delivery", { connection, defaultJobOptions: { ...defaults, attempts: 12 } });
export const cleanupQueue = new Queue("sandbox-cleanup", { connection, defaultJobOptions: defaults });
