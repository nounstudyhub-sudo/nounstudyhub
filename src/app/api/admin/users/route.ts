import { connectToDatabase } from "@/db";
import { User, withId } from "@/db/models";
import { requireAdmin } from "@/lib/auth";

export async function GET(request: Request) {
  try { await requireAdmin(); await connectToDatabase(); const q = new URL(request.url).searchParams.get("q")?.trim() ?? ""; const filter = q ? { username: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } } : { role: "student" }; const rows = await User.find(filter).select("username matriculationNumber phoneNumber role isActive createdAt").sort({ createdAt: -1 }).lean(); return Response.json({ users: rows.map(withId) }); }
  catch { return Response.json({ error: "Admin access required." }, { status: 401 }); }
}
