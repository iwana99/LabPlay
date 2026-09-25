import IORedis from "ioredis";
import { env } from "./env.js";

let redis;
let workerRedis;

function buildClient({ worker = false } = {}) {
  const client = new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: worker ? null : 2,
    enableReadyCheck: true,
    lazyConnect: false,
    connectTimeout: 5_000,
    retryStrategy(times) {
      return Math.min(times * 100, 2_000);
    }
  });
  return client;
}

export function getRedis() {
  if (!redis) redis = buildClient();
  return redis;
}

export function getWorkerRedis() {
  if (!workerRedis) workerRedis = buildClient({ worker: true });
  return workerRedis;
}

export async function closeRedis() {
  const clients = [redis, workerRedis].filter(Boolean);
  await Promise.allSettled(clients.map(async (client) => {
    try { await client.quit(); } catch { client.disconnect(); }
  }));
  redis = undefined;
  workerRedis = undefined;
}
