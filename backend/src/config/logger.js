import pino from "pino";
import { env } from "./env.js";

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: "skilllab-api", environment: env.NODE_ENV },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "headers.authorization",
      "headers.cookie",
      "body.password",
      "body.code",
      "token",
      "launchToken",
      "sessionToken",
      "webhookSecret",
      "privateKey",
      "*.privateKey",
      "*.secret"
    ],
    censor: "[REDACTED]"
  }
});
