import { eq } from "drizzle-orm";
import { db } from "@/db";
import { courseRequests, notifications } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";

export async function PATCH(request: Request) {
  try {
    await requireAdmin(); const { id, status } = await request.json();
    if (!["Approved", "Declined", "Pending"].includes(status)) return Response.json({ error: "Invalid status." }, { status: 400 });
    const [updated] = await db.update(courseRequests).set({ status }).where(eq(courseRequests.id, String(id))).returning();
    if (updated) await db.insert(notifications).values({ userId: updated.userId, message: `Your course request for ${updated.requestText} was ${String(status).toLowerCase()}.`, type: "student" });
    return Response.json({ request: updated });
  } catch { return Response.json({ error: "Admin access required." }, { status: 401 }); }
}
