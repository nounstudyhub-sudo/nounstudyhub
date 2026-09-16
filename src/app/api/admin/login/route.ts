import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, hashPassword, publicUser, verifyPassword } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    // Prefer server environment variables; fall back to the sandbox default so the
    // admin console is always reachable. Override with ADMIN_USERNAME / ADMIN_PASSWORD in production.
    const adminUsername = process.env.ADMIN_USERNAME || "Khalifa";
    const adminPassword = process.env.ADMIN_PASSWORD || "Khalifa1";

    const body = await request.json().catch(() => ({}));
    const username = String(body.username ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const expected = adminUsername.trim().toLowerCase();

    // Credentials are validated against the server environment only.
    if (username !== expected || password !== adminPassword) {
      return Response.json({ error: "Invalid admin credentials." }, { status: 401 });
    }

    const rows = await db.select().from(users).where(eq(users.username, expected)).limit(1);
    let user = rows[0];

    if (!user) {
      [user] = await db.insert(users).values({
        username: expected,
        matriculationNumber: `ADMIN-${expected.toUpperCase()}`,
        passwordHash: hashPassword(adminPassword),
        role: "admin",
      }).returning();
    } else if (user.role !== "admin" || !verifyPassword(adminPassword, user.passwordHash) || !user.isActive) {
      // Keep the reserved admin account reconciled with the configured credentials.
      [user] = await db.update(users).set({ role: "admin", isActive: true, passwordHash: hashPassword(adminPassword) }).where(eq(users.id, user.id)).returning();
    }

    await createSession(user.id);
    return Response.json({ user: publicUser(user) });
  } catch (error) {
    // Always return JSON so the client never receives an HTML error page.
    return Response.json({ error: "Sign-in failed. Please try again." }, { status: 500 });
  }
}
