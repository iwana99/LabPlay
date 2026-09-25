import mongoose from "mongoose";

const launchKeySchema = new mongoose.Schema({
  kid: { type: String, required: true },
  publicKeyPem: { type: String, required: true },
  active: { type: Boolean, default: true }
}, { _id: false });

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  issuer: { type: String, required: true, unique: true, index: true },
  launchKeys: { type: [launchKeySchema], default: [] },
  callbackUrl: { type: String, required: true },
  returnUrl: { type: String, required: true },
  webhookSecretEnc: { type: String, required: true },
  status: { type: String, enum: ["active", "disabled"], default: "active", index: true }
}, { timestamps: true });

export default mongoose.model("IntegrationPartner", schema);
