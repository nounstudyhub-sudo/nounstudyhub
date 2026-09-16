import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, hashPassword, publicUser, safeText } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = safeText(body.username, 40).toLowerCase();
    const matriculationNumber = safeText(body.matriculationNumber, 40).toUpperCase();
    const password = String(body.password ?? "");
    if (!/^[a-z0-9_]{3,40}$/.test(username)) return Response.json({ error: "Use 3–40 letters, numbers or underscores for your username." }, { status: 400 });
    if (password.length < 8) return Response.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    if (!matriculationNumber) return Response.json({ error: "Matriculation number is required." }, { status: 400 });
    const reservedAdmin = (process.env.ADMIN_USERNAME || "Khalifa").trim().toLowerCase();
    if (username === reservedAdmin) return Response.json({ error: "Username already exists." }, { status: 409 });
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
    if (existing.length) return Response.json({ error: "Username already exists." }, { status: 409 });
    const [user] = await db.insert(users).values({ username, passwordHash: hashPassword(password), matriculationNumber }).returning();
    await createSession(user.id);
    return Response.json({ user: publicUser(user) }, { status: 201 });
  } catch {
    return Response.json({ error: "Could not create your account." }, { status: 500 });
  }
}
