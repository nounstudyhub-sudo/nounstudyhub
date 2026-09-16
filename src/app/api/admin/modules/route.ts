import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { modules, summaries } from "@/db/schema";
import { requireAdmin, safeText } from "@/lib/auth";

export async function GET(request: Request) { try { await requireAdmin(); const courseId = new URL(request.url).searchParams.get("courseId"); const rows = courseId ? await db.select().from(modules).where(eq(modules.courseId, courseId)).orderBy(asc(modules.position)) : []; return Response.json({ modules: rows }); } catch { return Response.json({ error: "Admin access required." }, { status: 401 }); } }
export async function POST(request: Request) { try { await requireAdmin(); const body = await request.json(); const [module] = await db.insert(modules).values({ courseId: safeText(body.courseId, 50), title: safeText(body.title, 160), position: Number(body.position) || 0 }).returning(); if (body.summary) await db.insert(summaries).values({ moduleId: module.id, title: safeText(body.summaryTitle, 180) || module.title, content: safeText(body.summary, 10000) }); return Response.json({ module }, { status: 201 }); } catch { return Response.json({ error: "Could not save module." }, { status: 500 }); } }
