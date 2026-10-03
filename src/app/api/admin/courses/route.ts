import mongoose from "mongoose";
import { connectToDatabase } from "@/db";
import { AdminImport, Course, CourseView, Favorite, MockAnswer, MockAttempt, Module, Question, QuestionBank, Summary, objectIdOrNull, withId } from "@/db/models";
import { requireAdmin, safeText } from "@/lib/auth";

export async function GET() {
  try {
    await requireAdmin();
    await connectToDatabase();
    const rows = await Course.find().sort({ code: 1, title: 1 }).lean();
    const modules = await Module.find({ courseId: { $in: rows.map((row) => row._id) } }).select("_id courseId").lean();
    const summaries = await Summary.find({ moduleId: { $in: modules.map((row) => row._id) } }).select("moduleId").lean();
    const [questionCounts, moduleCounts] = await Promise.all([
      Question.aggregate([{ $group: { _id: "$courseId", count: { $sum: 1 } } }]),
      Module.aggregate([{ $group: { _id: "$courseId", count: { $sum: 1 } } }]),
    ]);
    const questionCountByCourse = new Map(questionCounts.map((row) => [String(row._id), row.count]));
    const moduleCountByCourse = new Map(moduleCounts.map((row) => [String(row._id), row.count]));
    const unitCountByCourse = new Map<string, number>();
    const courseByModule = new Map(modules.map((row) => [String(row._id), String(row.courseId)]));
    for (const summary of summaries) {
      const courseId = courseByModule.get(String(summary.moduleId));
      if (courseId) unitCountByCourse.set(courseId, (unitCountByCourse.get(courseId) ?? 0) + 1);
    }
    return Response.json({ courses: rows.map((row) => ({
      ...withId(row),
      moduleCount: moduleCountByCourse.get(String(row._id)) ?? 0,
      unitCount: unitCountByCourse.get(String(row._id)) ?? 0,
      questionCount: questionCountByCourse.get(String(row._id)) ?? 0,
    })) });
  }
  catch { return Response.json({ error: "Admin access required." }, { status: 401 }); }
}

export async function POST(request: Request) {
  try { await requireAdmin(); await connectToDatabase(); const body = await request.json(); const code = safeText(body.code, 20).toUpperCase(); const title = safeText(body.title, 160); const description = safeText(body.description, 500); if (!code || !title) return Response.json({ error: "Course code and title are required." }, { status: 400 }); const course = await Course.create({ code, title, description }); return Response.json({ course: withId(course.toObject()) }, { status: 201 }); }
  catch { return Response.json({ error: "Could not create course." }, { status: 500 }); }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin();
    await connectToDatabase();
    const courseId = objectIdOrNull(safeText(new URL(request.url).searchParams.get("id"), 50));
    if (!courseId) return Response.json({ error: "Course not found." }, { status: 404 });
    const session = await mongoose.startSession();
    let found = false;
    try {
      await session.withTransaction(async () => {
        const course = await Course.findById(courseId).select("_id").session(session).lean();
        if (!course) return;
        found = true;
        const modules = await Module.find({ courseId }).select("_id").session(session).lean();
        const attempts = await MockAttempt.find({ courseId }).select("_id").session(session).lean();
        const moduleIds = modules.map((row) => row._id);
        const attemptIds = attempts.map((row) => row._id);
        await Summary.deleteMany({ moduleId: { $in: moduleIds } }, { session });
        await Module.deleteMany({ courseId }, { session });
        await Question.deleteMany({ courseId }, { session });
        await QuestionBank.deleteMany({ courseId }, { session });
        await AdminImport.deleteMany({ courseId }, { session });
        await MockAnswer.deleteMany({ attemptId: { $in: attemptIds } }, { session });
        await MockAttempt.deleteMany({ courseId }, { session });
        await Favorite.deleteMany({ courseId }, { session });
        await CourseView.deleteMany({ courseId }, { session });
        await Course.deleteOne({ _id: courseId }, { session });
      });
    } finally { await session.endSession(); }
    if (!found) return Response.json({ error: "Course not found." }, { status: 404 });
    return Response.json({ deleted: true });
  } catch { return Response.json({ error: "Could not delete course." }, { status: 500 }); }
}
