import { SignJWT, jwtVerify } from "jose";
import { env } from "../config/env.js";

const key = new TextEncoder().encode(env.SESSION_SECRET);

export async function createLabSession({ attemptId, partnerId }) {
  return new SignJWT({ partnerId: String(partnerId), kind: "lab_session" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(String(attemptId))
    .setAudience("skilllab-browser")
    .setIssuer("skilllab")
    .setIssuedAt()
    .setExpirationTime(`${env.SESSION_TTL_SECONDS}s`)
    .sign(key);
}

export async function verifyLabSession(token) {
  const { payload, protectedHeader } = await jwtVerify(token, key, {
    algorithms: ["HS256"],
    audience: "skilllab-browser",
    issuer: "skilllab"
  });
  if (protectedHeader.alg !== "HS256" || payload.kind !== "lab_session") {
    throw new Error("Invalid lab session token");
  }
  return payload;
}
