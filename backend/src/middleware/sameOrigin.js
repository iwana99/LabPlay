import { allowedOrigins } from "../config/env.js";

export function requireAllowedOrigin(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();

  // Server-to-server partner launch uses a signed Bearer JWT and intentionally has no browser Origin.
  if (req.originalUrl === "/api/v1/integrations/launch") return next();

  const origin = req.get("origin");
  if (!origin || !allowedOrigins.includes(origin)) {
    return res.status(403).json({ message: "Origin is not allowed" });
  }
  next();
}
