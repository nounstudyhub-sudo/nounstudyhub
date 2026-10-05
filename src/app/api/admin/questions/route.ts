import mongoose from "mongoose";
import { connectToDatabase } from "@/db";
import { AdminImport, Question, QuestionBank, objectIdOrNull, withId } from "@/db/models";
import { requireAdmin } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    await connectToDatabase();
    const courseId = objectIdOrNull(new URL(request.url).searchParams.get("courseId"));
    if (!courseId) return Response.json({ banks: [] });
    const banks = await QuestionBank.find({ courseId }).sort({ year: 1, createdAt: 1 }).lean();
    const counts = await Question.aggregate([
      { $match: { courseId } },
      { $group: { _id: "$bankId", count: { $sum: 1 } } },
    ]);
    const countByBank = new Map(counts.map((row) => [String(row._id), row.count]));
    return Response.json({ banks: banks.map((bank) => ({ ...withId(bank), questionCount: countByBank.get(String(bank._id)) ?? 0 })) });
  } catch { return Response.json({ error: "Admin access required." }, { status: 401 }); }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin();
    await connectToDatabase();
    const id = objectIdOrNull(new URL(request.url).searchParams.get("id"));
    if (!id) return Response.json({ error: "Question bank not found." }, { status: 404 });
    const session = await mongoose.startSession();
    let found = false;
    try {
      await session.withTransaction(async () => {
        const bank = await QuestionBank.findByIdAndDelete(id, { session });
        if (!bank) return;
        found = true;
        await Question.deleteMany({ bankId: id }, { session });
        await AdminImport.deleteMany({ bankId: id }, { session });
      });
    } finally { await session.endSession(); }
    if (!found) return Response.json({ error: "Question bank not found." }, { status: 404 });
    return Response.json({ deleted: true });
  } catch { return Response.json({ error: "Could not delete question bank." }, { status: 500 }); }
}
