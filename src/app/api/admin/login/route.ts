import { connectToDatabase } from "@/db";
import { User } from "@/db/models";
import { createSession, hashPassword, publicUser } from "@/lib/auth";
import bcrypt from "bcryptjs";

function isBcryptHash(value: string) {
  return /^\$2[aby]\$/.test(value);
}

export async function POST(request: Request) {
  const configuredUsername = process.env.ADMIN_USERNAME?.trim();
  const configuredPassword = process.env.ADMIN_PASSWORD?.trim();
  if (!configuredUsername || !configuredPassword) {
    console.error("[admin-login] ADMIN_USERNAME and ADMIN_PASSWORD must be configured.");
    return Response.json({ error: "Admin sign-in is not configured." }, { status: 500 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const username = String(body.username ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const expectedUsername = configuredUsername.toLowerCase();
  const passwordMatches = isBcryptHash(configuredPassword)
    ? await bcrypt.compare(password, configuredPassword).catch(() => false)
    : password === configuredPassword;

  if (!username || username !== expectedUsername || !passwordMatches) {
    console.error("[admin-login] Admin credentials did not match the configured credentials.");
    return Response.json({ error: "Invalid admin credentials." }, { status: 401 });
  }

  try {
    await connectToDatabase();
    let user = await User.findOne({ username }).collation({ locale: "en", strength: 2 });

    if (!user) {
      user = await User.create({
        username,
        matriculationNumber: `ADMIN-${username.toUpperCase()}`,
        passwordHash: hashPassword(password),
        role: "admin",
      });
    } else if (user.role !== "admin" || !user.isActive) {
      user.role = "admin";
      user.isActive = true;
      user.passwordHash = hashPassword(password);
      await user.save();
    }

    await createSession(user._id.toString());
    return Response.json({ user: publicUser(user) });
  } catch (error) {
    console.error(`[admin-login] Sign-in could not complete: ${error instanceof Error ? error.message : "unknown error"}`);
    return Response.json({ error: "Sign-in failed. Please try again." }, { status: 500 });
  }
}
