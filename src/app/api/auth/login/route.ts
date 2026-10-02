import { connectToDatabase } from "@/db";
import { User } from "@/db/models";
import { createSession, publicUser, safeText, verifyPassword } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    await connectToDatabase();
    const username = safeText(body.username, 40).toLowerCase();
    const password = String(body.password ?? "");
    const user = await User.findOne({ username }).collation({ locale: "en", strength: 2 });
    if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) return Response.json({ error: "Invalid username or password." }, { status: 401 });
    await createSession(user.id);
    return Response.json({ user: publicUser(user) });
  } catch (error) {
    console.error(`[auth-login] Error during sign-in: ${error instanceof Error ? error.message : "unknown"}`);
    return Response.json({ error: "Could not sign in. Please check your credentials and try again." }, { status: 500 });
  }
}
