import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { mockAnswers, mockAttempts } from "@/db/schema";
import { requireUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const { attemptId, answers, timeUsed } = await request.json();
    const [attempt] = await db.select().from(mockAttempts).where(and(eq(mockAttempts.id, String(attemptId)), eq(mockAttempts.userId, user.id))).limit(1);
    if (!attempt) return Response.json({ error: "Mock attempt not found." }, { status: 404 });
    const answerRows = await db.select().from(mockAnswers).where(eq(mockAnswers.attemptId, attempt.id));
    const submitted = answers && typeof answers === "object" ? answers as Record<string, string> : {};
    let correct = 0; let unanswered = 0;
    for (const row of answerRows) {
      const selected = ["A", "B", "C", "D"].includes(submitted[row.questionId]) ? submitted[row.questionId] : null;
      if (!selected) unanswered += 1;
      if (selected === row.correctAnswer) correct += 1;
      await db.update(mockAnswers).set({ selectedAnswer: selected }).where(eq(mockAnswers.id, row.id));
    }
    const percentage = Math.round((correct / attempt.totalQuestions) * 100);
    const [updated] = await db.update(mockAttempts).set({ correctAnswers: correct, unanswered, percentage, timeUsed: Math.max(0, Number(timeUsed) || 0), submittedAt: new Date() }).where(eq(mockAttempts.id, attempt.id)).returning();
    return Response.json({ result: updated });
  } catch { return Response.json({ error: "Could not submit mock." }, { status: 500 }); }
}
