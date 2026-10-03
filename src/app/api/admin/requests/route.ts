import mongoose from "mongoose";
import { connectToDatabase } from "@/db";
import { Course, CourseRequest, Notification, User, idString, objectIdOrNull, withId } from "@/db/models";
import { requireAdmin, safeText } from "@/lib/auth";

export async function GET() {
  try {
    await requireAdmin();
    await connectToDatabase();
    const rows = await CourseRequest.find().sort({ createdAt: -1 }).populate("userId", "username").lean();
    const requests = rows.map((row) => {
      const user = row.userId as unknown as { _id: unknown; username: string };
      return { request: { ...withId(row), userId: idString(user._id) }, user: withId(user) };
    });
    return Response.json({ requests });
  } catch { return Response.json({ error: "Admin access required." }, { status: 401 }); }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin(); await connectToDatabase(); const { id, status } = await request.json();
    if (!["Approved", "Declined", "Pending"].includes(status)) return Response.json({ error: "Invalid status." }, { status: 400 });
    const requestId = objectIdOrNull(id);
    if (!requestId) return Response.json({ error: "Request not found." }, { status: 404 });
    const session = await mongoose.startSession();
    let responseRequest: object | null = null;
    let approvedCourse: { code: string; title: string } | null = null;
    let courseWasAdded = false;
    let previousStatus = "";
    let recipientId: unknown = null;
    let requestText = "";
    try {
      await session.withTransaction(async () => {
        const existing = await CourseRequest.findById(requestId).session(session);
        if (!existing) return;
        previousStatus = existing.status;
        recipientId = existing.userId;
        requestText = safeText(existing.requestText, 120);
        approvedCourse = null;
        courseWasAdded = false;
        if (status === "Approved" && existing.status !== "Approved") {
          const match = requestText.match(/^([A-Za-z0-9-]{2,20})\s+(.*)$/);
          const code = safeText(existing.courseCode || match?.[1], 20).replace(/\s+/g, "").toUpperCase() || `REQ${existing._id.toString().slice(-8)}`;
          const title = safeText(existing.courseTitle || match?.[2] || requestText, 160);
          const matchingCourse = await Course.findOne({ $or: [{ code }, { title }] }).collation({ locale: "en", strength: 2 }).session(session).lean();
          if (matchingCourse) approvedCourse = { code: matchingCourse.code, title: matchingCourse.title };
          else {
            const [createdCourse] = await Course.create([{ code, title }], { session });
            approvedCourse = { code: createdCourse.code, title: createdCourse.title };
            courseWasAdded = true;
          }
        }
        existing.status = status;
        await existing.save({ session });
        responseRequest = withId(existing.toObject());
      });
    } finally { await session.endSession(); }
    if (!responseRequest) return Response.json({ error: "Request not found." }, { status: 404 });
    if (previousStatus !== status && status !== "Pending") {
      const requestCourse = approvedCourse ?? { code: safeText((responseRequest as { courseCode?: string }).courseCode, 20), title: safeText((responseRequest as { courseTitle?: string }).courseTitle, 160) };
      const courseName = `${requestCourse.code} ${requestCourse.title}`.trim() || requestText;
      const verb = status === "Approved" ? "approved" : "declined";
      await Notification.create({ userId: recipientId, message: `${courseName} has been ${verb}.`, type: "student" }).catch(() => undefined);
      if (status === "Approved" && courseWasAdded) {
        const otherStudents = await User.find({ role: "student", _id: { $ne: recipientId } }).select("_id").lean();
        if (otherStudents.length) await Notification.insertMany(otherStudents.map((student) => ({ userId: student._id, message: `${courseName} has been added.`, type: "student" }))).catch(() => undefined);
      }
    }
    return Response.json({ request: responseRequest });
  } catch { return Response.json({ error: "Admin access required." }, { status: 401 }); }
}
