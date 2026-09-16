import { desc, eq, ilike } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";

export async function GET(request: Request) {
  try { await requireAdmin(); const q = new URL(request.url).searchParams.get("q")?.trim() ?? ""; const rows = await db.select({ id: users.id, username: users.username, matriculationNumber: users.matriculationNumber, phoneNumber: users.phoneNumber, role: users.role, isActive: users.isActive, createdAt: users.createdAt }).from(users).where(q ? ilike(users.username, `%${q}%`) : eq(users.role, "student")).orderBy(desc(users.createdAt)); return Response.json({ users: rows }); }
  catch { return Response.json({ error: "Admin access required." }, { status: 401 }); }
}
