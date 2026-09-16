import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { courses, mockAnswers, mockAttempts, questions } from "@/db/schema";
import { requireUser } from "@/lib/auth";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(); const { id } = await params;
    const [row] = await db.select({ attempt: mockAttempts, course: courses }).from(mockAttempts).innerJoin(courses, eq(mockAttempts.courseId, courses.id)).where(and(eq(mockAttempts.id, id), eq(mockAttempts.userId, user.id))).limit(1);
    if (!row) return Response.json({ error: "Attempt not found." }, { status: 404 });
    if (!row.attempt.submittedAt) return Response.json({ error: "Review is available after submission." }, { status: 403 });
    const answers = await db.select({ answer: mockAnswers, question: questions }).from(mockAnswers).innerJoin(questions, eq(mockAnswers.questionId, questions.id)).where(eq(mockAnswers.attemptId, id));
    return Response.json({ attempt: row.attempt, course: row.course, answers });
  } catch { return Response.json({ error: "Please log in." }, { status: 401 }); }
}
