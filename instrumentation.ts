import { connectToDatabase } from "./src/db";

export async function register() {
  if (!process.env.MONGODB_URI) return;
  try {
    await connectToDatabase();
    console.log("[db] MongoDB connected.");
  } catch (error) {
    console.warn(`[db] MongoDB connection deferred: ${error instanceof Error ? error.message : "unknown"}`);
  }
}