import Attempt from "../models/Attempt.js";
import Task from "../models/Task.js";
import TaskAttempt from "../models/TaskAttempt.js";
import Submission from "../models/Submission.js";
import { gradingQueue } from "../queues/queues.js";

const MAX_FILES = 40;
const MAX_FILE_BYTES = 200_000;

function validateFiles(files = []) {
  if (!Array.isArray(files) || files.length > MAX_FILES) {
    throw Object.assign(new Error("Too many submitted files"), { statusCode: 400 });
  }
  for (const file of files) {
    if (!file?.path || typeof file.content !== "string") throw Object.assign(new Error("Invalid file payload"), { statusCode: 400 });
    if (Buffer.byteLength(file.content, "utf8") > MAX_FILE_BYTES) throw Object.assign(new Error(`File ${file.path} is too large`), { statusCode: 413 });
  }
}

export async function createSubmission({ attemptId, taskId, mode, files }) {
  validateFiles(files);
  if (!["run", "check"].includes(mode)) throw Object.assign(new Error("Invalid submission mode"), { statusCode: 400 });

  const attempt = await Attempt.findById(attemptId);
  if (!attempt || attempt.status !== "active") throw Object.assign(new Error("Attempt is not active"), { statusCode: 409 });

  const state = await TaskAttempt.findOne({ attemptId, taskId });
  if (!state || state.status !== "active" || state.order !== attempt.currentTaskOrder) {
    throw Object.assign(new Error("Only the current task can be submitted"), { statusCode: 409 });
  }

  const taskExists = await Task.exists({ _id: taskId, labId: attempt.labId });
  if (!taskExists) throw Object.assign(new Error("Task does not belong to this lab"), { statusCode: 400 });

  const submission = await Submission.create({ attemptId, taskId, mode, files, status: "queued" });
  await gradingQueue.add("grade-submission", { submissionId: submission.id }, { jobId: `submission-${submission.id}`  });
  return submission;
}

export async function getSubmissionForAttempt({ attemptId, submissionId }) {
  const submission = await Submission.findOne({ _id: submissionId, attemptId }).lean();
  if (!submission) throw Object.assign(new Error("Submission not found"), { statusCode: 404 });
  return submission;
}
