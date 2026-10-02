import { connectToDatabase } from "@/db";
import { MockAttempt, User } from "@/db/models";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  try { await requireAdmin(); await connectToDatabase(); const rows = await MockAttempt.aggregate([{ $group: { _id: "$userId", average: { $avg: "$percentage" }, attempts: { $sum: 1 } } }, { $match: { attempts: { $gte: 2 } } }, { $sort: { average: -1 } }, { $limit: 20 }]); const users = await User.find({ _id: { $in: rows.map((row) => row._id) } }).select("username").lean(); const usernames = new Map(users.map((user) => [String(user._id), user.username])); return Response.json({ leaderboard: rows.map((row) => ({ username: usernames.get(String(row._id)) ?? "", average: Math.round(row.average), attempts: row.attempts })) }); }
  catch { return Response.json({ error: "Admin access required." }, { status: 401 }); }
}
