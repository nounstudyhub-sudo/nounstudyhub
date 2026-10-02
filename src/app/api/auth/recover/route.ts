import { connectToDatabase } from "@/db";
import { User } from "@/db/models";
import { createSession, hashPassword, publicUser, safeText } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    await connectToDatabase();
    const username = safeText(body.username ?? body.userName, 40).toLowerCase().trim();
    const matriculationNumber = safeText(body.matriculationNumber ?? body.matricNumber, 40).toUpperCase().trim();
    const newPassword = String(body.newPassword ?? "");
    const confirmPassword = String(body.confirmPassword ?? "");

    if (!username) {
      return Response.json({ error: "Username is required." }, { status: 400 });
    }
    if (!matriculationNumber) {
      return Response.json({ error: "Matriculation number is required." }, { status: 400 });
    }

    const user = await User.findOne({ username, matriculationNumber }).collation({ locale: "en", strength: 2 });
    if (!user) {
      return Response.json({ error: "Username and matric number do not match." }, { status: 400 });
    }

    if (body.verifyOnly === true) return Response.json({ verified: true });
    if (newPassword.length < 8) {
      return Response.json({ error: "New password must be at least 8 characters." }, { status: 400 });
    }
    if (newPassword !== confirmPassword) {
      return Response.json({ error: "Passwords do not match." }, { status: 400 });
    }

    const updated = await User.findByIdAndUpdate(user._id, { passwordHash: hashPassword(newPassword) }, { new: true });
    if (!updated) return Response.json({ error: "Username and matric number do not match." }, { status: 400 });

    await createSession(updated._id.toString());
    return Response.json({ user: publicUser(updated) });
  } catch (error) {
    console.error(`[auth-recover] Error during password recovery: ${error instanceof Error ? error.message : "unknown"}`);
    return Response.json({ error: "Password reset is unavailable right now. Please try again later." }, { status: 500 });
  }
}
