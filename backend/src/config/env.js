import { z } from "zod";
import dotenv from "dotenv";
dotenv.config();

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1),
  REDIS_URL: z.string().min(1),
  CLIENT_ORIGINS: z.string().min(1),
  PUBLIC_APP_URL: z.string().url(),
  INTEGRATION_AUDIENCE: z.string().min(3).default("skilllab-launch"),
  SESSION_SECRET: z.string().min(32),
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().max(24 * 60 * 60).default(7200),
  EXTERNAL_ID_PEPPER: z.string().min(32),
  PARTNER_SECRET_KEK_B64: z.string().min(40),
  RUNNER_BASE_URL: z.string().url(),
  RUNNER_API_TOKEN: z.string().min(16),
  TERMINAL_TICKET_SECRET: z.string().min(32),
  TERMINAL_GATEWAY_URL: z.string().min(1),
  WEBHOOK_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(30).default(12),
  METRICS_TOKEN: z.string().min(24).optional(),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  ADMIN_SESSION_SECRET: z.string().min(32),

ADMIN_SESSION_TTL_SECONDS: z.coerce
  .number()
  .int()
  .positive()
  .max(24 * 60 * 60)
  .default(28800),
});

export const env = schema.parse(process.env);
export const allowedOrigins = env.CLIENT_ORIGINS.split(",").map((v) => v.trim()).filter(Boolean);
