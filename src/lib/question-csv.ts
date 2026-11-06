export const QUESTION_CSV_HEADERS = [
  "question",
  "questionType",
  "optionA",
  "optionB",
  "optionC",
  "optionD",
  "correctAnswer",
  "explanation",
] as const;

export type ImportedQuestion = {
  question: string;
  questionType: "MCQ" | "FBQ" | "TF";
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string;
  explanation: string;
};

export type ParsedQuestionCsv = {
  questions: ImportedQuestion[];
  errors: string[];
  detected: number;
};

export function parseQuestionCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let closedQuote = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    const next = input[index + 1];

    if (quoted) {
      if (character === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
        closedQuote = true;
      } else {
        cell += character;
      }
      continue;
    }

    if (closedQuote && character !== "," && character !== "\r" && character !== "\n") {
      throw new Error(`Unexpected character after a quoted CSV field at character ${index + 1}.`);
    }

    if (character === '"') {
      if (cell.length) throw new Error(`Unexpected quote in an unquoted CSV field at character ${index + 1}.`);
      quoted = true;
      continue;
    }

    if (character === ",") {
      row.push(cell);
      cell = "";
      closedQuote = false;
      continue;
    }

    if (character === "\r" || character === "\n") {
      if (character === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
      closedQuote = false;
      continue;
    }

    cell += character;
  }

  if (quoted) throw new Error("CSV contains an unterminated quoted field.");
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

export function validateQuestionCsv(input: string): ParsedQuestionCsv {
  let rows: string[][];
  try {
    rows = parseQuestionCsv(input);
  } catch (error) {
    return {
      questions: [],
      detected: 0,
      errors: [error instanceof Error ? error.message : "CSV could not be parsed."],
    };
  }

  const header = rows.shift();
  const normalizedHeader = header?.map((value, index) => {
    const clean = index === 0 ? value.replace(/^\uFEFF/, "") : value;
    return clean.trim();
  });

  if (!normalizedHeader || normalizedHeader.length !== QUESTION_CSV_HEADERS.length
    || QUESTION_CSV_HEADERS.some((value, index) => normalizedHeader[index] !== value)) {
    return {
      questions: [],
      detected: rows.length,
      errors: [`CSV header must be exactly: ${QUESTION_CSV_HEADERS.join(",")}.`],
    };
  }

  const questions: ImportedQuestion[] = [];
  const errors: string[] = [];

  rows.forEach((cells, rowIndex) => {
    const line = rowIndex + 2;
    if (cells.length !== QUESTION_CSV_HEADERS.length) {
      errors.push(`Row ${line}: expected ${QUESTION_CSV_HEADERS.length} columns, found ${cells.length}.`);
      return;
    }

    const [question, rawType, optionA, optionB, optionC, optionD, rawAnswer, explanation] =
      cells.map((value) => value.trim());
    const questionType = rawType.toUpperCase();
    const correctAnswer = questionType === "FBQ" ? rawAnswer : rawAnswer.toUpperCase();

    if (/^REVIEW REQUIRED\s*:/i.test(explanation)) {
      errors.push(`Row ${line}: ${explanation}`);
    } else if (!question) {
      errors.push(`Row ${line}: question is required.`);
    } else if (questionType !== "MCQ" && questionType !== "FBQ" && questionType !== "TF") {
      errors.push(`Row ${line}: questionType must be MCQ, FBQ or TF.`);
    } else if (!explanation) {
      errors.push(`Row ${line}: explanation is required.`);
    } else if (questionType === "MCQ" && (!optionA || !optionB || !optionC || !optionD)) {
      errors.push(`Row ${line}: MCQs require all four non-empty options.`);
    } else if (questionType === "MCQ"
      && new Set([optionA, optionB, optionC, optionD].map((option) => option.toLocaleLowerCase())).size !== 4) {
      errors.push(`Row ${line}: MCQ options must be unique.`);
    } else if (questionType === "TF"
      && (optionA.toLowerCase() !== "true" || optionB.toLowerCase() !== "false" || optionC || optionD)) {
      errors.push(`Row ${line}: TF questions require True and False in options A and B, with C and D empty.`);
    } else if (questionType === "TF" && !["A", "B"].includes(correctAnswer)) {
      errors.push(`Row ${line}: TF correctAnswer must be A or B.`);
    } else if ((questionType === "MCQ" || questionType === "TF")
      && !["A", "B", "C", "D"].includes(correctAnswer)) {
      errors.push(`Row ${line}: MCQ correctAnswer must be A, B, C or D.`);
    } else if (questionType === "FBQ" && !correctAnswer) {
      errors.push(`Row ${line}: FBQ correctAnswer must contain the missing word or phrase.`);
    } else {
      questions.push({
        question,
        questionType: questionType as ImportedQuestion["questionType"],
        optionA,
        optionB,
        optionC,
        optionD,
        correctAnswer,
        explanation,
      });
    }
  });

  return { questions, errors, detected: rows.length };
}

export function stringifyQuestionCsv(rows: readonly (readonly unknown[])[]) {
  return rows
    .map((row) => row.map((value) => {
      const text = String(value ?? "");
      return `"${text.replaceAll('"', '""')}"`;
    }).join(","))
    .join("\r\n");
}

export function getImportErrorMessage(value: unknown, fallback: string) {
  if (!value || typeof value !== "object") return fallback;
  const payload = value as { error?: unknown; errors?: unknown };
  const message = typeof payload.error === "string" ? payload.error : fallback;
  const rowErrors = Array.isArray(payload.errors)
    ? payload.errors.filter((error): error is string => typeof error === "string")
    : [];
  return rowErrors.length ? `${message} ${rowErrors.join(" ")}` : message;
}
