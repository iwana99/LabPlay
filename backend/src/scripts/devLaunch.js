import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { importPKCS8, SignJWT } from "jose";

import { env } from "../config/env.js";



async function devLaunch() {


  
  const labSlug =
    process.argv[2] ||
    "javascript-first-lab";

  // 1. Učitavamo privatni ključ TEST mentora
  const privateKeyPem = fs.readFileSync(
    path.resolve(".dev-keys/mentor-private.pem"),
    "utf8"
  );



  // 2. Pretvaramo PEM tekst u ključ koji jose može da koristi
  const privateKey = await importPKCS8(
    privateKeyPem,
    "RS256"
  );

  // 3. Pravimo JWT koji glumi launch zahtev mentorove aplikacije
  const token = await new SignJWT({
  lab_slug: labSlug,
  assignment_id: "dev-assignment-001",
})
    .setProtectedHeader({
      alg: "RS256",
      kid: "dev-key-1",
      typ: "JWT",
    })
    .setIssuer("http://localhost:9000/mentor")
    .setAudience(env.INTEGRATION_AUDIENCE)
    .setSubject("dev-student-001")
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime("90s")
    .sign(privateKey);

  console.log("Development launch JWT created.");

  console.log(
  `Launching lab: ${labSlug}`
);

  // 4. Mentor šalje JWT LabPlay backendu
  const response = await fetch(
    `http://localhost:${env.PORT}/api/v1/integrations/launch`,
    {
      method: "POST",

      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `Launch failed (${response.status}): ${text}`
    );
  }

  const result = JSON.parse(text);

  console.log("");
  console.log("==============================");
  console.log("LAUNCH CREATED");
  console.log("==============================");
  console.log("");
  console.log("Attempt ID:");
  console.log(result.attemptId);
  console.log("");
  console.log("OPEN THIS URL:");
  console.log(result.launchUrl);
  console.log("");
  console.log("==============================");
}

devLaunch().catch((error) => {
  console.error("");
  console.error("DEV LAUNCH FAILED");
  console.error(error);
  process.exit(1);
});