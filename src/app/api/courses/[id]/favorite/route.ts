import { connectToDatabase } from "@/db";
import { Course, Favorite, objectIdOrNull } from "@/db/models";
import { requireUser } from "@/lib/auth";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { favorite } = await request.json();
    if (typeof favorite !== "boolean") return Response.json({ error: "Choose whether to save or remove this course." }, { status: 400 });
    const { id } = await params;
    const courseId = objectIdOrNull(id);
    if (!courseId) return Response.json({ error: "Course not found." }, { status: 404 });
    await connectToDatabase();
    if (!await Course.exists({ _id: courseId })) return Response.json({ error: "Course not found." }, { status: 404 });
    if (favorite) await Favorite.updateOne({ userId: user.id, courseId }, { $setOnInsert: { userId: user.id, courseId } }, { upsert: true });
    else await Favorite.deleteOne({ userId: user.id, courseId });
    return Response.json({ favorite });
  } catch { return Response.json({ error: "Please log in." }, { status: 401 }); }
}
