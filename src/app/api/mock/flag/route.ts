import mongoose from "mongoose";
import { connectToDatabase } from "@/db";
import { Course, FlaggedQuestion, Notification, Question, QuestionBank, objectIdOrNull, withId } from "@/db/models";
import { requireUser, safeText } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    let payload: unknown;
    try { payload = await request.json(); }
    catch { return Response.json({ error: "Invalid JSON payload." }, { status: 400 }); }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return Response.json({ error: "Invalid request payload." }, { status: 400 });
    }

    const { questionId, courseId, userId, reason } = payload as Record<string, unknown>;
    const questionObjectId = objectIdOrNull(questionId);
    const courseObjectId = objectIdOrNull(courseId);
    if (!questionObjectId || !courseObjectId) {
      return Response.json({ error: "A valid question and course are required." }, { status: 400 });
    }
    if (userId !== user.id) return Response.json({ error: "You can only flag questions for your account." }, { status: 403 });

    await connectToDatabase();
    const question = await Question.findOne({ _id: questionObjectId, courseId: courseObjectId }).select("bankId").lean();
    if (!question) return Response.json({ error: "Question not found for this course." }, { status: 404 });

    const existing = await FlaggedQuestion.findOne({ questionId: questionObjectId, userId: user.id }).lean();
    if (existing) return Response.json({ flag: withId(existing), alreadyFlagged: true });

    const [course, bank] = await Promise.all([
      Course.findById(courseObjectId).select("code").lean(),
      QuestionBank.findById(question.bankId).select("year").lean(),
    ]);
    if (!course || !bank) return Response.json({ error: "Course or question-bank details could not be found." }, { status: 404 });

    const session = await mongoose.startSession();
    let responseFlag: ReturnType<typeof withId> | null = null;
    try {
      await session.withTransaction(async () => {
        const [flag] = await FlaggedQuestion.create([{
          questionId: questionObjectId,
          courseId: courseObjectId,
          userId: user.id,
          reason: safeText(reason, 160) || "Flagged during mock",
        }], { session });
        await Notification.create([{
          userId: null,
          type: "QUESTION_FLAGGED",
          title: "New Flagged Question",
          message: `${user.username} flagged a question in ${course.code} (${bank.year}).`,
          link: "/admin/flagged-questions",
          read: false,
          readAt: null,
        }], { session });
        responseFlag = withId(flag.toObject());
      });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === 11000) {
        const duplicate = await FlaggedQuestion.findOne({ questionId: questionObjectId, userId: user.id }).lean();
        if (duplicate) return Response.json({ flag: withId(duplicate), alreadyFlagged: true });
      }
      throw error;
    } finally {
      await session.endSession();
    }
    if (!responseFlag) throw new Error("Flag submission transaction did not commit.");
    return Response.json({ flag: responseFlag, alreadyFlagged: false }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return Response.json({ error: "Please log in to flag a question." }, { status: 401 });
    return Response.json({ error: "Could not flag this question." }, { status: 500 });
  }
}
