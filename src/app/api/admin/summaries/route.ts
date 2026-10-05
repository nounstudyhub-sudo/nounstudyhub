import { connectToDatabase } from "@/db";
import { Module, Summary, objectIdOrNull, withId } from "@/db/models";
import { requireAdmin, safeText } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    await connectToDatabase();
    const moduleId = objectIdOrNull(new URL(request.url).searchParams.get("moduleId"));
    if (!moduleId) return Response.json({ summaries: [] });
    const rows = await Summary.find({ moduleId }).sort({ createdAt: 1, _id: 1 }).lean();
    return Response.json({ summaries: rows.map(withId) });
  } catch { return Response.json({ error: "Admin access required." }, { status: 401 }); }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    await connectToDatabase();
    const body = await request.json();
    const moduleId = objectIdOrNull(body.moduleId);
    const title = safeText(body.title, 180);
    const content = safeText(body.content, 50000);
    if (!moduleId || !title || !content) return Response.json({ error: "A module, unit title, and unit contents are required." }, { status: 400 });
    if (!await Module.exists({ _id: moduleId })) return Response.json({ error: "Module not found." }, { status: 404 });
    const summary = await Summary.create({ moduleId, title, content });
    return Response.json({ summary: withId(summary.toObject()) }, { status: 201 });
  } catch { return Response.json({ error: "Could not save unit." }, { status: 500 }); }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
    await connectToDatabase();
    const body = await request.json();
    const id = objectIdOrNull(body.id);
    const title = safeText(body.title, 180);
    const content = safeText(body.content, 50000);
    if (!id || !title || !content) return Response.json({ error: "A unit title and contents are required." }, { status: 400 });
    const summary = await Summary.findByIdAndUpdate(id, { title, content, updatedAt: new Date() }, { new: true }).lean();
    if (!summary) return Response.json({ error: "Unit not found." }, { status: 404 });
    return Response.json({ summary: withId(summary) });
  } catch { return Response.json({ error: "Could not update unit." }, { status: 500 }); }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin();
    await connectToDatabase();
    const id = objectIdOrNull(new URL(request.url).searchParams.get("id"));
    if (!id) return Response.json({ error: "Unit not found." }, { status: 404 });
    const deleted = await Summary.findByIdAndDelete(id);
    if (!deleted) return Response.json({ error: "Unit not found." }, { status: 404 });
    return Response.json({ deleted: true });
  } catch { return Response.json({ error: "Could not delete unit." }, { status: 500 }); }
}
