import mongoose from "mongoose";
import { getRedis } from "../config/redis.js";

async function withTimeout(promise, ms) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("healthcheck timeout")), ms);
        timer.unref?.();
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function liveness() {
  return { ok: true, uptimeSeconds: Math.round(process.uptime()) };
}

export async function readiness() {
  const mongo = mongoose.connection.readyState === 1;
  const redis = await withTimeout(getRedis().ping(), 800)
    .then((value) => value === "PONG")
    .catch(() => false);

  return {
    ok: mongo && redis,
    dependencies: { mongo, redis }
  };
}
