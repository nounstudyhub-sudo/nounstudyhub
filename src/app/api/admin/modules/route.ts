import mongoose from "mongoose";
import { connectToDatabase } from "@/db";
import { Course, Module, Summary, objectIdOrNull, withId } from "@/db/models";
import { requireAdmin, safeText } from "@/lib/auth";

export async function GET(request: Request) { try { await requireAdmin(); await connectToDatabase(); const courseId = objectIdOrNull(new URL(request.url).searchParams.get("courseId")); const rows = courseId ? await Module.find({ courseId }).sort({ position: 1, createdAt: 1 }).lean() : []; const counts = await Summary.aggregate([{ $match: { moduleId: { $in: rows.map((row) => row._id) } } }, { $group: { _id: "$moduleId", count: { $sum: 1 } } }]); const countByModule = new Map(counts.map((row) => [String(row._id), row.count])); return Response.json({ modules: rows.map((row) => ({ ...withId(row), unitCount: countByModule.get(String(row._id)) ?? 0 })) }); } catch { return Response.json({ error: "Admin access required." }, { status: 401 }); } }
export async function POST(request: Request) {
	try {
		await requireAdmin();
		await connectToDatabase();
		const body = await request.json();
		const courseId = objectIdOrNull(safeText(body.courseId, 50));
		const title = safeText(body.title, 160);
		if (!courseId || !title) return Response.json({ error: "A valid course and module title are required." }, { status: 400 });
		if (!await Course.exists({ _id: courseId })) return Response.json({ error: "Course not found." }, { status: 404 });
		const session = await mongoose.startSession();
		let savedModule: InstanceType<typeof Module> | null = null;
		try {
			await session.withTransaction(async () => {
				const position = await Module.countDocuments({ courseId }).session(session) + 1;
				const [created] = await Module.create([{ courseId, title, position }], { session });
				savedModule = created;
				if (body.summary) await Summary.create([{ moduleId: created._id, title: safeText(body.summaryTitle, 180) || created.title, content: safeText(body.summary, 10000) }], { session });
			});
		} finally { await session.endSession(); }
		if (!savedModule) throw new Error("Module transaction did not commit.");
		return Response.json({ module: withId(savedModule.toObject()) }, { status: 201 });
	} catch { return Response.json({ error: "Could not save module." }, { status: 500 }); }
}

export async function DELETE(request: Request) {
	try {
		await requireAdmin(); await connectToDatabase();
		const moduleId = objectIdOrNull(new URL(request.url).searchParams.get("id"));
		if (!moduleId) return Response.json({ error: "Module not found." }, { status: 404 });
		const session = await mongoose.startSession();
		let found = false;
		try {
			await session.withTransaction(async () => {
				const deleted = await Module.findByIdAndDelete(moduleId).session(session);
				if (!deleted) return;
				found = true;
				await Summary.deleteMany({ moduleId }, { session });
				const remaining = await Module.find({ courseId: deleted.courseId }).sort({ position: 1, createdAt: 1 }).session(session);
				for (const [index, item] of remaining.entries()) await item.updateOne({ position: index + 1 }, { session });
			});
		} finally { await session.endSession(); }
		if (!found) return Response.json({ error: "Module not found." }, { status: 404 });
		return Response.json({ deleted: true });
	} catch { return Response.json({ error: "Could not delete module." }, { status: 500 }); }
}
