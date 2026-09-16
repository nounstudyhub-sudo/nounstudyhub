import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { adminImports, questionBanks, questions } from "@/db/schema";
import { requireAdmin, safeText } from "@/lib/auth";

type CsvRow = { question: string; optionA: string; optionB: string; optionC: string; optionD: string; correctAnswer: string; explanation: string };

function parseCsv(input: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  for (let i = 0; i < input.length; i += 1) { const char = input[i]; const next = input[i + 1]; if (char === '"' && quoted && next === '"') { cell += '"'; i += 1; } else if (char === '"') quoted = !quoted; else if (char === "," && !quoted) { row.push(cell); cell = ""; } else if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && next === "\n") i += 1; row.push(cell); if (row.some((item) => item.trim())) rows.push(row); row = []; cell = ""; } else cell += char; }
  row.push(cell); if (row.some((item) => item.trim())) rows.push(row); return rows;
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json().catch(() => ({}));
    const courseId = safeText(body.courseId, 50); const year = Number(body.year); const csv = String(body.csv ?? "");
    const rows = parseCsv(csv);
    const header = rows.shift()?.map((item) => item.trim().toLowerCase());
    const required = ["question", "optiona", "optionb", "optionc", "optiond", "correctanswer"];
    if (!header || required.some((key) => !header.includes(key))) return Response.json({ error: "CSV format invalid. Required columns: question, optionA, optionB, optionC, optionD, correctAnswer (explanation optional)." }, { status: 400 });
    const index = Object.fromEntries(required.map((key) => [key, header.indexOf(key)]));
    const explanationIndex = header.indexOf("explanation");
    const valid: CsvRow[] = []; const errors: string[] = [];
    rows.forEach((cells, rowIndex) => {
      const item = { question: cells[index.question]?.trim(), optionA: cells[index.optiona]?.trim(), optionB: cells[index.optionb]?.trim(), optionC: cells[index.optionc]?.trim(), optionD: cells[index.optiond]?.trim(), correctAnswer: cells[index.correctanswer]?.trim().toUpperCase(), explanation: explanationIndex >= 0 ? (cells[explanationIndex]?.trim() ?? "") : "" } as CsvRow;
      if (!item.question || !item.optionA || !item.optionB || !item.optionC || !item.optionD) errors.push(`Row ${rowIndex + 2}: missing required field.`);
      else if (!["A", "B", "C", "D"].includes(item.correctAnswer)) errors.push(`Row ${rowIndex + 2}: correctAnswer must be A, B, C or D.`);
      else valid.push(item);
    });
    if (!courseId || !Number.isInteger(year)) return Response.json({ error: "Select a course and valid question-bank year." }, { status: 400 });
    if (!valid.length) return Response.json({ error: "No valid questions detected.", detected: rows.length, errors }, { status: 400 });
    let [bank] = await db.select().from(questionBanks).where(and(eq(questionBanks.courseId, courseId), eq(questionBanks.year, year))).limit(1);
    if (!bank) [bank] = await db.insert(questionBanks).values({ courseId, year }).returning();
    const inserted = await db.insert(questions).values(valid.map((item) => ({ courseId, bankId: bank.id, question: item.question, optionA: item.optionA, optionB: item.optionB, optionC: item.optionC, optionD: item.optionD, correctAnswer: item.correctAnswer, explanation: item.explanation || null }))).returning({ id: questions.id });
    await db.insert(adminImports).values({ courseId, bankId: bank.id, questionCount: inserted.length });
    return Response.json({ imported: inserted.length, invalid: errors.length, errors, bankId: bank.id }, { status: 201 });
  } catch { return Response.json({ error: "Question import failed." }, { status: 500 }); }
}
