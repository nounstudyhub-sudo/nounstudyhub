import { connectToDatabase } from "@/db";
import { Course, MockAnswer, MockAttempt, Question, objectIdOrNull, withId } from "@/db/models";
import { requireUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const { courseId, questionCount, timeLimit } = await request.json();
    await connectToDatabase();
    const count = Math.max(1, Math.floor(Number(questionCount)));
    const minutes = Math.max(1, Math.floor(Number(timeLimit)));
    const courseObjectId = objectIdOrNull(courseId);
    if (!courseObjectId) return Response.json({ error: "Course not found." }, { status: 404 });
    const course = await Course.findById(courseObjectId).lean();
    if (!course) return Response.json({ error: "Course not found." }, { status: 404 });
    const all = await Question.find({ courseId: course._id }).sort({ createdAt: 1 }).lean();
    if (all.length < count) return Response.json({ error: `Not enough questions available. This course has ${all.length}.` }, { status: 400 });
    const selected = [...all].sort(() => Math.random() - 0.5).slice(0, count);
    const attempt = await MockAttempt.create({ userId: user.id, courseId: course._id, totalQuestions: count, timeLimit: minutes });
    await MockAnswer.insertMany(selected.map((question, index) => ({ attemptId: attempt._id, questionId: question._id, position: index, correctAnswer: question.correctAnswer })));
    return Response.json({ attemptId: attempt._id.toString(), course: withId(course), questions: selected.map((question, index) => ({ id: question._id.toString(), position: index, question: question.question, options: { A: question.optionA, B: question.optionB, C: question.optionC, D: question.optionD } })) });
  } catch { return Response.json({ error: "Could not start mock." }, { status: 500 }); }
}
