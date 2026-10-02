import { connectToDatabase } from "@/db";
import { Course, Favorite, Question, idString, withId } from "@/db/models";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = ((url.searchParams.get("q") ?? url.searchParams.get("search")) || "").trim();
    await connectToDatabase();
    const filter = query ? { $or: [
      { code: { $regex: escapeRegex(query), $options: "i" } },
      { title: { $regex: escapeRegex(query), $options: "i" } },
    ] } : {};
    const rows = await Course.find(filter).sort({ code: 1 }).lean();
    const user = await getCurrentUser();
    const saved = user ? await Favorite.find({ userId: user.id }).select("courseId").lean() : [];
    const savedIds = new Set(saved.map((row) => idString(row.courseId)));
    const questionCounts = await Question.aggregate([{ $group: { _id: "$courseId", count: { $sum: 1 } } }]);
    const countsByCourse = new Map(questionCounts.map((row) => [idString(row._id), row.count]));
    const courses = rows.map((course) => ({
      ...withId(course),
      questionCount: countsByCourse.get(idString(course._id)) ?? 0,
      favorite: savedIds.has(idString(course._id)),
    }));
    return Response.json({ courses });
  } catch (error) {
    const missingUri = error instanceof Error && error.message.includes("MONGODB_URI");
    console.error(`[courses] MongoDB query failed (${error instanceof Error ? error.name : "unknown error"}).`);
    return Response.json({
      courses: [],
      error: "Courses could not be loaded. Please try again.",
    }, { status: 503 });
  }
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
