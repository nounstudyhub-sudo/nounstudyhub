import mongoose from "mongoose";
import { connectToDatabase } from "@/db";
import { Course, MockAnswer, MockAttempt, objectIdOrNull } from "@/db/models";
import { requireUser } from "@/lib/auth";
import { aiErrorResponse, aiText, generateAiResponse } from "@/lib/ai";

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

    const count = Number(body.count ?? 5);
    if (![10, 20, 30, 40, 50].includes(count)) {
      return Response.json({ error: "Choose 10, 20, 30, 40 or 50 practice questions." }, { status: 400 });
    }

    const difficulty = ["introductory", "intermediate", "advanced"].includes(String(body.difficulty))
      ? String(body.difficulty)
      : "intermediate";
    const result = await generateAiResponse({
      feature: "practice",
      responseMimeType: "application/json",
      maxOutputTokens: 9000,
      prompt: [
        `Create ${count} original ${difficulty} multiple-choice practice questions about the supplied topic.`,
        "Return only valid JSON with this shape: {\"questions\":[{\"question\":string,\"options\":{\"A\":string,\"B\":string,\"C\":string,\"D\":string},\"correctAnswer\":\"A\"|\"B\"|\"C\"|\"D\",\"explanation\":string}]}",
        "Ensure exactly one correct answer for each question and do not copy known exam questions.",
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
      return typeof question.question === "string"
        && question.question.trim().length > 0
        && !!options
        && ["A", "B", "C", "D"].every((key) => {
          const option = options[key];
          return typeof option === "string" && option.trim().length > 0;
        })
        && ["A", "B", "C", "D"].includes(String(question.correctAnswer))
        && typeof question.explanation === "string"
        && question.explanation.trim().length > 0;
    });
    if (!validQuestions) return Response.json({ error: "The AI returned an invalid practice-question response." }, { status: 502 });

    const generatedQuestions = practice.questions as {
      question: string;
      options: Record<"A" | "B" | "C" | "D", string>;
      correctAnswer: "A" | "B" | "C" | "D";
      explanation: string;
    }[];
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
          timeLimit: 1440,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        }], { session });
        await MockAnswer.insertMany(generatedQuestions.map((question, position) => ({
          attemptId: attempt._id,
          position,
          questionType: "MCQ",
          correctAnswer: question.correctAnswer,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          questionSnapshot: {
            question: question.question,
            questionType: "MCQ",
            optionA: question.options.A,
            optionB: question.options.B,
            optionC: question.options.C,
            optionD: question.options.D,
            explanation: question.explanation,
          },
        })), { session });
        attemptId = attempt._id.toString();
      });
    } finally {
      await session.endSession();
    }
    if (!attemptId) throw new Error("AI practice attempt transaction did not commit.");

    return Response.json({ attemptId, practice, course: { code: course.code, title: course.title }, usage: result.usage });
  } catch (error) {
    return aiErrorResponse(error);
  }
}
