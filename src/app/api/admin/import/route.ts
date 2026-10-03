import mongoose from "mongoose";
import { connectToDatabase } from "@/db";
import { AdminImport, Course, Question, QuestionBank, objectIdOrNull } from "@/db/models";
import { requireAdmin, safeText } from "@/lib/auth";

type CsvRow = { question: string; questionType: "MCQ" | "FBQ"; optionA: string; optionB: string; optionC: string; optionD: string; correctAnswer: string; explanation: string };

function parseCsv(input: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  for (let i = 0; i < input.length; i += 1) { const char = input[i]; const next = input[i + 1]; if (char === '"' && quoted && next === '"') { cell += '"'; i += 1; } else if (char === '"') quoted = !quoted; else if (char === "," && !quoted) { row.push(cell); cell = ""; } else if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && next === "\n") i += 1; row.push(cell); if (row.some((item) => item.trim())) rows.push(row); row = []; cell = ""; } else cell += char; }
  row.push(cell); if (row.some((item) => item.trim())) rows.push(row); return rows;
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    await connectToDatabase();
    const body = await request.json().catch(() => ({}));
    const courseId = objectIdOrNull(safeText(body.courseId, 50)); const year = Number(body.year); const csv = String(body.csv ?? "");
    const rows = parseCsv(csv);
    const header = rows.shift()?.map((item) => item.trim().toLowerCase());
    const required = ["question", "questiontype", "optiona", "optionb", "optionc", "optiond", "correctanswer", "explanation"];
    if (!header || required.some((key) => !header.includes(key))) return Response.json({ error: "CSV format invalid. Required columns: question, questionType, optionA, optionB, optionC, optionD, correctAnswer, explanation." }, { status: 400 });
    const index = Object.fromEntries(required.map((key) => [key, header.indexOf(key)]));
    const valid: CsvRow[] = []; const errors: string[] = [];
    rows.forEach((cells, rowIndex) => {
      const questionType = cells[index.questiontype]?.trim().toUpperCase();
      const item = {
        question: cells[index.question]?.trim(),
        questionType,
        optionA: cells[index.optiona]?.trim() ?? "",
        optionB: cells[index.optionb]?.trim() ?? "",
        optionC: cells[index.optionc]?.trim() ?? "",
        optionD: cells[index.optiond]?.trim() ?? "",
        correctAnswer: cells[index.correctanswer]?.trim() ?? "",
        explanation: cells[index.explanation]?.trim() ?? "",
      } as CsvRow;
      if (!item.question) errors.push(`Row ${rowIndex + 2}: question is required.`);
      else if (questionType !== "MCQ" && questionType !== "FBQ") errors.push(`Row ${rowIndex + 2}: questionType must be MCQ or FBQ.`);
      else if (questionType === "MCQ" && (!item.optionA || !item.optionB || !item.optionC || !item.optionD)) errors.push(`Row ${rowIndex + 2}: MCQs require all four options.`);
      else if (questionType === "MCQ" && !["A", "B", "C", "D"].includes(item.correctAnswer.toUpperCase())) errors.push(`Row ${rowIndex + 2}: MCQ correctAnswer must be A, B, C or D.`);
      else if (questionType === "FBQ" && !item.correctAnswer) errors.push(`Row ${rowIndex + 2}: FBQ correctAnswer must contain the missing word or phrase.`);
      else valid.push({ ...item, questionType: questionType as CsvRow["questionType"], correctAnswer: questionType === "MCQ" ? item.correctAnswer.toUpperCase() : item.correctAnswer });
    });
    if (!courseId || !Number.isInteger(year)) return Response.json({ error: "Select a course and valid question-bank year." }, { status: 400 });
    if (!await Course.exists({ _id: courseId })) return Response.json({ error: "Course not found." }, { status: 404 });
    if (!valid.length) return Response.json({ error: "No valid questions detected.", detected: rows.length, errors }, { status: 400 });
    const session = await mongoose.startSession();
    let bankId = "";
    let imported = 0;
    try {
      await session.withTransaction(async () => {
        const bank = await QuestionBank.findOneAndUpdate({ courseId, year }, { $setOnInsert: { courseId, year } }, { upsert: true, new: true, setDefaultsOnInsert: true, session });
        const inserted = await Question.insertMany(valid.map((item) => ({ courseId, bankId: bank._id, question: item.question, questionType: item.questionType, optionA: item.questionType === "MCQ" ? item.optionA : null, optionB: item.questionType === "MCQ" ? item.optionB : null, optionC: item.questionType === "MCQ" ? item.optionC : null, optionD: item.questionType === "MCQ" ? item.optionD : null, correctAnswer: item.correctAnswer, explanation: item.explanation || null })), { session });
        await AdminImport.create([{ courseId, bankId: bank._id, questionCount: inserted.length }], { session });
        bankId = bank._id.toString();
        imported = inserted.length;
      });
    } finally { await session.endSession(); }
    if (!imported || !bankId) throw new Error("Question import transaction did not commit.");
    return Response.json({ imported, invalid: errors.length, errors, bankId }, { status: 201 });
  } catch { return Response.json({ error: "Question import failed." }, { status: 500 }); }
}
