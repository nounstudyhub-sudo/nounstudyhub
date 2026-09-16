import { cookies } from "next/headers";
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";

const SESSION_COOKIE = "nounstudyhub_session";
const SESSION_DAYS = 30;

type PublicUser = {
  id: string;
  username: string;
  matriculationNumber: string;
  phoneNumber: string | null;
  role: string;
  isActive: boolean;
  createdAt: Date;
};

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const derived = scryptSync(password, salt, 64);
  const storedKey = Buffer.from(key, "hex");
  return storedKey.length === derived.length && timingSafeEqual(storedKey, derived);
}

export function publicUser(user: typeof users.$inferSelect): PublicUser {
  return {
    id: user.id,
    username: user.username,
    matriculationNumber: user.matriculationNumber,
    phoneNumber: user.phoneNumber,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

export async function createSession(userId: string) {
  const token = randomUUID() + randomBytes(18).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({ token, userId, expiresAt });
  const cookieStore = await cookies();
  // `secure` is intentionally omitted so the session survives sandboxed previews
  // that terminate TLS at a proxy and forward plain HTTP to the app.
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.token, token));
  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await db.select({ user: users }).from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
    .limit(1);
  const row = rows[0];
  if (!row || !row.user.isActive) return null;
  return row.user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") throw new Error("FORBIDDEN");
  return user;
}

export function safeText(value: unknown, max = 200) {
  return String(value ?? "").trim().slice(0, max);
}

export function hashRecoveryKey(username: string, matriculationNumber: string) {
  return createHash("sha256").update(`${username.toLowerCase()}:${matriculationNumber.toUpperCase()}`).digest("hex");
}
