import { env } from "../config/env.js";
import { beginPartnerLaunch, exchangeLaunchCode } from "../services/integrationService.js";

export async function launch(req, res) {
  const auth = req.get("authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) return res.status(401).json({ message: "Bearer launch token is required" });
  const result = await beginPartnerLaunch(match[1]);
  res.status(201).json(result);
}

export async function exchange(req, res) {
  const { code } = req.body || {};
  if (!code || typeof code !== "string") return res.status(400).json({ message: "Launch code is required" });
  const result = await exchangeLaunchCode(code);
  res.cookie("lab_session", result.sessionToken, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: env.SESSION_TTL_SECONDS * 1000
  });
  res.status(204).end();
}
