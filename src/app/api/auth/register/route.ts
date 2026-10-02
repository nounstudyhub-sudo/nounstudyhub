import { connectToDatabase } from "@/db";
import { User } from "@/db/models";
import { createSession, hashPassword, publicUser, safeText } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    await connectToDatabase();
    const username = safeText(body.username, 40).trim().toLowerCase();
    const matriculationNumber = safeText(body.matriculationNumber, 40).trim().toUpperCase();
    const password = String(body.password ?? "");
    if (!/^[a-z0-9_]{3,40}$/.test(username)) return Response.json({ error: "Use 3–40 letters, numbers or underscores for your username." }, { status: 400 });
    if (password.length < 8) return Response.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    if (!matriculationNumber) return Response.json({ error: "Matriculation number is required." }, { status: 400 });
    const reservedAdmin = (process.env.ADMIN_USERNAME || "Khalifa").trim().toLowerCase();
    if (username === reservedAdmin) return Response.json({ error: "Username already exists." }, { status: 409 });
    const existingUsername = await User.findOne({ username }).collation({ locale: "en", strength: 2 }).select("_id").lean();
    if (existingUsername) return Response.json({ error: "Username already taken." }, { status: 409 });
    const existingMatriculation = await User.findOne({ matriculationNumber }).select("_id").lean();
    if (existingMatriculation) return Response.json({ error: "Matriculation number already registered." }, { status: 409 });
    const user = await User.create({ username, passwordHash: hashPassword(password), matriculationNumber });
    await createSession(user._id.toString());
    return Response.json({ user: publicUser(user) }, { status: 201 });
  } catch (error) {
    const databaseError = error as { code?: number; keyPattern?: Record<string, unknown> };
    if (databaseError.code === 11000) {
      if (databaseError.keyPattern?.username) {
        return Response.json({ error: "Username already taken." }, { status: 409 });
      }
      if (databaseError.keyPattern?.matriculationNumber) {
        return Response.json({ error: "Matriculation number already registered." }, { status: 409 });
      }
    }
    console.error(`[auth-register] Failed to create user: ${error instanceof Error ? error.message : "unknown"}`);
    return Response.json({ error: "Could not create your account." }, { status: 500 });
  }
}
