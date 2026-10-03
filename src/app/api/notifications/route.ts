import { connectToDatabase } from "@/db";
import { Notification, objectIdOrNull, withId } from "@/db/models";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();
    await connectToDatabase();
    const filter = user.role === "admin"
      ? { userId: null, type: "admin" }
      : { $or: [{ userId: user.id, type: "student" }, { userId: null, type: "broadcast" }] };
    const rows = await Notification.find(filter).sort({ createdAt: -1 }).limit(30).lean();
    return Response.json({ notifications: rows.map(withId) });
  } catch { return Response.json({ error: "Please log in." }, { status: 401 }); }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    await connectToDatabase();
    const id = objectIdOrNull((await request.json()).id);
    if (!id) return Response.json({ error: "Notification not found." }, { status: 404 });
    const audience = user.role === "admin"
      ? { userId: null, type: "admin" }
      : { $or: [{ userId: user.id, type: "student" }, { userId: null, type: "broadcast" }] };
    const notification = await Notification.findOneAndUpdate({ _id: id, ...audience }, { readAt: new Date() }, { new: true }).lean();
    if (!notification) return Response.json({ error: "Notification not found." }, { status: 404 });
    return Response.json({ notification: withId(notification) });
  } catch { return Response.json({ error: "Please log in." }, { status: 401 }); }
}
