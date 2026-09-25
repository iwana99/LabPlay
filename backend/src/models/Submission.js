import mongoose from "mongoose";

const fileSchema = new mongoose.Schema({
  path: { type: String, required: true },
  content: { type: String, default: "" }
}, { _id: false });

const schema = new mongoose.Schema({
  attemptId: { type: mongoose.Schema.Types.ObjectId, ref: "Attempt", required: true, index: true },
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: "Task", required: true, index: true },
  mode: { type: String, enum: ["run", "check"], required: true },
  files: { type: [fileSchema], default: [] },
  status: { type: String, enum: ["queued", "running", "passed", "failed", "system_error"], default: "queued", index: true },
  output: { type: String, default: "" },
  feedback: { type: [String], default: [] },
  runtimeMs: Number,
  completedAt: Date
}, { timestamps: true });

schema.index({ attemptId: 1, taskId: 1, createdAt: -1 });

export default mongoose.model("Submission", schema);
