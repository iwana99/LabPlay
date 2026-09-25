import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";

import { connectDB } from "../config/db.js";
import IntegrationPartner from "../models/IntegrationPartner.js";
import Lab from "../models/Lab.js";
import Task from "../models/Task.js";
import { encryptSecret } from "../security/secretBox.js";

async function seed() {
  await connectDB();

  console.log("MongoDB connected");

  // --------------------------------------
  // 1. RSA key pair za našeg TEST mentora
  // --------------------------------------

  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,

    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },

    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
    },
  });

  const keysDirectory = path.resolve(".dev-keys");

  fs.mkdirSync(keysDirectory, {
    recursive: true,
  });

  fs.writeFileSync(
    path.join(keysDirectory, "mentor-private.pem"),
    privateKey
  );

  fs.writeFileSync(
    path.join(keysDirectory, "mentor-public.pem"),
    publicKey
  );

  // --------------------------------------
  // 2. Development IntegrationPartner
  // --------------------------------------

  const webhookSecret = crypto.randomBytes(32).toString("hex");

  const partner = await IntegrationPartner.findOneAndUpdate(
    {
      issuer: "http://localhost:9000/mentor",
    },
    {
      name: "Local Development Mentor",

      issuer: "http://localhost:9000/mentor",

      launchKeys: [
        {
          kid: "dev-key-1",
          publicKeyPem: publicKey,
          active: true,
        },
      ],

      callbackUrl: "http://localhost:9000/api/lab-result",

      returnUrl: "http://localhost:5173/dev-finished",

      webhookSecretEnc: encryptSecret(webhookSecret),

      status: "active",
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );

  console.log("IntegrationPartner created:", partner.name);

  // --------------------------------------
  // 3. Prvi Lab
  // --------------------------------------

  const lab = await Lab.findOneAndUpdate(
    {
      slug: "javascript-first-lab",
      version: 1,
    },
    {
      title: "JavaScript - Moj prvi LabPlay lab",

      track: "algorithms",

      version: 1,

      sandboxProfile: "node-basic",

      status: "published",

      publishedAt: new Date(),
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );

  console.log("Lab created:", lab.title);

  // --------------------------------------
  // 4. Prvi Task
  // --------------------------------------

  await Task.findOneAndUpdate(
    {
      labId: lab._id,
      order: 1,
    },
    {
      labId: lab._id,

      order: 1,

      title: "Prvi JavaScript zadatak",

      instructions:
        'Napiši JavaScript program koji ispisuje "Hello LabPlay".',

      taskType: "code",

      language: "javascript",

      starterFiles: [
        {
          path: "index.js",
          content: `console.log("Hello LabPlay");`,
          readOnly: false,
        },
      ],

      hints: [
        "Koristi console.log().",
        'Tekst koji treba da ispišeš je "Hello LabPlay".',
      ],

      checker: {
        type: "stdout_equals",
        expected: "Hello LabPlay",
      },

      resourceLimits: {
        cpuMillis: 1000,
        memoryMb: 256,
        timeoutMs: 10000,
        network: false,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );

  console.log("Task 1 created");

  console.log("");
  console.log("====================================");
  console.log("DEV SEED COMPLETED");
  console.log("====================================");
  console.log("Partner:", partner.name);
  console.log("Issuer:", partner.issuer);
  console.log("kid: dev-key-1");
  console.log("Lab slug:", lab.slug);
  console.log("");
  console.log("Private key:");
  console.log(".dev-keys/mentor-private.pem");
  console.log("");
  console.log("Public key:");
  console.log(".dev-keys/mentor-public.pem");
  console.log("====================================");

  await mongoose.disconnect();
}

seed()
  .then(() => {
    console.log("Seed finished.");
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("Seed failed:");
    console.error(error);

    await mongoose.disconnect().catch(() => {});

    process.exit(1);
  });