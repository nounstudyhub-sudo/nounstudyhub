import mongoose from "mongoose";
import { connectToDatabase } from "@/db";
import { Course, FlaggedQuestion, MockAnswer, MockAttempt, Question, QuestionBank, objectIdOrNull, withId } from "@/db/models";
import { requireUser } from "@/lib/auth";
import {
  inferMockQuestionType,
  prepareMockQuestion,
  type MockQuestionType,
  type StoredMockQuestion,
} from "@/lib/mock-question-types";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    let payload: unknown;
    try { payload = await request.json(); }
    catch { return Response.json({ error: "Invalid JSON payload." }, { status: 400 }); }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return Response.json({ error: "Invalid request payload." }, { status: 400 });
    const { courseId, questionCount, timeLimit, year, questionType = "MIXED" } = payload as Record<string, unknown>;
    if (typeof courseId !== "string" || !objectIdOrNull(courseId)) return Response.json({ error: "A valid course ID is required." }, { status: 400 });
    if (!Number.isInteger(questionCount) || Number(questionCount) < 1 || Number(questionCount) > 500) return Response.json({ error: "Question count must be an integer from 1 to 500." }, { status: 400 });
    if (!Number.isInteger(timeLimit) || Number(timeLimit) < 1 || Number(timeLimit) > 1440) return Response.json({ error: "Time limit must be an integer from 1 to 1440 minutes." }, { status: 400 });
    if (questionType !== "MCQ" && questionType !== "FBQ" && questionType !== "MIXED") return Response.json({ error: "Question type must be MCQ, FBQ or MIXED." }, { status: 400 });
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
    const baseFilter = { courseId: course._id, ...(bank ? { bankId: bank._id } : {}) };
    const trueFalseFilter = {
      $and: [
        { questionType: { $ne: "FBQ" } },
        {
          $or: [
            { questionType: { $in: ["TF", "TRUE_FALSE"] } },
            { optionA: /^true$/i, optionB: /^false$/i },
          ],
        },
      ],
    };
    const multipleChoiceFilter = {
      $and: [
        { questionType: { $nin: ["FBQ", "TF", "TRUE_FALSE"] } },
        { $nor: [{ optionA: /^true$/i, optionB: /^false$/i }] },
      ],
    };
    const sample = async (filter: Record<string, unknown>, size: number) => size > 0
      ? Question.aggregate<StoredMockQuestion>([
        { $match: filter },
        { $sample: { size } },
      ])
      : [];
    let candidates: { question: StoredMockQuestion; type: MockQuestionType }[];

    if (questionType === "MIXED") {
      const fillInBlankCount = Math.round(count * 0.2);
      const trueFalseCount = Math.round(count * 0.1);
      const multipleChoiceCount = count - fillInBlankCount - trueFalseCount;
      const [trueFalse, existingFillInBlank, multipleChoice] = await Promise.all([
        sample({ $and: [baseFilter, trueFalseFilter] }, trueFalseCount),
        sample({ $and: [baseFilter, { questionType: "FBQ" }] }, fillInBlankCount),
        sample({ $and: [baseFilter, multipleChoiceFilter] }, Math.min(count * 2, 1000)),
      ]);

      const chosenFbq = existingFillInBlank.map((question) => ({ question, type: "FBQ" as const }));
      const mcqForFbqCount = Math.max(0, fillInBlankCount - chosenFbq.length);
      chosenFbq.push(...multipleChoice.slice(0, mcqForFbqCount).map((question) => ({ question, type: "FBQ" as const })));
      const chosenMcq = multipleChoice
        .slice(mcqForFbqCount, mcqForFbqCount + multipleChoiceCount)
        .map((question) => ({ question, type: "MCQ" as const }));
      candidates = [
        ...chosenMcq,
        ...chosenFbq,
        ...trueFalse.map((question) => ({ question, type: "TF" as const })),
      ];
    } else {
      const filter = questionType === "FBQ"
        ? baseFilter
        : { $and: [baseFilter, { questionType: { $ne: "FBQ" } }] };
      const chosen = await sample(filter, count);
      candidates = chosen.map((question) => {
        const storedType = inferMockQuestionType(question);
        const type = questionType === "FBQ" && storedType === "MCQ" ? "FBQ" : storedType;
        return { question, type };
      });
    }

    if (candidates.length < count) {
      const existing = candidates.map(({ question }) => question._id);
      const fallback = await sample({ $and: [baseFilter, { _id: { $nin: [...existing] } }] }, count - candidates.length);
      candidates.push(...fallback
        .map((question) => ({ question, type: inferMockQuestionType(question) })));
    }
    if (candidates.length < count) {
      const available = await Question.countDocuments(questionType === "MCQ"
        ? { $and: [baseFilter, { questionType: { $ne: "FBQ" } }] }
        : baseFilter);
      return Response.json({ error: `Not enough questions available. This course has ${available}.` }, { status: 400 });
    }
    for (let index = candidates.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      const swap = candidates[index];
      candidates[index] = candidates[swapIndex];
      candidates[swapIndex] = swap;
    }
    const selected = candidates.slice(0, count).map(({ question, type }) => ({
      source: question,
      prepared: prepareMockQuestion(question, type),
    }));
    const existingFlags = await FlaggedQuestion.find({
      userId: user.id,
      questionId: { $in: selected.map(({ source }) => source._id) },
    }).select("questionId").lean();
    const session = await mongoose.startSession();
    let attemptId = "";
    try {
      await session.withTransaction(async () => {
        const [attempt] = await MockAttempt.create([{ userId: user.id, courseId: course._id, totalQuestions: count, timeLimit: minutes }], { session });
        await MockAnswer.insertMany(selected.map(({ source, prepared }, index) => ({
          attemptId: attempt._id,
          questionId: source._id,
          position: index,
          questionType: prepared.questionType,
          correctAnswer: prepared.correctAnswer,
          ...(prepared.questionType === "FBQ" && inferMockQuestionType(source) !== "FBQ"
            ? { questionSnapshot: prepared.snapshot }
            : {}),
        })), { session });
        attemptId = attempt._id.toString();
      });
    } finally { await session.endSession(); }
    if (!attemptId) throw new Error("Mock start transaction did not commit.");
    return Response.json({ attemptId, course: withId(course), questions: selected.map(({ prepared }, index) => ({
      id: prepared.id,
      position: index,
      questionType: prepared.questionType,
      question: prepared.question,
      ...(prepared.options ? { options: prepared.options } : {}),
    })), flaggedQuestionIds: existingFlags.map((flag) => String(flag.questionId)) });
  } catch { return Response.json({ error: "Could not start mock." }, { status: 500 }); }
}
