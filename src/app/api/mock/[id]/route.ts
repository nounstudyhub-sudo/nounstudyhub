import { connectToDatabase } from "@/db";
import { MockAnswer, MockAttempt, objectIdOrNull, idString, withId } from "@/db/models";
import { requireUser } from "@/lib/auth";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(); const { id } = await params;
    await connectToDatabase();
    const attemptId = objectIdOrNull(id);
    if (!attemptId) return Response.json({ error: "Attempt not found." }, { status: 404 });
    const attempt = await MockAttempt.findOne({ _id: attemptId, userId: user.id }).populate("courseId").lean();
    if (!attempt) return Response.json({ error: "Attempt not found." }, { status: 404 });
    if (!attempt.submittedAt) return Response.json({ error: "Review is available after submission." }, { status: 403 });
    const answerRows = await MockAnswer.find({ attemptId }).populate("questionId").sort({ position: 1 }).lean();
    const answers = answerRows.map((answer) => {
      const question = answer.questionSnapshot?.question
        ? {
          ...answer.questionSnapshot,
          id: answer.questionId ? idString((answer.questionId as unknown as { _id: unknown })._id) : null,
        }
        : answer.questionId
          ? withId(answer.questionId as unknown as { _id: unknown })
          : answer.questionSnapshot;
      if (!question?.question) throw new Error("Saved review question is missing.");
      return {
        answer: { ...withId(answer), attemptId: idString(answer.attemptId), questionId: answer.questionId ? idString((answer.questionId as unknown as { _id: unknown })._id) : null },
        question,
      };
    });
    const course = attempt.courseId as unknown as { _id: unknown };
    return Response.json({ attempt: { ...withId(attempt), type: attempt.type ?? "PAST_QUESTION", courseId: idString(course._id) }, course: withId(course), answers });
  } catch { return Response.json({ error: "Please log in." }, { status: 401 }); }
}
