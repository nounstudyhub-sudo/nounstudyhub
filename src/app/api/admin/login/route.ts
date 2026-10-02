import { connectToDatabase } from "@/db";
import { User } from "@/db/models";
import { createSession, hashPassword, publicUser } from "@/lib/auth";
import bcrypt from "bcryptjs";

function isBcryptHash(value: string) {
  return /^\$2[aby]\$/.test(value);
}

function configuredValue(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  if (trimmed.length >= 2 && ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'")))) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export async function POST(request: Request) {
  const configuredUsername = configuredValue(process.env.ADMIN_USERNAME);
  const configuredPassword = configuredValue(process.env.ADMIN_PASSWORD);
  if (!configuredUsername || !configuredPassword) {
    console.error("[admin-login] Admin environment variables not configured.");
    return Response.json({ error: "Sign-in failed. Please try again." }, { status: 500 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const username = String(body.username ?? "").trim().toLowerCase();
  const password = String(body.password ?? "").trim();
  const expectedUsername = configuredUsername.toLowerCase();
  const passwordMatches = isBcryptHash(configuredPassword)
    ? await bcrypt.compare(password, configuredPassword).catch(() => false)
    : password === configuredPassword;

  if (!username || username !== expectedUsername || !passwordMatches) {
    console.error(`[admin-login] Credentials did not match (usernameMatch=${Boolean(username && username === expectedUsername)}, passwordMatch=${passwordMatches}).`);
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
    const databaseUnavailable = error instanceof Error && (
      error.message.includes("MONGODB_URI") || error.name === "MongooseServerSelectionError"
    );
    console.error(`[admin-login] Sign-in failed (${error instanceof Error ? error.name : "unknown error"}; database unavailable: ${databaseUnavailable}).`);
    return Response.json({ error: "Sign-in failed. Please try again." }, { status: databaseUnavailable ? 503 : 500 });
  }
}
