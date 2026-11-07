import mongoose from "mongoose";
import { connectToDatabase } from "@/db";
import { Course, MockAnswer, MockAttempt, objectIdOrNull } from "@/db/models";
import { requireUser } from "@/lib/auth";
import { aiErrorResponse, aiText, generateAiResponse } from "@/lib/ai";
import { prepareAiPracticeQuestions, type GeneratedPracticeQuestion } from "@/lib/ai-practice-questions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return Response.json({ error: "Invalid request body." }, { status: 400 });
    const user = await requireUser();
    const courseId = objectIdOrNull(body.courseId);
    if (!courseId) return Response.json({ error: "Select a course for AI practice." }, { status: 400 });
    await connectToDatabase();
    const course = await Course.findById(courseId).select("code title").lean();
    if (!course) return Response.json({ error: "Course not found." }, { status: 404 });

    const topic = aiText(body.topic, 300);
    if (!topic) return Response.json({ error: "Provide a topic for practice questions." }, { status: 400 });

    const count = Number(body.count ?? 10);
    if (![10, 20, 30, 40, 50].includes(count)) {
      return Response.json({ error: "Choose 10, 20, 30, 40 or 50 practice questions." }, { status: 400 });
    }
    const requestedType = body.questionType ?? "MIXED";
    if (requestedType !== "MCQ" && requestedType !== "FBQ" && requestedType !== "MIXED") {
      return Response.json({ error: "Question type must be MCQ, FBQ or MIXED." }, { status: 400 });
    }

    const difficulty = ["introductory", "intermediate", "advanced"].includes(String(body.difficulty))
      ? String(body.difficulty)
      : "intermediate";
    const trueFalseCount = Math.max(1, Math.round(count * 0.1));
    const fillInBlankCount = Math.round(count * 0.2);
    const sourceMcqCount = count - trueFalseCount;
    const typeInstructions = requestedType === "MIXED"
      ? `Return exactly ${sourceMcqCount} MCQ and ${trueFalseCount} TF questions. The application will convert exactly ${fillInBlankCount} of your MCQs into FBQs.`
      : `Return exactly ${sourceMcqCount} MCQ and ${trueFalseCount} TF questions.`;
    const result = await generateAiResponse({
      feature: "practice",
      responseMimeType: "application/json",
      maxOutputTokens: Math.min(30000, count * 550),
      prompt: [
        `Create exactly ${count} original ${difficulty} practice questions about the supplied topic. ${typeInstructions}`,
        "Return only valid JSON with this shape: {\"questions\":[{\"questionType\":\"MCQ\"|\"TF\",\"question\":string,\"options\":{\"A\":string,\"B\":string,\"C\":string,\"D\":string},\"correctAnswer\":\"A\"|\"B\"|\"C\"|\"D\",\"explanation\":string}]}",
        "For TF questions set options A and B to exactly True and False, leave C and D empty strings, and use correctAnswer A or B. For MCQ questions provide four distinct, non-empty options and use the exact correct option letter.",
        "Each question must have one clear, uniquely correct answer. Do not copy known exam questions. Avoid Markdown asterisks in explanations.",
        "These are suggestions only; do not create or modify a CBT attempt or question bank.",
        `Course: ${course.code} — ${course.title}`,
        `Topic: <student_input>${topic}</student_input>`,
      ].join("\n\n"),
    });

    let practice: { questions?: unknown };
    try {
      practice = JSON.parse(result.text) as { questions?: unknown };
    } catch {
      return Response.json({ error: "The AI returned an invalid practice-question response." }, { status: 502 });
    }
    if (!Array.isArray(practice.questions) || practice.questions.length !== count) {
      return Response.json({ error: "The AI returned an invalid practice-question response." }, { status: 502 });
    }
    const validQuestions = practice.questions.every((item) => {
      if (!item || typeof item !== "object") return false;
      const question = item as Record<string, unknown>;
      const options = question.options as Record<string, unknown> | null;
      const questionType = question.questionType;
      const isTrueFalse = questionType === "TF";
      return typeof question.question === "string"
        && question.question.trim().length > 0
        && (questionType === "MCQ" || isTrueFalse)
        && !!options
        && (isTrueFalse
          ? options.A === "True" && options.B === "False" && options.C === "" && options.D === "" && ["A", "B"].includes(String(question.correctAnswer))
          : ["A", "B", "C", "D"].every((key) => typeof options[key] === "string" && (options[key] as string).trim().length > 0)
            && new Set(["A", "B", "C", "D"].map((key) => String(options[key]).trim().toLowerCase())).size === 4
            && ["A", "B", "C", "D"].includes(String(question.correctAnswer)))
        && typeof question.explanation === "string"
        && question.explanation.trim().length > 0;
    });
    if (!validQuestions) return Response.json({ error: "The AI returned an invalid practice-question response." }, { status: 502 });

    const generatedQuestions = practice.questions as {
      questionType: "MCQ" | "TF";
      question: string;
      options: Record<"A" | "B" | "C" | "D", string>;
      correctAnswer: string;
      explanation: string;
    }[];
    const actualTfCount = generatedQuestions.filter((question) => question.questionType === "TF").length;
    if (actualTfCount !== trueFalseCount) {
      return Response.json({ error: "The AI returned an invalid practice-question response." }, { status: 502 });
    }
    if (generatedQuestions.filter((question) => question.questionType === "MCQ").length !== sourceMcqCount) {
      return Response.json({ error: "The AI returned an invalid practice-question response." }, { status: 502 });
    }
    const sessionQuestions = prepareAiPracticeQuestions(
      generatedQuestions as GeneratedPracticeQuestion[],
      requestedType,
      count,
    );
    const session = await mongoose.startSession();
    let attemptId = "";
    try {
      await session.withTransaction(async () => {
        const [attempt] = await MockAttempt.create([{
          userId: user.id,
          courseId: course._id,
          type: "AI_PRACTICE",
          topic,
          totalQuestions: count,
          timeLimit: count,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        }], { session });
        await MockAnswer.insertMany(sessionQuestions.map((question, position) => ({
          attemptId: attempt._id,
          position,
          questionType: question.questionType,
          correctAnswer: question.correctAnswer,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          questionSnapshot: {
            question: question.question,
            questionType: question.questionType,
            optionA: question.options.A || null,
            optionB: question.options.B || null,
            optionC: question.options.C || null,
            optionD: question.options.D || null,
            explanation: question.explanation,
          },
        })), { session });
        attemptId = attempt._id.toString();
      });
    } finally {
      await session.endSession();
    }
    if (!attemptId) throw new Error("AI practice attempt transaction did not commit.");

    return Response.json({ attemptId, practice: { questions: sessionQuestions }, course: { code: course.code, title: course.title }, usage: result.usage });
  } catch (error) {
    return aiErrorResponse(error);
  }
}
