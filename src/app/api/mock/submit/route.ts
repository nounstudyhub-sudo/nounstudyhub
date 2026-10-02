import { connectToDatabase } from "@/db";
import { MockAnswer, MockAttempt, idString, objectIdOrNull, withId } from "@/db/models";
import { requireUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const { attemptId, answers, timeUsed } = await request.json();
    await connectToDatabase();
    const attemptObjectId = objectIdOrNull(attemptId);
    if (!attemptObjectId) return Response.json({ error: "Mock attempt not found." }, { status: 404 });
    const attempt = await MockAttempt.findOne({ _id: attemptObjectId, userId: user.id });
    if (!attempt) return Response.json({ error: "Mock attempt not found." }, { status: 404 });
    const answerRows = await MockAnswer.find({ attemptId: attempt._id });
    const submitted = answers && typeof answers === "object" ? answers as Record<string, string> : {};
    let correct = 0; let unanswered = 0;
    for (const row of answerRows) {
      const questionId = row.questionId.toString();
      const selected = ["A", "B", "C", "D"].includes(submitted[questionId]) ? submitted[questionId] : null;
      if (!selected) unanswered += 1;
      if (selected === row.correctAnswer) correct += 1;
      row.selectedAnswer = selected;
      await row.save();
    }
    const percentage = Math.round((correct / attempt.totalQuestions) * 100);
    attempt.correctAnswers = correct;
    attempt.unanswered = unanswered;
    attempt.percentage = percentage;
    attempt.timeUsed = Math.max(0, Number(timeUsed) || 0);
    attempt.submittedAt = new Date();
    const updated = await attempt.save();
    return Response.json({ result: { ...withId(updated.toObject()), userId: idString(updated.userId), courseId: idString(updated.courseId) } });
  } catch { return Response.json({ error: "Could not submit mock." }, { status: 500 }); }
}
