import { connectToDatabase } from "@/db";
import { CourseRequest, Notification, objectIdOrNull, withId } from "@/db/models";
import { requireAdmin } from "@/lib/auth";

export async function PATCH(request: Request) {
  try {
    await requireAdmin(); await connectToDatabase(); const { id, status } = await request.json();
    if (!["Approved", "Declined", "Pending"].includes(status)) return Response.json({ error: "Invalid status." }, { status: 400 });
    const requestId = objectIdOrNull(id);
    if (!requestId) return Response.json({ error: "Request not found." }, { status: 404 });
    const updated = await CourseRequest.findByIdAndUpdate(requestId, { status }, { new: true });
    if (updated) await Notification.create({ userId: updated.userId, message: `Your course request for ${updated.requestText} was ${String(status).toLowerCase()}.`, type: "student" });
    return Response.json({ request: updated ? withId(updated.toObject()) : null });
  } catch { return Response.json({ error: "Admin access required." }, { status: 401 }); }
}
