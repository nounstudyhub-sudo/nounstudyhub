import { connectToDatabase } from "@/db";
import { CourseView, objectIdOrNull } from "@/db/models";
import { requireUser } from "@/lib/auth";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const courseId = objectIdOrNull(id);
    if (!courseId) return Response.json({ error: "Course not found." }, { status: 404 });
    await connectToDatabase();
    await CourseView.findOneAndUpdate({ userId: user.id, courseId }, { $set: { viewedAt: new Date() } }, { upsert: true, new: true, setDefaultsOnInsert: true });
    return Response.json({ ok: true });
  } catch { return Response.json({ error: "Please log in." }, { status: 401 }); }
}
