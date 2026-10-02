import mongoose from "mongoose";
import { connectToDatabase } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await connectToDatabase();
    return Response.json({ ok: true, service: "NounStudyHub", database: mongoose.connection.name });
  } catch (error) {
    const missingUri = error instanceof Error && error.message.includes("MONGODB_URI");
    console.error(`[health] MongoDB check failed (${error instanceof Error ? error.name : "unknown error"}).`);
    return Response.json({
      ok: false,
      service: "NounStudyHub",
      error: missingUri ? "MONGODB_URI is not configured." : "MongoDB connection is unavailable.",
    }, { status: 503 });
  }
}
