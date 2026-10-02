import { connectToDatabase } from "@/db";
import { Notification, withId } from "@/db/models";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();
    await connectToDatabase();
    const rows = await Notification.find({ $or: [{ userId: user.id }, { userId: null }] }).sort({ createdAt: -1 }).limit(20).lean();
    return Response.json({ notifications: rows.map(withId) });
  } catch { return Response.json({ error: "Please log in." }, { status: 401 }); }
}
