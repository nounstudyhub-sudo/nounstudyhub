import { connectToDatabase } from "@/db";
import { User, withId } from "@/db/models";
import { requireAdmin } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    await connectToDatabase();
    const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const filter = query ? { role: "student", $or: [
      { username: { $regex: escaped, $options: "i" } },
      { matriculationNumber: { $regex: escaped, $options: "i" } },
      { phoneNumber: { $regex: escaped, $options: "i" } },
    ] } : { role: "student" };
    const rows = await User.find(filter).select("username matriculationNumber phoneNumber role isActive createdAt").sort({ createdAt: -1 }).lean();
    return Response.json({ users: rows.map(withId) });
  } catch {
    return Response.json({ error: "Admin access required." }, { status: 401 });
  }
}
