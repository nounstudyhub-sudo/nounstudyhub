import { connectToDatabase } from "@/db";
import { Course, CourseView, Favorite, MockAttempt, Module, Question, StudyProgress, Summary, idString, withId } from "@/db/models";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();
    await connectToDatabase();
    const [attemptRows, viewRows, favoriteRows, mocksCompleted, scoreRows, progressRows] = await Promise.all([
      MockAttempt.find({ userId: user.id, submittedAt: { $ne: null } }).sort({ startedAt: -1 }).limit(10).populate("courseId").lean(),
      CourseView.find({ userId: user.id }).sort({ viewedAt: -1 }).limit(6).populate("courseId").lean(),
      Favorite.find({ userId: user.id }).sort({ createdAt: -1 }).populate("courseId").lean(),
      MockAttempt.countDocuments({ userId: user.id, submittedAt: { $ne: null } }),
      MockAttempt.aggregate([
        { $match: { userId: user.id, submittedAt: { $ne: null } } },
        { $group: { _id: null, averageScore: { $avg: "$percentage" } } },
      ]),
      StudyProgress.find({ userId: user.id }).sort({ lastStudiedAt: -1 }).limit(1).lean(),
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
    const latestProgress = progressRows[0];
    const recentView = viewRows[0];
    const progressIsNewer = latestProgress && (!recentView || latestProgress.lastStudiedAt >= recentView.viewedAt);
    const activeCourseId = progressIsNewer
      ? latestProgress.courseId
      : (recentView?.courseId as unknown as { _id: unknown } | undefined)?._id;
    let continueStudying = null;
    if (activeCourseId) {
      const [course, modules] = await Promise.all([
        Course.findById(activeCourseId).lean(),
        Module.find({ courseId: activeCourseId }).select("_id").lean(),
      ]);
      if (course) {
        const totalUnits = await Summary.countDocuments({ moduleId: { $in: modules.map((module) => module._id) } });
        const progressMatchesCourse = progressIsNewer && latestProgress.courseId.toString() === course._id.toString();
        const viewedUnits = progressMatchesCourse ? latestProgress.viewedUnitIds.length : 0;
        const activeModule = progressMatchesCourse && latestProgress.activeModuleId ? await Module.findById(latestProgress.activeModuleId).select("title").lean() : null;
        continueStudying = {
          course: { ...withId(course), questionCount: await Question.countDocuments({ courseId: course._id }) },
          viewedUnits,
          totalUnits,
          progressPercent: totalUnits ? Math.min(100, Math.round((viewedUnits / totalUnits) * 100)) : 0,
          activeModuleTitle: activeModule?.title ?? null,
        };
      }
    }
    return Response.json({
      attempts,
      views,
      favorites,
      metrics: { mocksCompleted, averageScore: Math.round(scoreRows[0]?.averageScore ?? 0) },
      continueStudying,
    });
  } catch { return Response.json({ error: "Please log in." }, { status: 401 }); }
}
