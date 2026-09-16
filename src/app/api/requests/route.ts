import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { courseRequests, notifications } from "@/db/schema";
import { requireUser, safeText } from "@/lib/auth";

export async function GET() {
  try { const user = await requireUser(); return Response.json({ requests: await db.select().from(courseRequests).where(eq(courseRequests.userId, user.id)).orderBy(desc(courseRequests.createdAt)) }); }
  catch { return Response.json({ error: "Please log in." }, { status: 401 }); }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const requestText = safeText((await request.json()).requestText, 120);
    if (!requestText) return Response.json({ error: "Enter a course name or code." }, { status: 400 });
    const [created] = await db.insert(courseRequests).values({ userId: user.id, requestText }).returning();
    await db.insert(notifications).values({ type: "admin_request", message: `${user.username} requested ${requestText}`, link: "/admin/dashboard?section=requests" });
    return Response.json({ request: created }, { status: 201 });
  } catch { return Response.json({ error: "Could not submit your request." }, { status: 500 }); }
}
