import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { favorites } from "@/db/schema";
import { requireUser } from "@/lib/auth";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const existing = await db.select().from(favorites).where(and(eq(favorites.userId, user.id), eq(favorites.courseId, id))).limit(1);
    if (existing.length) { await db.delete(favorites).where(and(eq(favorites.userId, user.id), eq(favorites.courseId, id))); return Response.json({ favorite: false }); }
    await db.insert(favorites).values({ userId: user.id, courseId: id });
    return Response.json({ favorite: true });
  } catch { return Response.json({ error: "Please log in." }, { status: 401 }); }
}
