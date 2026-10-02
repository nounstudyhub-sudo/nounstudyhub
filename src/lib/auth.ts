import { cookies } from "next/headers";
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { connectToDatabase } from "@/db";
import { Session, User, idString, type UserRecord } from "@/db/models";

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

export function publicUser(user: UserRecord): PublicUser {
  return {
    id: idString(user._id),
    username: user.username,
    matriculationNumber: user.matriculationNumber,
    phoneNumber: user.phoneNumber,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

export async function createSession(userId: string) {
  await connectToDatabase();
  const token = randomUUID() + randomBytes(18).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await Session.create({ token, userId, expiresAt });
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
  await connectToDatabase();
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) await Session.deleteOne({ token });
  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentUser() {
  await connectToDatabase();
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await Session.findOne({ token, expiresAt: { $gt: new Date() } }).lean();
  if (!session) return null;
  const user = await User.findById(session.userId).lean();
  if (!user || !user.isActive) return null;
  return { ...user, id: idString(user._id) };
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
