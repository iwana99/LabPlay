import crypto from "node:crypto";

export const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

export function randomOpaqueCode(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function hmacExternalId(partnerId, externalUserId, pepper) {
  return crypto
    .createHmac("sha256", pepper)
    .update(`${partnerId}:${externalUserId}`)
    .digest("hex");
}

export function timingSafeEqualText(a, b) {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}
