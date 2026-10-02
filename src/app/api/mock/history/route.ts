import { connectToDatabase } from "@/db";
import { Course, MockAttempt, idString, withId } from "@/db/models";
import { requireUser } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    await connectToDatabase();
    const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
    const courseFilter = q ? await Course.find({ $or: [
      { code: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
      { title: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
    ] }).distinct("_id") : undefined;
    const attempts = await MockAttempt.find({ userId: user.id, ...(courseFilter ? { courseId: { $in: courseFilter } } : {}) }).sort({ startedAt: -1 }).populate("courseId").lean();
    const rows = attempts.map((attempt) => {
      const course = attempt.courseId as unknown as { _id: unknown };
      return { attempt: { ...withId(attempt), courseId: idString(course._id) }, course: withId(course) };
    });
    return Response.json({ attempts: rows });
  } catch { return Response.json({ error: "Please log in." }, { status: 401 }); }
}
