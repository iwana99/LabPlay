import { getAttemptView, revealHint } from "../services/labService.js";
import { finishAttempt } from "../services/completionService.js";
import { SignJWT } from "jose";
import { env } from "../config/env.js";
import Attempt from "../models/Attempt.js";

export async function current(req, res) {
  res.json(await getAttemptView(req.labSession.sub));
}

export async function hint(req, res) {
  const result = await revealHint({
    attemptId: req.labSession.sub,
    taskId: req.params.taskId,
    level: req.body?.level || 1
  });
  res.json(result);
}

export async function finish(req, res) {
  res.json(await finishAttempt(req.labSession.sub));
}

export async function terminalTicket(req, res) {
  const attempt = await Attempt.findById(req.labSession.sub).lean();

  console.log("[TERMINAL DEBUG]", {
  attemptId: String(attempt?._id),
  sandboxId: attempt?.sandboxId,
});

  if (!attempt || attempt.status !== "active" || attempt.sandboxStatus !== "ready") {
    return res.status(409).json({ message: "Sandbox is not ready" });
  }
  const secret = new TextEncoder().encode(env.TERMINAL_TICKET_SECRET);
  const ticket = await new SignJWT({ sandboxId: attempt.sandboxId, kind: "terminal" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(String(attempt._id))
    .setIssuer("skilllab")
    .setAudience("skilllab-terminal-gateway")
    .setIssuedAt()
    .setExpirationTime("30s")
    .sign(secret);
  res.json({ ticket, gatewayUrl: env.TERMINAL_GATEWAY_URL });
}
