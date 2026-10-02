import { connectToDatabase } from "@/db";
import { Course, objectIdOrNull } from "@/db/models";
import { requireUser } from "@/lib/auth";
import { aiErrorResponse, aiText, generateAiResponse } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return Response.json({ error: "Invalid request body." }, { status: 400 });
    await requireUser();
    const courseId = objectIdOrNull(body.courseId);
    if (!courseId) return Response.json({ error: "Select a course for AI practice." }, { status: 400 });
    await connectToDatabase();
    const course = await Course.findById(courseId).select("code title").lean();
    if (!course) return Response.json({ error: "Course not found." }, { status: 404 });

    const topic = aiText(body.topic, 300);
    if (!topic) return Response.json({ error: "Provide a topic for practice questions." }, { status: 400 });

    const count = Number(body.count ?? 5);
    if (!Number.isInteger(count) || count < 1 || count > 10) {
      return Response.json({ error: "Question count must be between 1 and 10." }, { status: 400 });
    }

    const difficulty = ["introductory", "intermediate", "advanced"].includes(String(body.difficulty))
      ? String(body.difficulty)
      : "intermediate";
    const result = await generateAiResponse({
      feature: "practice",
      responseMimeType: "application/json",
      maxOutputTokens: 2200,
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
        && !!options
        && ["A", "B", "C", "D"].every((key) => typeof options[key] === "string")
        && ["A", "B", "C", "D"].includes(String(question.correctAnswer))
        && typeof question.explanation === "string";
    });
    if (!validQuestions) return Response.json({ error: "The AI returned an invalid practice-question response." }, { status: 502 });

    return Response.json({ practice, course: { code: course.code, title: course.title }, usage: result.usage });
  } catch (error) {
    return aiErrorResponse(error);
  }
}
