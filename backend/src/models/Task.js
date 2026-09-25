import mongoose from "mongoose";

const fileSchema = new mongoose.Schema({
  path: { type: String, required: true },
  content: { type: String, default: "" },
  readOnly: { type: Boolean, default: false }
}, { _id: false });

const schema = new mongoose.Schema({
  labId: { type: mongoose.Schema.Types.ObjectId, ref: "Lab", required: true, index: true },
  order: { type: Number, required: true, min: 1 },
  title: { type: String, required: true },
  instructions: { type: String, required: true },
  taskType: { type: String, enum: ["linux_state", "code", "frontend_project", "backend_project"], required: true },
  starterFiles: { type: [fileSchema], default: [] },
  language: { type: String, default: "javascript" },
  hints: { type: [String], default: [] },
  checker: { type: mongoose.Schema.Types.Mixed, required: true, select: false },
  resourceLimits: {
    cpuMillis: { type: Number, default: 1000 },
    memoryMb: { type: Number, default: 256 },
    timeoutMs: { type: Number, default: 10000 },
    network: { type: Boolean, default: false }
  }
}, { timestamps: true });

schema.index({ labId: 1, order: 1 }, { unique: true });

export default mongoose.model("Task", schema);
