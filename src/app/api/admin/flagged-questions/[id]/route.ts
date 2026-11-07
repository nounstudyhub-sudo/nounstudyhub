import mongoose from "mongoose";
import { connectToDatabase } from "@/db";
import { FlaggedQuestion, Notification, Question, objectIdOrNull } from "@/db/models";
import { requireAdmin } from "@/lib/auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const flagId = objectIdOrNull(id);
    if (!flagId) return Response.json({ error: "Flagged question not found." }, { status: 404 });

    let payload: unknown;
    try { payload = await request.json(); }
    catch { return Response.json({ error: "Invalid JSON payload." }, { status: 400 }); }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return Response.json({ error: "Invalid request payload." }, { status: 400 });
    }
    const status = (payload as Record<string, unknown>).status;
    if (status !== "dismissed" && status !== "deleted") {
      return Response.json({ error: "Status must be dismissed or deleted." }, { status: 400 });
    }

    await connectToDatabase();
    const session = await mongoose.startSession();
    let updatedStatus: string | null = null;
    let conflict = false;
    try {
      await session.withTransaction(async () => {
        const flag = await FlaggedQuestion.findById(flagId).session(session);
        if (!flag) return;
        if (flag.status !== "pending") {
          conflict = flag.status !== status;
          updatedStatus = flag.status;
          return;
        }

        if (status === "dismissed") {
          flag.status = "dismissed";
          await flag.save({ session });
          await Notification.create([{
            userId: flag.userId,
            type: "student",
            message: "Your flagged question was reviewed and dismissed. It remains in the question bank.",
          }], { session });
          updatedStatus = "dismissed";
          return;
        }

        const relatedFlags = await FlaggedQuestion.find({ questionId: flag.questionId }).session(session).lean();
        const pendingReporters = relatedFlags
          .filter((item) => item.status === "pending")
          .map((item) => item.userId);
        await Question.deleteOne({ _id: flag.questionId }, { session });
        await FlaggedQuestion.updateMany({ questionId: flag.questionId }, { $set: { status: "deleted" } }, { session });
        if (pendingReporters.length) {
          await Notification.insertMany(pendingReporters.map((userId) => ({
            userId,
            type: "student",
            message: "Your flagged question was reviewed and removed from the question bank.",
          })), { session });
        }
        updatedStatus = "deleted";
      });
    } finally { await session.endSession(); }

    if (conflict) return Response.json({ error: "This flag has already been resolved." }, { status: 409 });
    if (!updatedStatus) return Response.json({ error: "Flagged question not found." }, { status: 404 });
    return Response.json({ id: flagId.toString(), status: updatedStatus });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHORIZED" || message === "FORBIDDEN") {
      return Response.json({ error: "Admin access required." }, { status: 401 });
    }
    return Response.json({ error: "Could not resolve flagged question." }, { status: 500 });
  }
}
