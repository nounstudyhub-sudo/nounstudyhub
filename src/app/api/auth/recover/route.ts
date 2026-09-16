import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, hashPassword, publicUser, safeText } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json();
  const username = safeText(body.username, 40).toLowerCase();
  const matriculationNumber = safeText(body.matriculationNumber, 40).toUpperCase();
  const newPassword = String(body.newPassword ?? "");
  if (newPassword.length < 8) return Response.json({ error: "New password must be at least 8 characters." }, { status: 400 });
  const found = await db.select().from(users).where(and(eq(users.username, username), eq(users.matriculationNumber, matriculationNumber))).limit(1);
  const user = found[0];
  if (!user) return Response.json({ error: "Username and matriculation number do not match." }, { status: 400 });
  const [updated] = await db.update(users).set({ passwordHash: hashPassword(newPassword) }).where(eq(users.id, user.id)).returning();
  await createSession(updated.id);
  return Response.json({ user: publicUser(updated) });
}
