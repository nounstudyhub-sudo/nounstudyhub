import assert from "node:assert/strict";
import test from "node:test";
import csvPrompt from "../app/admin/question-csv-prompt";
import {
  QUESTION_CSV_HEADERS,
  parseQuestionCsv,
  stringifyQuestionCsv,
  validateQuestionCsv,
} from "./question-csv";
import { stripMarkdownAsterisks } from "./ai-text";
import { inferMockQuestionType, prepareMockQuestion } from "./mock-question-types";

const validQuestion = [
  "Which term describes the next best alternative forgone?",
  "MCQ",
  "Scarcity",
  "Opportunity cost",
  "Profit",
  "Revenue",
  "B",
  "Opportunity cost is the value of the next best alternative not chosen.",
];

test("accepts the exact header order and maps the answer letter to four non-empty options", () => {
  const result = validateQuestionCsv(stringifyQuestionCsv([QUESTION_CSV_HEADERS, validQuestion]));
  assert.deepEqual(result.errors, []);
  assert.equal(result.questions.length, 1);
  assert.equal(result.questions[0].optionA, "Scarcity");
  assert.equal(result.questions[0].optionD, "Revenue");
  assert.equal(result.questions[0].correctAnswer, "B");
  assert.equal(result.questions[0].explanation, validQuestion[7]);
});

test("accepts true/false rows with only the True and False options", () => {
  const trueFalse = ["Is water composed of hydrogen and oxygen?", "TF", "True", "False", "", "", "A", "You can identify water by its H2O composition."];
  const result = validateQuestionCsv(stringifyQuestionCsv([QUESTION_CSV_HEADERS, trueFalse]));

  assert.deepEqual(result.errors, []);
  assert.equal(result.questions[0].questionType, "TF");
  assert.equal(result.questions[0].optionC, "");
  assert.equal(result.questions[0].optionD, "");
  assert.equal(result.questions[0].correctAnswer, "A");
});

test("rejects malformed true/false options and answer keys", () => {
  const invalidOptions = ["Is water composed of hydrogen and oxygen?", "TF", "Yes", "No", "", "", "A", "You can check its chemical formula."];
  const invalidAnswer = ["Is water composed of hydrogen and oxygen?", "TF", "True", "False", "", "", "C", "You can check its chemical formula."];

  assert.match(validateQuestionCsv(stringifyQuestionCsv([QUESTION_CSV_HEADERS, invalidOptions])).errors[0], /TF questions require True and False/);
  assert.match(validateQuestionCsv(stringifyQuestionCsv([QUESTION_CSV_HEADERS, invalidAnswer])).errors[0], /TF correctAnswer must be A or B/);
});

test("converts MCQs to fill-in-the-blank questions with the option text as the key", () => {
  const prepared = prepareMockQuestion({
    _id: { toString: () => "question-1" },
    question: "The opportunity cost is the value of the next best alternative forgone.",
    questionType: "MCQ",
    optionA: "Profit",
    optionB: "Opportunity cost",
    optionC: "Revenue",
    optionD: "Demand",
    correctAnswer: "B",
  }, "FBQ");

  assert.equal(prepared.questionType, "FBQ");
  assert.equal(prepared.correctAnswer, "Opportunity cost");
  assert.equal(prepared.question, "The _____ is the value of the next best alternative forgone.");
  assert.equal(prepared.options, undefined);
  assert.equal(prepared.snapshot.optionA, null);
});

test("adds a visible blank when the MCQ answer text is not present in the question stem", () => {
  const prepared = prepareMockQuestion({
    _id: { toString: () => "question-3" },
    question: "What is the next best alternative forgone called?",
    questionType: "MCQ",
    optionA: "Profit",
    optionB: "Opportunity cost",
    optionC: "Revenue",
    optionD: "Demand",
    correctAnswer: "B",
  }, "FBQ");

  assert.equal(prepared.question, "What is the next best alternative forgone called?\n\nAnswer: _____");
  assert.equal(prepared.correctAnswer, "Opportunity cost");
});

test("recognizes true/false source records and strips Markdown asterisks from explanations", () => {
  const trueFalseQuestion = {
    _id: { toString: () => "question-2" },
    question: "A statement",
    optionA: "True",
    optionB: "False",
    correctAnswer: "True",
  };
  assert.equal(inferMockQuestionType(trueFalseQuestion), "TF");
  assert.equal(prepareMockQuestion(trueFalseQuestion, "TF").correctAnswer, "A");
  assert.equal(stripMarkdownAsterisks("You chose **A**. It is *correct*."), "You chose A. It is correct.");
});

test("rejects missing, reordered, and extra header columns", () => {
  const headers = [...QUESTION_CSV_HEADERS];
  const missing = headers.slice(0, -1);
  const reordered = [headers[1], headers[0], ...headers.slice(2)];
  const extra = [...headers, "notes"];

  for (const header of [missing, reordered, extra]) {
    const result = validateQuestionCsv(stringifyQuestionCsv([header, validQuestion]));
    assert.match(result.errors[0], /header must be exactly/);
  }
});

test("rejects blank and duplicate MCQ options and malformed answer letters", () => {
  const blankOption = [...validQuestion];
  blankOption[4] = "";
  const duplicateOption = [...validQuestion];
  duplicateOption[4] = "Scarcity";
  const invalidAnswer = [...validQuestion];
  invalidAnswer[6] = "Option B";

  assert.match(validateQuestionCsv(stringifyQuestionCsv([QUESTION_CSV_HEADERS, blankOption])).errors[0], /four non-empty options/);
  assert.match(validateQuestionCsv(stringifyQuestionCsv([QUESTION_CSV_HEADERS, duplicateOption])).errors[0], /must be unique/);
  assert.match(validateQuestionCsv(stringifyQuestionCsv([QUESTION_CSV_HEADERS, invalidAnswer])).errors[0], /must be A, B, C or D/);
});

test("rejects missing explanations and rows with the wrong number of columns", () => {
  const missingExplanation = [...validQuestion];
  missingExplanation[7] = "";
  const extraCell = [...validQuestion, "unexpected"];

  assert.match(validateQuestionCsv(stringifyQuestionCsv([QUESTION_CSV_HEADERS, missingExplanation])).errors[0], /explanation is required/);
  assert.match(validateQuestionCsv(stringifyQuestionCsv([QUESTION_CSV_HEADERS, extraCell])).errors[0], /expected 8 columns, found 9/);
});

test("CSV escaping round-trips commas, quotes, and embedded newlines", () => {
  const question = [...validQuestion];
  question[0] = 'Which statement includes "supply, demand"?\nChoose one.';
  question[1] = 'MCQ';
  question[3] = 'Option, with comma and "quoted text"';
  const csv = stringifyQuestionCsv([QUESTION_CSV_HEADERS, question]);

  assert.match(csv, /\r\n/);
  assert.equal(parseQuestionCsv(csv)[1][0], question[0]);
  assert.equal(parseQuestionCsv(csv)[1][3], question[3]);
  assert.deepEqual(validateQuestionCsv(csv).errors, []);
});

test("rejects unterminated and malformed quoted CSV", () => {
  const unterminated = `${stringifyQuestionCsv([QUESTION_CSV_HEADERS])}\r\n"unfinished`;
  const misplacedQuote = `${stringifyQuestionCsv([QUESTION_CSV_HEADERS])}\r\nbad"quote,MCQ`;

  assert.match(validateQuestionCsv(unterminated).errors[0], /unterminated quoted field/);
  assert.match(validateQuestionCsv(misplacedQuote).errors[0], /Unexpected quote/);
});

test("flags an uncertain key row for review instead of accepting it", () => {
  const uncertain = [...validQuestion];
  uncertain[6] = "";
  uncertain[7] = "REVIEW REQUIRED: the printed answer is unreadable.";

  const result = validateQuestionCsv(stringifyQuestionCsv([QUESTION_CSV_HEADERS, uncertain]));
  assert.equal(result.questions.length, 0);
  assert.match(result.errors[0], /Row 2: REVIEW REQUIRED: the printed answer is unreadable/);
});

test("an unreadable PDF result with only the header contains no importable questions", () => {
  const result = validateQuestionCsv(stringifyQuestionCsv([QUESTION_CSV_HEADERS]));
  assert.deepEqual(result.errors, []);
  assert.equal(result.detected, 0);
  assert.equal(result.questions.length, 0);
  assert.match(csvPrompt, /if the PDF is unreadable; return only the header/);
});

test("prompt instructs verification of printed keys, fill-in-the-blank conversion, and uncertainty review", () => {
  assert.match(csvPrompt, /bold, dark answer printed beneath each question/);
  assert.match(csvPrompt, /do not blindly trust the printed key/);
  assert.match(csvPrompt, /clearly wrong and.*high confidence/);
  assert.match(csvPrompt, /If the corrected answer is not among the supplied choices, replace the incorrect choice with it/);
  assert.match(csvPrompt, /Check that answer against reliable subject knowledge/);
  assert.match(csvPrompt, /Preserve each original fill-in-the-blank in the question text/);
  assert.match(csvPrompt, /exactly four non-empty, distinct/);
  assert.match(csvPrompt, /REVIEW REQUIRED/);
  assert.match(csvPrompt, /exactly eight fields/);
  assert.match(csvPrompt, /questionType to TF/);
  assert.match(csvPrompt, /Do not use Markdown asterisks/);
  assert.doesNotMatch(csvPrompt, /exactly 7 commas/i);
});
