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
    let payload: unknown;
    try { payload = await request.json(); }
    catch { return Response.json({ error: "Invalid JSON payload." }, { status: 400 }); }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return Response.json({ error: "Invalid request payload." }, { status: 400 });
    const { attemptId, answers, timeUsed } = payload as Record<string, unknown>;
    if (typeof attemptId !== "string" || !objectIdOrNull(attemptId)) return Response.json({ error: "A valid mock attempt ID is required." }, { status: 400 });
    if (!Number.isInteger(timeUsed) || Number(timeUsed) < 1 || Number(timeUsed) > 86400) return Response.json({ error: "Time used must be a positive integer number of seconds." }, { status: 400 });
    if (!answers || typeof answers !== "object" || Array.isArray(answers) || !Object.entries(answers).every(([id, value]) => id.length <= 64 && typeof value === "string" && value.length <= 2000)) return Response.json({ error: "Answers must be an object containing text values." }, { status: 400 });
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
          const submitted = answers as Record<string, string>;
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
          const elapsedAtServer = Math.floor((Date.now() - attempt.startedAt.getTime()) / 1000);
          attempt.timeUsed = Math.max(1, Math.min(Number(timeUsed), attempt.timeLimit * 60, elapsedAtServer));
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
