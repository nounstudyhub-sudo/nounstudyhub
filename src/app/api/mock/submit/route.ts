import mongoose from "mongoose";
import { connectToDatabase } from "@/db";
import { Course, MockAnswer, MockAttempt, Notification, idString, objectIdOrNull, withId } from "@/db/models";
import { requireUser } from "@/lib/auth";

type MockResult = {
  id: string;
  userId: string;
  courseId: string;
  totalQuestions: number;
  correctAnswers: number;
  unanswered: number;
  percentage: number;
  timeUsed: number;
};

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const { attemptId, answers, timeUsed } = await request.json();
    await connectToDatabase();
    const attemptObjectId = objectIdOrNull(attemptId);
    if (!attemptObjectId) return Response.json({ error: "Mock attempt not found." }, { status: 404 });

    const session = await mongoose.startSession();
    const outcome: { result: MockResult | null } = { result: null };
    let courseIdForNotification = "";
    let newlySubmitted = false;
    try {
      await session.withTransaction(async () => {
        const attempt = await MockAttempt.findOne({ _id: attemptObjectId, userId: user.id }).session(session);
        if (!attempt) return;
        courseIdForNotification = idString(attempt.courseId);
        if (!attempt.submittedAt) {
          const answerRows = await MockAnswer.find({ attemptId: attempt._id }).session(session);
          if (!answerRows.length) throw new Error("No saved answers found for this attempt.");
          const submitted = answers && typeof answers === "object" ? answers as Record<string, string> : {};
          let correct = 0;
          let unanswered = 0;
          for (const row of answerRows) {
            const questionId = row.questionId.toString();
            const isFillInBlank = row.questionType === "FBQ";
            const supplied = submitted[questionId];
            const selected = isFillInBlank
              ? typeof supplied === "string" && supplied.trim() ? supplied : null
              : ["A", "B", "C", "D"].includes(supplied) ? supplied : null;
            if (!selected) unanswered += 1;
            const isCorrect = isFillInBlank
              ? selected !== null && selected.trim().toLowerCase() === row.correctAnswer.trim().toLowerCase()
              : selected === row.correctAnswer;
            if (isCorrect) correct += 1;
            row.selectedAnswer = selected;
            await row.save({ session });
          }
          attempt.correctAnswers = correct;
          attempt.unanswered = unanswered;
          attempt.percentage = attempt.totalQuestions ? Math.round((correct / attempt.totalQuestions) * 100) : 0;
          attempt.timeUsed = Math.max(0, Number(timeUsed) || 0);
          attempt.submittedAt = new Date();
          newlySubmitted = true;
          await attempt.save({ session });
        }
        outcome.result = {
          ...withId(attempt.toObject()),
          userId: idString(attempt.userId),
          courseId: idString(attempt.courseId),
        } as MockResult;
      });
    } finally { await session.endSession(); }

    const result = outcome.result;
    if (!result) return Response.json({ error: "Mock attempt not found." }, { status: 404 });
    if (newlySubmitted) {
      const course = await Course.findById(courseIdForNotification).select("code").lean();
      await Notification.create({ userId: null, type: "admin", message: `${user.username} completed a ${result.totalQuestions}-question ${course?.code ?? "course"} mock with ${result.percentage}%.`, link: "/admin/dashboard" }).catch(() => undefined);
    }
    return Response.json({ result });
  } catch { return Response.json({ error: "Could not submit mock." }, { status: 500 }); }
}
