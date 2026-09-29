import { asc, count, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { courses, favorites, questions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim();
  const filter = query ? or(ilike(courses.code, `%${query}%`), ilike(courses.title, `%${query}%`)) : undefined;
  const rows = await db.select({ course: courses, questionCount: count(questions.id) }).from(courses)
    .leftJoin(questions, eq(questions.courseId, courses.id)).where(filter)
    .groupBy(courses.id).orderBy(asc(courses.code));
  const user = await getCurrentUser();
  const saved = user ? await db.select({ courseId: favorites.courseId }).from(favorites).where(eq(favorites.userId, user.id)) : [];
  const savedIds = new Set(saved.map((row) => row.courseId));
  return Response.json({ courses: rows.map((row) => ({ ...row.course, questionCount: Number(row.questionCount), favorite: savedIds.has(row.course.id) })) });
}
