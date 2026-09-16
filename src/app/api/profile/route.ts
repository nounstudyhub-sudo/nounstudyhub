import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser, publicUser, safeText } from "@/lib/auth";

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const [updated] = await db.update(users).set({ phoneNumber: safeText(body.phoneNumber, 30) || null }).where(eq(users.id, user.id)).returning();
    return Response.json({ user: publicUser(updated) });
  } catch { return Response.json({ error: "Please log in." }, { status: 401 }); }
}
