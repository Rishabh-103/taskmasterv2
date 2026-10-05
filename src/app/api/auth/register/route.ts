import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { clearSessionCookie, setSessionCookie, signSession } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { fail, json, readBody } from "@/lib/http";
import { parseEmail, parsePassword } from "@/lib/validation";

export async function POST(req: NextRequest) {
  try {
    const body = await readBody(req);
    if (!body) return fail("Invalid request body.", 400);
    const email = parseEmail(body.email);
    if (!email.ok) return fail(email.error, 400);
    const password = parsePassword(body.password);
    if (!password.ok) return fail(password.error, 400);

    const db = await getDb();
    const passwordHash = await bcrypt.hash(password.value, 10);
    let insertedId;
    try {
      ({ insertedId } = await db
        .collection("users")
        .insertOne({ email: email.value, passwordHash, createdAt: new Date() }));
    } catch (err) {
      if ((err as { code?: number }).code === 11000) return fail("An account with this email already exists.", 409);
      throw err;
    }

    const res = json({ user: { email: email.value } }, 201);
    setSessionCookie(res, await signSession(insertedId.toString()));
    return res;
  } catch (err) {
    console.error("register:", err);
    const res = fail("Something went wrong.", 500);
    clearSessionCookie(res);
    return res;
  }
}
