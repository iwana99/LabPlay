import mongoose from "mongoose";

const schema = new mongoose.Schema({
  attemptId: { type: mongoose.Schema.Types.ObjectId, ref: "Attempt", required: true, index: true },
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: "Task", required: true, index: true },
  order: { type: Number, required: true },
  status: { type: String, enum: ["locked", "active", "passed"], default: "locked", index: true },
  tries: { type: Number, default: 0 },
  highestHintLevel: { type: Number, default: 0 },
  passedAt: Date
}, { timestamps: true });

schema.index({ attemptId: 1, taskId: 1 }, { unique: true });
schema.index({ attemptId: 1, order: 1 }, { unique: true });

export default mongoose.model("TaskAttempt", schema);
