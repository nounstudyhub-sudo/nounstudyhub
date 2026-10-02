import { connectToDatabase } from "@/db";
import { Course, Question, withId } from "@/db/models";
import { requireAdmin, safeText } from "@/lib/auth";

export async function GET() {
  try { await requireAdmin(); await connectToDatabase(); const rows = await Course.find().sort({ code: 1 }).lean(); const counts = await Question.aggregate([{ $group: { _id: "$courseId", count: { $sum: 1 } } }]); const countMap = new Map(counts.map((row) => [String(row._id), row.count])); return Response.json({ courses: rows.map((row) => ({ ...withId(row), questionCount: countMap.get(String(row._id)) ?? 0 })) }); }
  catch { return Response.json({ error: "Admin access required." }, { status: 401 }); }
}

export async function POST(request: Request) {
  try { await requireAdmin(); await connectToDatabase(); const body = await request.json(); const code = safeText(body.code, 20).toUpperCase(); const title = safeText(body.title, 160); const description = safeText(body.description, 500); if (!code || !title) return Response.json({ error: "Course code and title are required." }, { status: 400 }); const course = await Course.create({ code, title, description }); return Response.json({ course: withId(course.toObject()) }, { status: 201 }); }
  catch { return Response.json({ error: "Could not create course." }, { status: 500 }); }
}
