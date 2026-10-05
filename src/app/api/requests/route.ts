import { connectToDatabase } from "@/db";
import { Course, CourseRequest, Notification, withId } from "@/db/models";
import { requireUser, safeText } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();
    await connectToDatabase();
    const rows = await CourseRequest.find({ userId: user._id }).sort({ createdAt: -1 }).lean();
    return Response.json({ requests: rows.map(withId) });
  }
  catch { return Response.json({ error: "Please log in." }, { status: 401 }); }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    await connectToDatabase();
    const body = await request.json();
    const courseCode = safeText(body.courseCode, 20).toUpperCase();
    const courseTitle = safeText(body.courseTitle, 160);
    if (!/^[A-Z0-9-]{2,20}$/.test(courseCode) || !courseTitle) return Response.json({ error: "Enter a valid course code and course title." }, { status: 400 });
    const existingCourse = await Course.findOne({ $or: [{ code: courseCode }, { title: courseTitle }] }).collation({ locale: "en", strength: 2 }).select("_id").lean();
    if (existingCourse) return Response.json({ error: "This course is already on the database" }, { status: 409 });
    const requestText = `${courseCode} ${courseTitle}`.slice(0, 120);
    const created = await CourseRequest.create({ userId: user.id, requestText, courseCode, courseTitle });
    await Notification.create({ userId: null, type: "admin", message: `${user.username} requested ${courseCode} ${courseTitle}`, link: "/admin/requested-courses" }).catch(() => undefined);
    return Response.json({ request: withId(created.toObject()) }, { status: 201 });
  } catch { return Response.json({ error: "Could not submit your request." }, { status: 500 }); }
}
