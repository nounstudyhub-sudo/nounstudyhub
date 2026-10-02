import { connectToDatabase } from "@/db";
import { CourseView, Favorite, MockAttempt, idString, withId } from "@/db/models";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();
    await connectToDatabase();
    const [attemptRows, viewRows, favoriteRows] = await Promise.all([
      MockAttempt.find({ userId: user.id }).sort({ startedAt: -1 }).limit(10).populate("courseId").lean(),
      CourseView.find({ userId: user.id }).sort({ viewedAt: -1 }).limit(6).populate("courseId").lean(),
      Favorite.find({ userId: user.id }).sort({ createdAt: -1 }).populate("courseId").lean(),
    ]);
    const attempts = attemptRows.map((row) => {
      const course = row.courseId as unknown as { _id: unknown };
      return { attempt: { ...withId(row), courseId: idString(course._id) }, course: withId(course) };
    });
    const views = viewRows.map((row) => ({
      course: withId(row.courseId as unknown as { _id: unknown }),
      viewedAt: row.viewedAt,
    }));
    const favorites = favoriteRows.map((row) => withId(row.courseId as unknown as { _id: unknown }));
    return Response.json({ attempts, views, favorites });
  } catch { return Response.json({ error: "Please log in." }, { status: 401 }); }
}
