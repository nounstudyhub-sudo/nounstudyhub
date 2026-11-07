import { connectToDatabase } from "@/db";
import { Notification, objectIdOrNull, withId } from "@/db/models";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();
    await connectToDatabase();
    const filter = user.role === "admin"
      ? { userId: null, type: { $in: ["admin", "QUESTION_FLAGGED"] } }
      : { $or: [{ userId: user.id, type: "student" }, { userId: null, type: "broadcast" }] };
    const [rows, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).limit(30).lean(),
      Notification.countDocuments({ ...filter, readAt: null }),
    ]);
    return Response.json({
      notifications: rows.map((row) => ({ ...withId(row), read: Boolean(row.readAt) })),
      unreadCount,
    });
  } catch { return Response.json({ error: "Please log in." }, { status: 401 }); }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    await connectToDatabase();
    const id = objectIdOrNull((await request.json()).id);
    if (!id) return Response.json({ error: "Notification not found." }, { status: 404 });
    const audience = user.role === "admin"
      ? { userId: null, type: { $in: ["admin", "QUESTION_FLAGGED"] } }
      : { $or: [{ userId: user.id, type: "student" }, { userId: null, type: "broadcast" }] };
    const notification = await Notification.findOneAndUpdate({ _id: id, ...audience }, { read: true, readAt: new Date() }, { new: true }).lean();
    if (!notification) return Response.json({ error: "Notification not found." }, { status: 404 });
    const unreadCount = await Notification.countDocuments({ ...audience, readAt: null });
    return Response.json({ notification: { ...withId(notification), read: true }, unreadCount });
  } catch { return Response.json({ error: "Please log in." }, { status: 401 }); }
}
