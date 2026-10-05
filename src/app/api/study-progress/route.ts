import { connectToDatabase } from "@/db";
import { Course, Module, StudyProgress, Summary, objectIdOrNull } from "@/db/models";
import { requireUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    await connectToDatabase();
    const body = await request.json();
    const courseId = objectIdOrNull(body.courseId);
    const moduleId = body.moduleId ? objectIdOrNull(body.moduleId) : null;
    const unitId = body.unitId ? objectIdOrNull(body.unitId) : null;
    if (!courseId || (body.moduleId && !moduleId) || (body.unitId && !unitId)) {
      return Response.json({ error: "A valid course, module, and unit are required." }, { status: 400 });
    }
    if (!await Course.exists({ _id: courseId })) return Response.json({ error: "Course not found." }, { status: 404 });
    if (moduleId && !await Module.exists({ _id: moduleId, courseId })) {
      return Response.json({ error: "Module not found for this course." }, { status: 404 });
    }
    if (unitId && (!moduleId || !await Summary.exists({ _id: unitId, moduleId }))) {
      return Response.json({ error: "Unit not found for this module." }, { status: 404 });
    }
    const update: Record<string, unknown> = {
      $set: { activeModuleId: moduleId, activeUnitId: unitId, lastStudiedAt: new Date() },
      $setOnInsert: { userId: user.id, courseId },
    };
    const additions: Record<string, unknown> = {};
    if (moduleId) additions.viewedModuleIds = moduleId;
    if (unitId) additions.viewedUnitIds = unitId;
    if (Object.keys(additions).length) update.$addToSet = additions;
    await StudyProgress.updateOne({ userId: user.id, courseId }, update, { upsert: true });
    return Response.json({ saved: true });
  } catch { return Response.json({ error: "Could not save study progress." }, { status: 500 }); }
}
