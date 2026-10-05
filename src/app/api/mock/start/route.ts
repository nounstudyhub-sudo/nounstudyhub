import mongoose from "mongoose";
import { connectToDatabase } from "@/db";
import { Course, MockAnswer, MockAttempt, Question, QuestionBank, objectIdOrNull, withId } from "@/db/models";
import { requireUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    let payload: unknown;
    try { payload = await request.json(); }
    catch { return Response.json({ error: "Invalid JSON payload." }, { status: 400 }); }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return Response.json({ error: "Invalid request payload." }, { status: 400 });
    const { courseId, questionCount, timeLimit, year } = payload as Record<string, unknown>;
    if (typeof courseId !== "string" || !objectIdOrNull(courseId)) return Response.json({ error: "A valid course ID is required." }, { status: 400 });
    if (!Number.isInteger(questionCount) || Number(questionCount) < 1 || Number(questionCount) > 500) return Response.json({ error: "Question count must be an integer from 1 to 500." }, { status: 400 });
    if (!Number.isInteger(timeLimit) || Number(timeLimit) < 1 || Number(timeLimit) > 1440) return Response.json({ error: "Time limit must be an integer from 1 to 1440 minutes." }, { status: 400 });
    if (year !== undefined && year !== null && (typeof year !== "number" || !Number.isInteger(year) || year < 1900 || year > 2200)) return Response.json({ error: "Question-bank year must be between 1900 and 2200." }, { status: 400 });
    await connectToDatabase();
    const count = Number(questionCount);
    const minutes = Number(timeLimit);
    const courseObjectId = objectIdOrNull(courseId);
    if (!courseObjectId) return Response.json({ error: "Course not found." }, { status: 404 });
    const course = await Course.findById(courseObjectId).lean();
    if (!course) return Response.json({ error: "Course not found." }, { status: 404 });
    const bank = year === null || year === undefined ? null : await QuestionBank.findOne({ courseId: course._id, year }).select("_id").lean();
    if (year !== null && year !== undefined && !bank) return Response.json({ error: "Question bank year not found for this course." }, { status: 404 });
    const all = await Question.find({ courseId: course._id, ...(bank ? { bankId: bank._id } : {}) }).sort({ createdAt: 1 }).lean();
    if (all.length < count) return Response.json({ error: `Not enough questions available. This course has ${all.length}.` }, { status: 400 });
    const selected = [...all].sort(() => Math.random() - 0.5).slice(0, count);
    const session = await mongoose.startSession();
    let attemptId = "";
    try {
      await session.withTransaction(async () => {
        const [attempt] = await MockAttempt.create([{ userId: user.id, courseId: course._id, totalQuestions: count, timeLimit: minutes }], { session });
        await MockAnswer.insertMany(selected.map((question, index) => ({ attemptId: attempt._id, questionId: question._id, position: index, questionType: question.questionType ?? "MCQ", correctAnswer: question.correctAnswer })), { session });
        attemptId = attempt._id.toString();
      });
    } finally { await session.endSession(); }
    if (!attemptId) throw new Error("Mock start transaction did not commit.");
    return Response.json({ attemptId, course: withId(course), questions: selected.map((question, index) => ({ id: question._id.toString(), position: index, questionType: question.questionType ?? "MCQ", question: question.question, options: { A: question.optionA, B: question.optionB, C: question.optionC, D: question.optionD } })) });
  } catch { return Response.json({ error: "Could not start mock." }, { status: 500 }); }
}
