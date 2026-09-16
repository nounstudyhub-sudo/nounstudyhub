import { sql } from "drizzle-orm";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";

type Row = { username: string; shared: number; average: number; attempts: number };

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const period = new URL(request.url).searchParams.get("period") ?? "all";
    const interval = period === "week" ? "7 days" : period === "month" ? "30 days" : null;

    const result = await db.execute(sql`
      WITH me AS (
        SELECT DISTINCT course_id FROM mock_attempts WHERE user_id = ${user.id}
      ),
      cand AS (
        SELECT ma.user_id,
               COUNT(DISTINCT ma.course_id) FILTER (WHERE ma.course_id IN (SELECT course_id FROM me)) AS shared,
               ROUND(AVG(ma.percentage))::int AS average,
               COUNT(*)::int AS attempts
        FROM mock_attempts ma
        JOIN users u ON u.id = ma.user_id
        WHERE ma.user_id <> ${user.id}
          AND u.role = 'student'
          AND u.is_active = true
          AND ma.submitted_at IS NOT NULL
          AND ma.started_at >= NOW() - COALESCE((${interval})::text, '100 years')::interval
        GROUP BY ma.user_id
      )
      SELECT u.username AS username,
             cand.shared::int AS shared,
             cand.average::int AS average,
             cand.attempts::int AS attempts
      FROM cand
      JOIN users u ON u.id = cand.user_id
      WHERE cand.attempts >= 2
      ORDER BY cand.shared DESC, cand.average DESC, cand.attempts DESC
    `);

    const mine = await db.execute(sql`
      SELECT ROUND(AVG(percentage))::int AS average,
             COUNT(*)::int AS attempts,
             COUNT(DISTINCT course_id)::int AS courses
      FROM mock_attempts
      WHERE user_id = ${user.id}
        AND submitted_at IS NOT NULL
        AND started_at >= NOW() - COALESCE((${interval})::text, '100 years')::interval
    `);

    const all = ((result as unknown as { rows?: Row[] }).rows ?? []) as Row[];
    const myStats = ((mine as unknown as { rows?: { average: number | null; attempts: number; courses: number }[] }).rows ?? [])[0]
      ?? { average: null, attempts: 0, courses: 0 };

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
        ? { username: user.username, average: myAverage, attempts: myAttempts, rank: myRank, courses: Number(myStats.courses ?? 0) }
        : { username: user.username, average: myAverage, attempts: myAttempts, rank: null, courses: Number(myStats.courses ?? 0) },
    });
  } catch {
    return Response.json({ error: "Please log in." }, { status: 401 });
  }
}
