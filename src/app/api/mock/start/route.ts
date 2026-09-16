import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { courses, mockAnswers, mockAttempts, questions } from "@/db/schema";
import { requireUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const { courseId, questionCount, timeLimit } = await request.json();
    const count = Math.max(1, Math.floor(Number(questionCount)));
    const minutes = Math.max(1, Math.floor(Number(timeLimit)));
    const [course] = await db.select().from(courses).where(eq(courses.id, String(courseId))).limit(1);
    if (!course) return Response.json({ error: "Course not found." }, { status: 404 });
    const all = await db.select().from(questions).where(eq(questions.courseId, course.id)).orderBy(asc(questions.createdAt));
    if (all.length < count) return Response.json({ error: `Not enough questions available. This course has ${all.length}.` }, { status: 400 });
    const selected = [...all].sort(() => Math.random() - 0.5).slice(0, count);
    const [attempt] = await db.insert(mockAttempts).values({ userId: user.id, courseId: course.id, totalQuestions: count, timeLimit: minutes }).returning();
    await db.insert(mockAnswers).values(selected.map((question, index) => ({ attemptId: attempt.id, questionId: question.id, position: index, correctAnswer: question.correctAnswer })));
    return Response.json({ attemptId: attempt.id, course, questions: selected.map((question, index) => ({ id: question.id, position: index, question: question.question, options: { A: question.optionA, B: question.optionB, C: question.optionC, D: question.optionD } })) });
  } catch { return Response.json({ error: "Could not start mock." }, { status: 500 }); }
}
