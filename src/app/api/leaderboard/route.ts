import { connectToDatabase } from "@/db";
import { MockAttempt, User } from "@/db/models";
import { requireUser } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    await connectToDatabase();
    const period = new URL(request.url).searchParams.get("period") ?? "all";
    const cutoff = period === "week" ? new Date(Date.now() - 7 * 86400000) : period === "month" ? new Date(Date.now() - 30 * 86400000) : null;
    const periodFilter = cutoff ? { startedAt: { $gte: cutoff } } : {};
    const myCourseIds = await MockAttempt.distinct("courseId", { userId: user.id });
    const [candidateRows, myStatsRows] = await Promise.all([
      MockAttempt.aggregate([
        { $match: { userId: { $ne: user._id }, submittedAt: { $ne: null }, ...periodFilter } },
        { $group: { _id: "$userId", average: { $avg: "$percentage" }, attempts: { $sum: 1 }, courses: { $addToSet: "$courseId" } } },
        { $match: { attempts: { $gte: 2 } } },
        { $addFields: { shared: { $size: { $setIntersection: ["$courses", myCourseIds] } } } },
        { $sort: { shared: -1, average: -1, attempts: -1 } },
      ]),
      MockAttempt.aggregate([
        { $match: { userId: user._id, submittedAt: { $ne: null }, ...periodFilter } },
        { $group: { _id: null, average: { $avg: "$percentage" }, attempts: { $sum: 1 }, courses: { $addToSet: "$courseId" } } },
      ]),
    ]);
    const myStats = myStatsRows[0] ?? { average: null, attempts: 0, courses: [] };
    const eligibleStudents = await User.find({ _id: { $in: candidateRows.map((row) => row._id) }, role: "student", isActive: true }).select("username").lean();
    const usernameById = new Map(eligibleStudents.map((item) => [String(item._id), item.username]));
    const all = candidateRows.filter((row) => usernameById.has(String(row._id))).map((row) => ({ ...row, username: usernameById.get(String(row._id)) ?? "" }));

    // Minimum acceptable match is 5 shared courses (per the platform rules).
    const suitable = all.filter((row) => row.shared >= 5);
    const bestShared = all.length ? all[0].shared : 0;
    const myAttempts = Number(myStats.attempts ?? 0);
    const myAverage = myStats.average === null || myStats.average === undefined ? 0 : Number(myStats.average);
    const eligible = myAttempts >= 2;

    const ranked = suitable.slice(0, 20).map((row, index) => ({
      rank: index + 1,
      username: row.username,
      shared: Number(row.shared),
      average: Number(row.average),
      attempts: Number(row.attempts),
    }));

    // Where the signed-in student would sit, based on their own average.
    let myRank: number | null = null;
    if (eligible) {
      const ahead = suitable.filter((row) => Number(row.average) > myAverage).length;
      myRank = ahead + 1;
    }

    const forming = !eligible || suitable.length < 3 || bestShared < 5;

    return Response.json({
      period,
      rows: ranked,
      forming,
      groupSize: suitable.length,
      bestShared,
      me: eligible
        ? { username: user.username, average: myAverage, attempts: myAttempts, rank: myRank, courses: myStats.courses.length }
          : { username: user.username, average: myAverage, attempts: myAttempts, rank: null, courses: myStats.courses.length },
    });
  } catch {
    return Response.json({ error: "Please log in." }, { status: 401 });
  }
}
