import { connectToDatabase } from "@/db";
import { FlaggedQuestion, idString, withId } from "@/db/models";
import { requireAdmin } from "@/lib/auth";

async function listFlaggedQuestions() {
  try {
    await requireAdmin();
    await connectToDatabase();
    const rows = await FlaggedQuestion.find()
      .sort({ createdAt: -1 })
      .populate("questionId")
      .populate("courseId", "code title")
      .populate("userId", "username matriculationNumber")
      .lean();
    const flaggedQuestions = rows.map((row) => {
      const populated = row as unknown as {
        _id: unknown;
        questionId: ({ _id: unknown; question: string; questionType: string; optionA: string | null; optionB: string | null; optionC: string | null; optionD: string | null; correctAnswer: string } | null);
        courseId: ({ _id: unknown; code: string; title: string } | null);
        userId: ({ _id: unknown; username: string; matriculationNumber: string } | null);
        status: string;
        reason: string;
        createdAt: Date;
      };
      return {
        id: idString(populated._id),
        questionId: populated.questionId ? withId(populated.questionId) : null,
        course: populated.courseId ? withId(populated.courseId) : null,
        user: populated.userId ? withId(populated.userId) : null,
        status: populated.status,
        reason: populated.reason,
        createdAt: populated.createdAt,
      };
    });
    return Response.json({ flaggedQuestions });
  } catch { return Response.json({ error: "Admin access required." }, { status: 401 }); }
}

export async function GET() { return listFlaggedQuestions(); }
export async function POST() { return listFlaggedQuestions(); }
