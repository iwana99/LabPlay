import mongoose from "mongoose";
import { env } from "./env.js";

export async function connectDB() {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.MONGODB_URI, {
    autoIndex: env.NODE_ENV !== "production",
    serverSelectionTimeoutMS: 5_000,
    maxPoolSize: 30,
    minPoolSize: env.NODE_ENV === "production" ? 2 : 0
  });
}

export async function disconnectDB() {
  await mongoose.disconnect();
}
