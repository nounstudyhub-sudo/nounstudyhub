import { connectToDatabase } from "@/db";
import { CourseRequest, Notification, withId } from "@/db/models";
import { requireUser, safeText } from "@/lib/auth";

export async function GET() {
  try { const user = await requireUser(); await connectToDatabase(); const rows = await CourseRequest.find({ userId: user.id }).sort({ createdAt: -1 }).lean(); return Response.json({ requests: rows.map(withId) }); }
  catch { return Response.json({ error: "Please log in." }, { status: 401 }); }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    await connectToDatabase();
    const requestText = safeText((await request.json()).requestText, 120);
    if (!requestText) return Response.json({ error: "Enter a course name or code." }, { status: 400 });
    const created = await CourseRequest.create({ userId: user.id, requestText });
    await Notification.create({ type: "admin_request", message: `${user.username} requested ${requestText}`, link: "/admin/dashboard?section=requests" });
    return Response.json({ request: withId(created.toObject()) }, { status: 201 });
  } catch { return Response.json({ error: "Could not submit your request." }, { status: 500 }); }
}
