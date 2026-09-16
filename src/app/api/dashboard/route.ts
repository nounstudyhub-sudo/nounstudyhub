import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { courses, courseViews, favorites, mockAttempts } from "@/db/schema";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();
    const attempts = await db.select({ attempt: mockAttempts, course: courses }).from(mockAttempts).innerJoin(courses, eq(mockAttempts.courseId, courses.id)).where(eq(mockAttempts.userId, user.id)).orderBy(desc(mockAttempts.startedAt)).limit(10);
    const views = await db.select({ course: courses, viewedAt: courseViews.viewedAt }).from(courseViews).innerJoin(courses, eq(courseViews.courseId, courses.id)).where(eq(courseViews.userId, user.id)).orderBy(desc(courseViews.viewedAt)).limit(6);
    const favs = await db.select({ course: courses }).from(favorites).innerJoin(courses, eq(favorites.courseId, courses.id)).where(eq(favorites.userId, user.id)).orderBy(desc(favorites.createdAt));
    return Response.json({ attempts, views, favorites: favs.map((row) => row.course) });
  } catch { return Response.json({ error: "Please log in." }, { status: 401 }); }
}
