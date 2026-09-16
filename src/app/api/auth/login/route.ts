import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, publicUser, safeText, verifyPassword } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json();
  const username = safeText(body.username, 40).toLowerCase();
  const password = String(body.password ?? "");
  const rows = await db.select().from(users).where(eq(users.username, username)).limit(1);
  const user = rows[0];
  if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) return Response.json({ error: "Invalid username or password." }, { status: 401 });
  await createSession(user.id);
  return Response.json({ user: publicUser(user) });
}
