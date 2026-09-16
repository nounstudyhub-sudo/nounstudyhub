import { asc, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { courses, modules, questionBanks, questions, summaries } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [course] = await db.select({ course: courses, questionCount: count(questions.id) }).from(courses).leftJoin(questions, eq(questions.courseId, courses.id)).where(eq(courses.id, id)).groupBy(courses.id).limit(1);
  if (!course) return Response.json({ error: "Course not found." }, { status: 404 });
  const bankRows = await db.select().from(questionBanks).where(eq(questionBanks.courseId, id)).orderBy(asc(questionBanks.year));
  const moduleRows = await db.select().from(modules).where(eq(modules.courseId, id)).orderBy(asc(modules.position));
  const summaryRows = moduleRows.length ? await db.select().from(summaries).where(eq(summaries.moduleId, moduleRows[0].id)) : [];
  return Response.json({ course: { ...course.course, questionCount: Number(course.questionCount) }, banks: bankRows, modules: moduleRows, summaries: summaryRows });
}
