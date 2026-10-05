import { NextRequest } from "next/server";
import { getDb } from "@/lib/mongodb";
import { fail, json, requireUser } from "@/lib/http";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUser(req);
    if (userId instanceof Response) return userId;
    const user = await (await getDb()).collection("users").findOne({ _id: userId });
    if (!user) return fail("Not authenticated.", 401);
    return json({ user: { email: user.email } });
  } catch (err) {
    console.error("me:", err);
    return fail("Something went wrong.", 500);
  }
}
