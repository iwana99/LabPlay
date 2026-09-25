import mongoose from "mongoose";

const schema = new mongoose.Schema({
  slug: { type: String, required: true, trim: true },
  title: { type: String, required: true, trim: true },
  track: { type: String, enum: ["linux", "frontend", "backend", "algorithms"], required: true, index: true },
  version: { type: Number, required: true, min: 1 },
  sandboxProfile: { type: String, required: true },
  status: { type: String, enum: ["draft", "published", "archived"], default: "draft", index: true },
  publishedAt: Date
}, { timestamps: true });

schema.index({ slug: 1, version: 1 }, { unique: true });
schema.index({ slug: 1, status: 1, version: -1 });

export default mongoose.model("Lab", schema);
