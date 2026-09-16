import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { courseViews } from "@/db/schema";
import { requireUser } from "@/lib/auth";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const existing = await db.select().from(courseViews).where(and(eq(courseViews.userId, user.id), eq(courseViews.courseId, id))).limit(1);
    if (existing.length) await db.update(courseViews).set({ viewedAt: new Date() }).where(and(eq(courseViews.userId, user.id), eq(courseViews.courseId, id)));
    else await db.insert(courseViews).values({ userId: user.id, courseId: id });
    return Response.json({ ok: true });
  } catch { return Response.json({ error: "Please log in." }, { status: 401 }); }
}
