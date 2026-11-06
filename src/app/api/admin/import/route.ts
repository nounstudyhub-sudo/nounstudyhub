import mongoose from "mongoose";
import { connectToDatabase } from "@/db";
import { AdminImport, Course, Question, QuestionBank, objectIdOrNull } from "@/db/models";
import { requireAdmin, safeText } from "@/lib/auth";
import { validateQuestionCsv } from "@/lib/question-csv";

export async function POST(request: Request) {
  try {
    await requireAdmin();
    await connectToDatabase();
    const body = await request.json().catch(() => ({}));
    const courseId = objectIdOrNull(safeText(body.courseId, 50)); const year = Number(body.year); const csv = String(body.csv ?? "");
    const { questions: valid, errors, detected } = validateQuestionCsv(csv);
    if (!courseId || !Number.isInteger(year)) return Response.json({ error: "Select a course and valid question-bank year." }, { status: 400 });
    if (!await Course.exists({ _id: courseId })) return Response.json({ error: "Course not found." }, { status: 404 });
    if (errors.length) return Response.json({ error: "CSV contains invalid rows. Correct them before importing.", detected, invalid: errors.length, errors }, { status: 400 });
    if (!valid.length) return Response.json({ error: "No question rows found in the CSV.", detected, errors: [] }, { status: 400 });
    const session = await mongoose.startSession();
    let bankId = "";
    let imported = 0;
    try {
      await session.withTransaction(async () => {
        const bank = await QuestionBank.findOneAndUpdate({ courseId, year }, { $setOnInsert: { courseId, year } }, { upsert: true, new: true, setDefaultsOnInsert: true, session });
        const inserted = await Question.insertMany(valid.map((item) => ({
          courseId,
          bankId: bank._id,
          question: item.question,
          questionType: item.questionType,
          optionA: item.questionType === "FBQ" ? null : item.optionA,
          optionB: item.questionType === "FBQ" ? null : item.optionB,
          optionC: item.questionType === "MCQ" ? item.optionC : null,
          optionD: item.questionType === "MCQ" ? item.optionD : null,
          correctAnswer: item.correctAnswer,
          explanation: item.explanation || null,
        })), { session });
        await AdminImport.create([{ courseId, bankId: bank._id, questionCount: inserted.length }], { session });
        bankId = bank._id.toString();
        imported = inserted.length;
      });
    } finally { await session.endSession(); }
    if (!imported || !bankId) throw new Error("Question import transaction did not commit.");
    return Response.json({ imported, invalid: 0, errors: [], bankId }, { status: 201 });
  } catch { return Response.json({ error: "Question import failed." }, { status: 500 }); }
}
