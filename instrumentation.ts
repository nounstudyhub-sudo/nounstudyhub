import { connectToDatabase } from "./src/db";

export async function register() {
  if (!process.env.MONGODB_URI) {
    console.warn("[db] MONGODB_URI is not configured; database-backed routes will be unavailable.");
    return;
  }
  try {
    await connectToDatabase();
    console.log("[db] MongoDB connected.");
  } catch (error) {
    console.warn(`[db] MongoDB connection deferred (${error instanceof Error ? error.name : "unknown error"}).`);
  }
}