import { connectToDatabase } from "@/db";
import { User } from "@/db/models";
import { safeText } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const username = safeText(new URL(request.url).searchParams.get("username"), 40).toLowerCase();
    if (!username) return Response.json({ available: false });
    await connectToDatabase();
    const found = await User.exists({ username }).collation({ locale: "en", strength: 2 });
    return Response.json({ available: !found });
  } catch (error) {
    console.error(`[auth-availability] Failed to check username: ${error instanceof Error ? error.message : "unknown"}`);
    return Response.json({ available: true });
  }
}
