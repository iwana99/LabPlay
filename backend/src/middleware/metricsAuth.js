import crypto from "node:crypto";
import { env } from "../config/env.js";

function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ""));
  const bb = Buffer.from(String(b || ""));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

export function requireMetricsToken(req, res, next) {
  if (env.NODE_ENV !== "production" && !env.METRICS_TOKEN) return next();
  const auth = req.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!env.METRICS_TOKEN || !safeEqual(token, env.METRICS_TOKEN)) {
    return res.status(401).json({ message: "Metrics authentication required" });
  }
  next();
}
