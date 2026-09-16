import { asc, count, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { courses, questions } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim();
  const filter = query ? or(ilike(courses.code, `%${query}%`), ilike(courses.title, `%${query}%`)) : undefined;
  const rows = await db.select({ course: courses, questionCount: count(questions.id) }).from(courses)
    .leftJoin(questions, eq(questions.courseId, courses.id)).where(filter)
    .groupBy(courses.id).orderBy(asc(courses.code));
  return Response.json({ courses: rows.map((row) => ({ ...row.course, questionCount: Number(row.questionCount) })) });
}
