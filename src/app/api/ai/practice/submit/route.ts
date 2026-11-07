import mongoose from "mongoose";
import { connectToDatabase } from "@/db";
import { Course, MockAnswer, MockAttempt, Notification, idString, objectIdOrNull, withId } from "@/db/models";
import { requireUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON payload." }, { status: 400 });
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return Response.json({ error: "Invalid request payload." }, { status: 400 });
    }

    const { attemptId, answers } = payload as Record<string, unknown>;
    const attemptObjectId = objectIdOrNull(attemptId);
    if (!attemptObjectId) return Response.json({ error: "A valid practice attempt ID is required." }, { status: 400 });
    if (!answers || typeof answers !== "object" || Array.isArray(answers)
      || !Object.entries(answers).every(([position, answer]) => /^(0|[1-9]\d*)$/.test(position) && typeof answer === "string" && answer.length <= 2000)) {
      return Response.json({ error: "Answers must map question positions to answer text." }, { status: 400 });
    }

    await connectToDatabase();
    const session = await mongoose.startSession();
    let submittedAttempt: Record<string, unknown> | null = null;
    let newlySubmitted = false;
    try {
      await session.withTransaction(async () => {
        const attempt = await MockAttempt.findOne({
          _id: attemptObjectId,
          userId: user.id,
          type: "AI_PRACTICE",
        }).session(session);
        if (!attempt) return;
        if (!attempt.submittedAt && attempt.expiresAt && attempt.expiresAt <= new Date()) return;
        if (attempt.submittedAt) {
          submittedAttempt = {
            ...withId(attempt.toObject()),
            courseId: idString(attempt.courseId),
          };
          return;
        }

        const answerRows = await MockAnswer.find({ attemptId: attempt._id }).sort({ position: 1 }).session(session);
        if (answerRows.length !== attempt.totalQuestions || answerRows.some((answer) => !answer.questionSnapshot?.question)) {
          throw new Error("Saved AI practice questions are incomplete.");
        }
        const selectedAnswers = answers as Record<string, string>;
        if (Object.keys(selectedAnswers).some((position) => Number(position) >= answerRows.length)) {
          throw new Error("An answer refers to a question outside this practice set.");
        }

        let correctAnswers = 0;
        let unanswered = 0;
        for (const answer of answerRows) {
          const supplied = selectedAnswers[String(answer.position)];
          const selected = answer.questionType === "FBQ"
            ? typeof supplied === "string" && supplied.trim() ? supplied.trim() : null
            : ["A", "B", "C", "D"].includes(supplied) ? supplied : null;
          if (!selected) unanswered += 1;
          const isCorrect = answer.questionType === "FBQ"
            ? selected !== null && selected.trim().toLowerCase() === answer.correctAnswer.trim().toLowerCase()
            : selected === answer.correctAnswer;
          if (isCorrect) correctAnswers += 1;
          answer.selectedAnswer = selected;
          answer.expiresAt = null;
          await answer.save({ session });
        }

        const elapsedSeconds = Math.floor((Date.now() - attempt.startedAt.getTime()) / 1000);
        attempt.correctAnswers = correctAnswers;
        attempt.unanswered = unanswered;
        attempt.percentage = Math.round((correctAnswers / attempt.totalQuestions) * 100);
        attempt.timeUsed = Math.max(1, Math.min(elapsedSeconds, attempt.timeLimit * 60));
        attempt.submittedAt = new Date();
        attempt.expiresAt = null;
        await attempt.save({ session });
        newlySubmitted = true;
        submittedAttempt = {
          ...withId(attempt.toObject()),
          courseId: idString(attempt.courseId),
        };
      });
    } finally {
      await session.endSession();
    }

    if (!submittedAttempt) return Response.json({ error: "Practice attempt not found." }, { status: 404 });
    const result = submittedAttempt as {
      id: string;
      userId: unknown;
      courseId: string;
      totalQuestions: number;
      correctAnswers: number;
      unanswered: number;
      percentage: number;
      timeUsed: number;
    };
    if (newlySubmitted) {
      const course = await Course.findById(result.courseId).select("code").lean();
      await Notification.create({
        userId: null,
        type: "admin",
        message: `${user.username} completed an AI practice set of ${result.totalQuestions} ${course?.code ?? "course"} questions with ${result.percentage}%.`,
        link: "/admin/dashboard",
      }).catch(() => undefined);
    }

    return Response.json({ result: {
      id: result.id,
      totalQuestions: result.totalQuestions,
      correctAnswers: result.correctAnswers,
      unanswered: result.unanswered,
      percentage: result.percentage,
      timeUsed: result.timeUsed,
    } });
  } catch {
    return Response.json({ error: "Could not submit AI practice results." }, { status: 500 });
  }
}
