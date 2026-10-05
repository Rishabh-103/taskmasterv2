import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { SESSION_COOKIE, verifySession } from "./auth";
import { isValidTimeZone } from "./period";

export const json = (body: unknown, status = 200) => NextResponse.json(body, { status });
export const fail = (message: string, status: number) => json({ message }, status);

export function getTimeZone(req: NextRequest): string {
  const tz = req.headers.get("x-timezone");
  return tz && isValidTimeZone(tz) ? tz : "UTC";
}

export async function readBody(req: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === "object" && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}

export function parseObjectId(v: unknown): ObjectId | null {
  return typeof v === "string" && /^[0-9a-f]{24}$/i.test(v) ? new ObjectId(v) : null;
}

/** Returns the authenticated user's id, or a ready-made 401 response. */
export async function requireUser(req: NextRequest): Promise<ObjectId | NextResponse> {
  const sub = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  const id = parseObjectId(sub);
  return id ?? fail("Not authenticated.", 401);
}
