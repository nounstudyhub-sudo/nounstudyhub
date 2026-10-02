import { connectToDatabase } from "@/db";
import { AdminImport, Course, CourseRequest, MockAttempt, Question, User, idString, withId } from "@/db/models";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  try {
    await requireAdmin();
    await connectToDatabase();
    const [userCount, courseCount, questionCount, attemptCount, pendingCount, recentUserRows, importRows, requestRows] = await Promise.all([
      User.countDocuments({ role: "student" }),
      Course.countDocuments(),
      Question.countDocuments(),
      MockAttempt.countDocuments(),
      CourseRequest.countDocuments({ status: "Pending" }),
      User.find({ role: "student" }).sort({ createdAt: -1 }).limit(5).lean(),
      AdminImport.find().sort({ createdAt: -1 }).limit(5).populate("courseId").populate("bankId").lean(),
      CourseRequest.find().sort({ createdAt: -1 }).limit(20).populate("userId", "username").lean(),
    ]);
    const recentUsers = recentUserRows.map(withId);
    const imports = importRows.map((row) => {
      const course = row.courseId as unknown as { _id: unknown };
      const bank = row.bankId as unknown as { _id: unknown };
      return { import: { ...withId(row), courseId: idString(course._id), bankId: idString(bank._id) }, course: withId(course), bank: withId(bank) };
    });
    const requests = requestRows.map((row) => {
      const user = row.userId as unknown as { _id: unknown };
      return { request: { ...withId(row), userId: idString(user._id) }, user: withId(user) };
    });
    return Response.json({ stats: { users: userCount, courses: courseCount, questions: questionCount, attempts: attemptCount, pending: pendingCount }, recentUsers, imports, requests });
  } catch (error) { return Response.json({ error: error instanceof Error && error.message === "FORBIDDEN" ? "Admin access required." : "Please log in." }, { status: 401 }); }
}
