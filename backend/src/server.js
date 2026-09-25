import { app } from "./app.js";
import { env } from "./config/env.js";
import { connectDB, disconnectDB } from "./config/db.js";
import { closeRedis, getRedis } from "./config/redis.js";
import { logger } from "./config/logger.js";

let shuttingDown = false;

async function start() {
  await connectDB();
  await getRedis().ping();

  const server = app.listen(env.PORT, () => logger.info({ port: env.PORT }, "api listening"));
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "graceful shutdown started");

    const forceExit = setTimeout(() => {
      logger.error("graceful shutdown timed out");
      process.exit(1);
    }, 15_000);
    forceExit.unref();

    try {
      await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
      server.closeIdleConnections?.();
      await Promise.allSettled([disconnectDB(), closeRedis()]);
      clearTimeout(forceExit);
      logger.info("graceful shutdown finished");
      process.exit(0);
    } catch (err) {
      logger.error({ err }, "graceful shutdown failed");
      process.exit(1);
    }
  };

  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
  process.on("unhandledRejection", (err) => logger.error({ err }, "unhandled rejection"));
  process.on("uncaughtException", (err) => {
    logger.fatal({ err }, "uncaught exception");
    shutdown("uncaughtException");
  });
}

start().catch((err) => {
  logger.fatal({ err }, "api failed to start");
  process.exit(1);
});
