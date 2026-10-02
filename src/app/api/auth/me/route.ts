import { getCurrentUser, publicUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    return Response.json({ user: user ? publicUser(user) : null });
  } catch (error) {
    console.error(`[auth-me] Failed to load current user: ${error instanceof Error ? error.message : "unknown"}`);
    return Response.json({ user: null });
  }
}
