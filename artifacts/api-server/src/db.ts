import mongoose from "mongoose";
import { logger } from "./lib/logger";

export async function connectDB(): Promise<void> {
  const uri = process.env["MONGODB_URI"];
  if (!uri) {
    logger.warn("MONGODB_URI not set — database unavailable");
    return;
  }
  try {
    await mongoose.connect(uri);
    logger.info("MongoDB connected");
  } catch (err) {
    logger.error({ err }, "MongoDB connection failed — server will start without DB");
  }
}
