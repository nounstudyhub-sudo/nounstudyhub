import mongoose from "mongoose";
import { connectToDatabase } from "@/db";
import { Course, MockAnswer, MockAttempt, Question, QuestionBank, objectIdOrNull, withId } from "@/db/models";
import { requireUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const { courseId, questionCount, timeLimit, year } = await request.json();
    await connectToDatabase();
    const count = Math.max(1, Math.floor(Number(questionCount)));
    const minutes = Math.max(1, Math.floor(Number(timeLimit)));
    const courseObjectId = objectIdOrNull(courseId);
    if (!courseObjectId) return Response.json({ error: "Course not found." }, { status: 404 });
    const course = await Course.findById(courseObjectId).lean();
    if (!course) return Response.json({ error: "Course not found." }, { status: 404 });
    const bank = year === null || year === undefined || year === "" ? null : await QuestionBank.findOne({ courseId: course._id, year: Number(year) }).select("_id").lean();
    if (year !== null && year !== undefined && year !== "" && !bank) return Response.json({ error: "Question bank year not found for this course." }, { status: 404 });
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
