import crypto from "node:crypto";
import { timingSafeEqualText } from "../utils/crypto.js";

export function signWebhook({ secret, timestamp, rawBody }) {
  return crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

export function verifyWebhook({ secret, timestamp, rawBody, signature, now = Date.now() }) {
  const timestampMs = Number(timestamp) * 1000;
  if (!Number.isFinite(timestampMs) || Math.abs(now - timestampMs) > 5 * 60 * 1000) return false;
  const expected = signWebhook({ secret, timestamp, rawBody });
  return timingSafeEqualText(expected, signature);
}
