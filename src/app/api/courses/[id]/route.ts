import { connectToDatabase } from "@/db";
import { Course, Module, Question, QuestionBank, Summary, objectIdOrNull, withId } from "@/db/models";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const courseId = objectIdOrNull(id);
  if (!courseId) return Response.json({ error: "Course not found." }, { status: 404 });
  await connectToDatabase();
  const course = await Course.findById(courseId).lean();
  if (!course) return Response.json({ error: "Course not found." }, { status: 404 });
  const [bankRows, moduleRows, questionCount] = await Promise.all([
    QuestionBank.find({ courseId }).sort({ year: 1 }).lean(),
    Module.find({ courseId }).sort({ position: 1 }).lean(),
    Question.countDocuments({ courseId }),
  ]);
  const summaryRows = moduleRows.length ? await Summary.find({ moduleId: moduleRows[0]._id }).lean() : [];
  return Response.json({ course: { ...withId(course), questionCount }, banks: bankRows.map(withId), modules: moduleRows.map(withId), summaries: summaryRows.map(withId) });
}
