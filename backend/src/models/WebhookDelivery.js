import mongoose from "mongoose";

const schema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true, index: true },
  attemptId: { type: mongoose.Schema.Types.ObjectId, ref: "Attempt", required: true, index: true },
  partnerId: { type: mongoose.Schema.Types.ObjectId, ref: "IntegrationPartner", required: true, index: true },
  status: { type: String, enum: ["pending", "delivered", "dead"], default: "pending", index: true },
  tries: { type: Number, default: 0 },
  nextAttemptAt: { type: Date, default: Date.now, index: true },
  lastError: { type: String, default: "" }
}, { timestamps: true });

schema.index({ status: 1, nextAttemptAt: 1 });

export default mongoose.model("WebhookDelivery", schema);
