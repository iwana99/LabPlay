import { env } from "../config/env.js";
import { getRedis } from "../config/redis.js";
import Lab from "../models/Lab.js";
import Task from "../models/Task.js";
import Attempt from "../models/Attempt.js";
import TaskAttempt from "../models/TaskAttempt.js";
import {
  provisionQueue,
  cleanupQueue,
} from "../queues/queues.js";
import { verifyPartnerLaunchToken } from "../security/launchToken.js";
import { createLabSession } from "../security/sessionToken.js";
import { hmacExternalId, randomOpaqueCode, sha256 } from "../utils/crypto.js";

export async function beginPartnerLaunch(token) {
  const { partner, payload } = await verifyPartnerLaunchToken(token);
  const lab = await Lab.findOne({ slug: payload.lab_slug, status: "published" }).sort({ version: -1 });
  if (!lab) throw Object.assign(new Error("Requested lab is not published"), { statusCode: 404 });

  const externalUserIdHash = hmacExternalId(partner.id, payload.sub, env.EXTERNAL_ID_PEPPER);
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

  const attempt = await Attempt.create({
    partnerId: partner.id,
    labId: lab.id,
    externalUserIdHash,
    externalAssignmentId: String(payload.assignment_id || ""),
    status: "provisioning",
    currentTaskOrder: 1,
    expiresAt
  });

  const expirationDelay =
  Math.max(
    0,
    expiresAt.getTime() -
      Date.now()
  );


await cleanupQueue.add(
  "expire-sandbox",

  {
    attemptId:
      attempt.id,
  },

  {
    delay:
      expirationDelay,

    jobId:
      `expire-${attempt.id}`,
  }
);
  const tasks = await Task.find({ labId: lab.id }).sort({ order: 1 }).select("_id order");
  if (!tasks.length) throw Object.assign(new Error("Lab has no tasks"), { statusCode: 409 });

  await TaskAttempt.insertMany(tasks.map((task, index) => ({
    attemptId: attempt.id,
    taskId: task.id,
    order: task.order,
    status: index === 0 ? "active" : "locked"
  })));

 await provisionQueue.add(
  "provision-attempt",
  { attemptId: attempt.id },
  {
    jobId: `attempt-${attempt.id}`,
  }
);
  const code = randomOpaqueCode();  //Random code generated for launch URL, just code for finding the attempt in redis, not a JWT or anything like that
  const redis = getRedis();
  await redis.set(
    `launch:code:${sha256(code)}`,
    JSON.stringify({ attemptId: attempt.id, partnerId: partner.id }),
    "EX",
    90,
    "NX"
  );

  return { launchUrl: `${env.PUBLIC_APP_URL}/launch?code=${encodeURIComponent(code)}`,  //Going on our launch Page on frontend, where we wait for the attempt to be provisioned, then redirect to the first task, we wait for sessionToken to be created and sent back to the frontend, then we redirect to the first task with the sessionToken in the URL
  //encodeURIComponent(code)  make sure the code is safe to put in a URL, in case it has any special characters and spaces hello world => hello%20world
           attemptId: attempt.id };
}

export async function exchangeLaunchCode(code) {
  const redis = getRedis();
  const key = `launch:code:${sha256(code)}`;
  const payloadText = await redis.call("GETDEL", key);
  if (!payloadText) throw Object.assign(new Error("Launch code is invalid, expired or already used"), { statusCode: 401 });
  const payload = JSON.parse(payloadText);
  const sessionToken = await createLabSession(payload);
  return { ...payload, sessionToken };
}
