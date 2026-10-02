import mongoose from "mongoose";
import { connectToDatabase } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await connectToDatabase();
    return Response.json({ ok: true, service: "NounStudyHub", database: mongoose.connection.name });
  } catch {
    return Response.json({ ok: false, service: "NounStudyHub" }, { status: 500 });
  }
}
