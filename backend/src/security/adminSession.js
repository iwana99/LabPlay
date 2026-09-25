import {
  SignJWT,
  jwtVerify,
} from "jose";

import { env } from "../config/env.js";

export const ADMIN_COOKIE_NAME =
  "admin_session";

const secret =
  new TextEncoder().encode(
    env.ADMIN_SESSION_SECRET
  );

export async function createAdminSession(
  admin
) {
  return new SignJWT({
    role: admin.role,
  })
    .setProtectedHeader({
      alg: "HS256",
      typ: "JWT",
    })
    .setSubject(admin.id)
    .setIssuer("labplay-api")
    .setAudience("labplay-admin")
    .setIssuedAt()
    .setExpirationTime(
      `${env.ADMIN_SESSION_TTL_SECONDS}s`
    )
    .sign(secret);
}

export async function verifyAdminSession(
  token
) {
  const { payload } =
    await jwtVerify(
      token,
      secret,
      {
        algorithms: ["HS256"],
        issuer: "labplay-api",
        audience: "labplay-admin",
      }
    );

  return payload;
}

export function adminCookieOptions() {
  return {
    httpOnly: true,

    secure:
      env.NODE_ENV === "production",

    sameSite: "lax",

    path: "/api/v1/admin",

    maxAge:
      env.ADMIN_SESSION_TTL_SECONDS *
      1000,
  };
}