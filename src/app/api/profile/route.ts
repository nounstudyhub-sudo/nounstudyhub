import mongoose from "mongoose";
import { connectToDatabase } from "@/db";
import { AiUsage, CourseRequest, CourseView, Favorite, MockAnswer, MockAttempt, Notification, Session, StudyProgress, User } from "@/db/models";
import { clearSession, requireUser, publicUser, safeText } from "@/lib/auth";

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    let payload: unknown;
    try { payload = await request.json(); }
    catch { return Response.json({ error: "Invalid JSON payload." }, { status: 400 }); }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return Response.json({ error: "Invalid profile payload." }, { status: 400 });
    const phoneNumber = (payload as Record<string, unknown>).phoneNumber;
    if (typeof phoneNumber !== "string" || !/^\+234-\d{10}$/.test(phoneNumber)) return Response.json({ error: "Phone number must use +234- followed by exactly 10 digits." }, { status: 400 });
    await connectToDatabase();
    const updated = await User.findByIdAndUpdate(user.id, { phoneNumber: safeText(phoneNumber, 30) }, { new: true }).lean();
    if (!updated) return Response.json({ error: "Please log in." }, { status: 401 });
    return Response.json({ user: publicUser(updated) });
  } catch { return Response.json({ error: "Please log in." }, { status: 401 }); }
}

export async function DELETE() {
  try {
    const user = await requireUser();
    await connectToDatabase();
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const attempts = await MockAttempt.find({ userId: user.id }).select("_id").session(session).lean();
        const attemptIds = attempts.map((attempt) => attempt._id);
        await MockAnswer.deleteMany({ attemptId: { $in: attemptIds } }, { session });
        await MockAttempt.deleteMany({ userId: user.id }, { session });
        await CourseView.deleteMany({ userId: user.id }, { session });
        await Favorite.deleteMany({ userId: user.id }, { session });
        await CourseRequest.deleteMany({ userId: user.id }, { session });
        await Notification.deleteMany({ userId: user.id }, { session });
        await AiUsage.deleteMany({ userId: user.id }, { session });
        await StudyProgress.deleteMany({ userId: user.id }, { session });
        await Session.deleteMany({ userId: user.id }, { session });
        await User.deleteOne({ _id: user.id }, { session });
      });
    } finally { await session.endSession(); }
    await clearSession().catch(() => undefined);
    return Response.json({ deleted: true });
  } catch { return Response.json({ error: "Could not delete account." }, { status: 500 }); }
}
