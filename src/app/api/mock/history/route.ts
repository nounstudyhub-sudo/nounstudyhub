import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { courses, mockAttempts } from "@/db/schema";
import { requireUser } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
    const rows = await db.select({ attempt: mockAttempts, course: courses }).from(mockAttempts).innerJoin(courses, eq(mockAttempts.courseId, courses.id)).where(and(eq(mockAttempts.userId, user.id), q ? or(ilike(courses.code, `%${q}%`), ilike(courses.title, `%${q}%`)) : undefined)).orderBy(desc(mockAttempts.startedAt));
    return Response.json({ attempts: rows });
  } catch { return Response.json({ error: "Please log in." }, { status: 401 }); }
}
