import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { setSessionCookie, signSession } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { fail, json, readBody } from "@/lib/http";

// Compared against when the email is unknown, so response time doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", 10);

export async function POST(req: NextRequest) {
  try {
    const body = await readBody(req);
    if (!body || typeof body.email !== "string" || typeof body.password !== "string") {
      return fail("Email and password are required.", 400);
    }
    const email = body.email.trim().toLowerCase();

    const db = await getDb();
    const user = await db.collection("users").findOne({ email });
    const valid = await bcrypt.compare(body.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !valid) return fail("Invalid email or password.", 401);

    const res = json({ user: { email: user.email } });
    setSessionCookie(res, await signSession(user._id.toString()));
    return res;
  } catch (err) {
    console.error("login:", err);
    return fail("Something went wrong.", 500);
  }
}
