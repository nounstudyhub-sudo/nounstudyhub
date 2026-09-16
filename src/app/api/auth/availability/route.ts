import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { safeText } from "@/lib/auth";

export async function GET(request: Request) {
  const username = safeText(new URL(request.url).searchParams.get("username"), 40).toLowerCase();
  if (!username) return Response.json({ available: false });
  const found = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
  return Response.json({ available: found.length === 0 });
}
