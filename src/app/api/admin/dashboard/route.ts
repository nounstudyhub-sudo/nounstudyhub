import { count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { adminImports, courses, courseRequests, mockAttempts, questionBanks, questions, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  try {
    await requireAdmin();
    const [[userCount], [courseCount], [questionCount], [attemptCount], [pendingCount]] = await Promise.all([
      db.select({ value: count() }).from(users).where(eq(users.role, "student")),
      db.select({ value: count() }).from(courses),
      db.select({ value: count() }).from(questions),
      db.select({ value: count() }).from(mockAttempts),
      db.select({ value: count() }).from(courseRequests).where(eq(courseRequests.status, "Pending")),
    ]);
    const recentUsers = await db.select().from(users).where(eq(users.role, "student")).orderBy(desc(users.createdAt)).limit(5);
    const imports = await db.select({ import: adminImports, course: courses, bank: questionBanks }).from(adminImports).innerJoin(courses, eq(adminImports.courseId, courses.id)).innerJoin(questionBanks, eq(adminImports.bankId, questionBanks.id)).orderBy(desc(adminImports.createdAt)).limit(5);
    const requests = await db.select({ request: courseRequests, user: users }).from(courseRequests).innerJoin(users, eq(courseRequests.userId, users.id)).orderBy(desc(courseRequests.createdAt)).limit(20);
    return Response.json({ stats: { users: Number(userCount.value), courses: Number(courseCount.value), questions: Number(questionCount.value), attempts: Number(attemptCount.value), pending: Number(pendingCount.value) }, recentUsers, imports, requests });
  } catch (error) { return Response.json({ error: error instanceof Error && error.message === "FORBIDDEN" ? "Admin access required." : "Please log in." }, { status: 401 }); }
}
