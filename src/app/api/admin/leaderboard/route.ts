import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { mockAttempts, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  try { await requireAdmin(); const rows = await db.select({ username: users.username, average: sql<number>`round(avg(${mockAttempts.percentage}))`, attempts: sql<number>`count(${mockAttempts.id})` }).from(users).innerJoin(mockAttempts, eq(mockAttempts.userId, users.id)).groupBy(users.id).having(sql`count(${mockAttempts.id}) >= 2`).orderBy(desc(sql`round(avg(${mockAttempts.percentage}))`)).limit(20); return Response.json({ leaderboard: rows }); }
  catch { return Response.json({ error: "Admin access required." }, { status: 401 }); }
}
