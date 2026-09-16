import { desc, eq, or, isNull } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();
    const rows = await db.select().from(notifications).where(or(eq(notifications.userId, user.id), isNull(notifications.userId))).orderBy(desc(notifications.createdAt)).limit(20);
    return Response.json({ notifications: rows });
  } catch { return Response.json({ error: "Please log in." }, { status: 401 }); }
}
