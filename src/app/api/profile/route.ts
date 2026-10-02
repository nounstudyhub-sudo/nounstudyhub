import { connectToDatabase } from "@/db";
import { User } from "@/db/models";
import { requireUser, publicUser, safeText } from "@/lib/auth";

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    await connectToDatabase();
    const updated = await User.findByIdAndUpdate(user.id, { phoneNumber: safeText(body.phoneNumber, 30) || null }, { new: true }).lean();
    if (!updated) return Response.json({ error: "Please log in." }, { status: 401 });
    return Response.json({ user: publicUser(updated) });
  } catch { return Response.json({ error: "Please log in." }, { status: 401 }); }
}
