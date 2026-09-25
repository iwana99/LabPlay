import mongoose from "mongoose";

const schema = new mongoose.Schema({
  partnerId: { type: mongoose.Schema.Types.ObjectId, ref: "IntegrationPartner", required: true, index: true },
  labId: { type: mongoose.Schema.Types.ObjectId, ref: "Lab", required: true, index: true },
  externalUserIdHash: { type: String, required: true, index: true },
  externalAssignmentId: { type: String, default: "" },
  status: {
    type: String,
    enum: ["provisioning", "active", "completing", "completed", "failed", "expired"],
    default: "provisioning",
    index: true
  },
  currentTaskOrder: { type: Number, default: 1 },
  sandboxId: { type: String, default: "", index: true },
  sandboxStatus: { type: String, enum: ["pending", "ready", "failed", "destroyed"], default: "pending" },
  score: { type: Number, default: 0 },
  startedAt: { type: Date, default: Date.now },
  finishedAt: Date,
  expiresAt: { type: Date, required: true }
}, { timestamps: true });

schema.index({ partnerId: 1, externalUserIdHash: 1, labId: 1, createdAt: -1 });


export default mongoose.model("Attempt", schema);
