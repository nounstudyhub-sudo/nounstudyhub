import { connectToDatabase } from "@/db";
import { Course, Favorite, Module, Question, QuestionBank, Summary, objectIdOrNull, withId } from "@/db/models";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const courseId = objectIdOrNull(id);
  if (!courseId) return Response.json({ error: "Course not found." }, { status: 404 });
  await connectToDatabase();
  const course = await Course.findById(courseId).lean();
  if (!course) return Response.json({ error: "Course not found." }, { status: 404 });
  const user = await getCurrentUser();
  const [bankRows, moduleRows, questionCount, bankCounts] = await Promise.all([
    QuestionBank.find({ courseId }).sort({ year: 1 }).lean(),
    Module.find({ courseId }).sort({ position: 1 }).lean(),
    Question.countDocuments({ courseId }),
    Question.aggregate([
      { $match: { courseId } },
      { $group: { _id: "$bankId", count: { $sum: 1 } } },
    ]),
  ]);
  const summaryRows = moduleRows.length ? await Summary.find({ moduleId: { $in: moduleRows.map((module) => module._id) } }).sort({ createdAt: 1, _id: 1 }).lean() : [];
  const summariesByModule = new Map<string, ReturnType<typeof withId>[]>();
  for (const summary of summaryRows) {
    const key = String(summary.moduleId);
    summariesByModule.set(key, [...(summariesByModule.get(key) ?? []), withId(summary)]);
  }
  const countByBank = new Map(bankCounts.map((row) => [String(row._id), row.count]));
  const banks = bankRows.map((bank) => ({ ...withId(bank), questionCount: countByBank.get(String(bank._id)) ?? 0 }));
  const modules = moduleRows.map((module) => ({ ...withId(module), units: summariesByModule.get(String(module._id)) ?? [] }));
  const favorite = user ? Boolean(await Favorite.exists({ userId: user.id, courseId })) : false;
  return Response.json({ course: { ...withId(course), questionCount, favorite }, banks, modules });
}
