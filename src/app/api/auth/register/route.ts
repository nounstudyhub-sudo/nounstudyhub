import { connectToDatabase } from "@/db";
import { Notification, User } from "@/db/models";
import { createSession, hashPassword, publicUser, safeText } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    await connectToDatabase();
    const username = safeText(body.username, 40).trim().toLowerCase();
    const matriculationInput = safeText(body.matriculationNumber, 40).toUpperCase().replace(/[\s/-]/g, "");
    const password = String(body.password ?? "");
    if (!/^[a-z0-9_]{3,40}$/.test(username)) return Response.json({ error: "Use 3–40 letters, numbers or underscores for your username." }, { status: 400 });
    if (password.length < 8) return Response.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    if (!/^(?:NOUN?)?\d{9}$/.test(matriculationInput)) return Response.json({ error: "Invalid matriculation number format. Enter 9 digits, optionally prefixed with NOU or NOUN." }, { status: 400 });
    const matriculationNumber = `NOU${matriculationInput.replace(/^NOUN?/, "")}`;
    const reservedAdmin = (process.env.ADMIN_USERNAME || "Khalifa").trim().toLowerCase();
    if (username === reservedAdmin) return Response.json({ error: "Username already exists." }, { status: 409 });
    const existingUsername = await User.findOne({ username }).collation({ locale: "en", strength: 2 }).select("_id").lean();
    if (existingUsername) return Response.json({ error: "Account already exists." }, { status: 409 });
    const existingMatriculation = await User.findOne({ matriculationNumber }).select("_id").lean();
    if (existingMatriculation) return Response.json({ error: "Account already exists." }, { status: 409 });
    const user = await User.create({ username, passwordHash: hashPassword(password), matriculationNumber });
    await Notification.create({ userId: null, type: "admin", message: `New student registered: ${username}`, link: "/admin/dashboard" }).catch(() => undefined);
    await createSession(user._id.toString());
    return Response.json({ user: publicUser(user) }, { status: 201 });
  } catch (error) {
    const databaseError = error as { code?: number; keyPattern?: Record<string, unknown> };
    if (databaseError.code === 11000) {
      if (databaseError.keyPattern?.username) {
        return Response.json({ error: "Account already exists." }, { status: 409 });
      }
      if (databaseError.keyPattern?.matriculationNumber) {
        return Response.json({ error: "Account already exists." }, { status: 409 });
      }
    }
    const databaseUnavailable = error instanceof Error && (
      error.message.includes("MONGODB_URI") || error.name === "MongooseServerSelectionError"
    );
    console.error(`[auth-register] Account creation failed (${error instanceof Error ? error.name : "unknown error"}; database unavailable: ${databaseUnavailable}).`);
    return Response.json({ error: "Could not create your account. Please try again." }, { status: databaseUnavailable ? 503 : 500 });
  }
}
