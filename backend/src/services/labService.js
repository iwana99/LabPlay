import Attempt from "../models/Attempt.js";
import Lab from "../models/Lab.js";
import Task from "../models/Task.js";
import TaskAttempt from "../models/TaskAttempt.js";

export async function getAttemptView(attemptId) {
  const attempt = await Attempt.findById(attemptId).lean();
  if (!attempt) throw Object.assign(new Error("Attempt not found"), { statusCode: 404 });

  const lab = await Lab.findById(attempt.labId).lean();
  const taskAttempts = await TaskAttempt.find({ attemptId }).sort({ order: 1 }).lean();
  const activeState = taskAttempts.find((t) => t.order === attempt.currentTaskOrder);
  const activeTask = activeState
    ? await Task.findById(activeState.taskId).select("title instructions taskType starterFiles language hints order").lean()
    : null;

  return {
    attempt: {
      id: String(attempt._id),
      status: attempt.status,
      sandboxStatus: attempt.sandboxStatus,
      currentTaskOrder: attempt.currentTaskOrder,
      score: attempt.score,
      startedAt: attempt.startedAt
    },
    lab: { id: String(lab._id), title: lab.title, track: lab.track, version: lab.version },
    progress: taskAttempts.map((t) => ({ order: t.order, status: t.status, tries: t.tries })),
    activeTask
  };
}

export async function revealHint({ attemptId, taskId, level }) {
  const state = await TaskAttempt.findOne({ attemptId, taskId, status: "active" });
  if (!state) throw Object.assign(new Error("Task is not active"), { statusCode: 409 });
  const task = await Task.findById(taskId).select("hints").lean();
  const requested = Math.max(1, Math.min(Number(level), task.hints.length));
  state.highestHintLevel = Math.max(state.highestHintLevel, requested);
  await state.save();
  return { level: requested, hint: task.hints[requested - 1] || "No more hints." };
}
