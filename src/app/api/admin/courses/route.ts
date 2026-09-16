import { asc, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { courses, questions } from "@/db/schema";
import { requireAdmin, safeText } from "@/lib/auth";

export async function GET() {
  try { await requireAdmin(); const rows = await db.select({ course: courses, questionCount: count(questions.id) }).from(courses).leftJoin(questions, eq(questions.courseId, courses.id)).groupBy(courses.id).orderBy(asc(courses.code)); return Response.json({ courses: rows.map((row) => ({ ...row.course, questionCount: Number(row.questionCount) })) }); }
  catch { return Response.json({ error: "Admin access required." }, { status: 401 }); }
}

export async function POST(request: Request) {
  try { await requireAdmin(); const body = await request.json(); const code = safeText(body.code, 20).toUpperCase(); const title = safeText(body.title, 160); const description = safeText(body.description, 500); if (!code || !title) return Response.json({ error: "Course code and title are required." }, { status: 400 }); const [course] = await db.insert(courses).values({ code, title, description }).returning(); return Response.json({ course }, { status: 201 }); }
  catch { return Response.json({ error: "Could not create course." }, { status: 500 }); }
}
