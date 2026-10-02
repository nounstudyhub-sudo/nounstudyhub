import { connectToDatabase } from "@/db";
import { Favorite, objectIdOrNull } from "@/db/models";
import { requireUser } from "@/lib/auth";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const courseId = objectIdOrNull(id);
    if (!courseId) return Response.json({ error: "Course not found." }, { status: 404 });
    await connectToDatabase();
    const existing = await Favorite.findOneAndDelete({ userId: user.id, courseId });
    if (existing) return Response.json({ favorite: false });
    await Favorite.create({ userId: user.id, courseId });
    return Response.json({ favorite: true });
  } catch { return Response.json({ error: "Please log in." }, { status: 401 }); }
}
