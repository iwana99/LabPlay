import { decodeJwt, decodeProtectedHeader, importSPKI, jwtVerify } from "jose";
import IntegrationPartner from "../models/IntegrationPartner.js";
import { env } from "../config/env.js";
import { getRedis } from "../config/redis.js";

const ALGORITHMS = ["RS256"];

export async function verifyPartnerLaunchToken(token) {
  // These values are only routing hints until jwtVerify succeeds.
  const unverified = decodeJwt(token);
  const header = decodeProtectedHeader(token);

  if (!unverified.iss || !header.kid || header.alg !== "RS256") {
    throw new Error("Launch token is missing a supported issuer/key/algorithm");
  }

  const partner = await IntegrationPartner.findOne({ issuer: unverified.iss, status: "active" });
  if (!partner) throw new Error("Unknown or disabled integration partner");

  const keyRecord = partner.launchKeys.find((k) => k.kid === header.kid && k.active);
  if (!keyRecord) throw new Error("Unknown partner signing key");

  const publicKey = await importSPKI(keyRecord.publicKeyPem, "RS256");
  const { payload } = await jwtVerify(token, publicKey, {
    algorithms: ALGORITHMS,
    issuer: partner.issuer,
    audience: env.INTEGRATION_AUDIENCE,
    clockTolerance: 5,
    maxTokenAge: "2m"
  });

  if (!payload.sub || !payload.jti || !payload.lab_slug) {
    throw new Error("Launch token is missing sub, jti or lab_slug");
  }

  // Atomic anti-replay. We only write this after cryptographic verification.
  const redis = getRedis();
  const replayKey = `launch:jti:${partner.id}:${payload.jti}`;
  const accepted = await redis.set(replayKey, "1", "EX", 180, "NX");
  if (accepted !== "OK") throw new Error("Launch token was already used");

  return { partner, payload };
}
