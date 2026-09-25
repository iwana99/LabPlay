import crypto from "node:crypto";
import { env } from "../config/env.js";

function key() {
  const decoded = Buffer.from(env.PARTNER_SECRET_KEK_B64, "base64");
  if (decoded.length !== 32) throw new Error("PARTNER_SECRET_KEK_B64 must decode to 32 bytes");
  return decoded;
}

export function encryptSecret(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((b) => b.toString("base64url")).join(".");
}

export function decryptSecret(box) {
  const [ivB64, tagB64, ctB64] = box.split(".");
  if (!ivB64 || !tagB64 || !ctB64) throw new Error("Invalid encrypted secret");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64url")),
    decipher.final()
  ]).toString("utf8");
}
