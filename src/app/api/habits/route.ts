import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { fail, getTimeZone, json, parseObjectId, readBody, requireUser } from "@/lib/http";
import { HabitDoc, toClient } from "@/lib/habits";
import { MAX_HABITS_PER_USER, parseCount, parseName, parseType } from "@/lib/validation";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUser(req);
    if (userId instanceof Response) return userId;
    const habits = await (await getDb())
      .collection<HabitDoc>("habits")
      .find({ userId })
      .sort({ createdAt: 1 })
      .toArray();
    const now = new Date();
    const tz = getTimeZone(req);
    return json(habits.map((h) => toClient(h, now, tz)));
  } catch (err) {
    console.error("GET /api/habits:", err);
    return fail("Failed to fetch habits.", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUser(req);
    if (userId instanceof Response) return userId;
    const body = await readBody(req);
    if (!body) return fail("Invalid request body.", 400);

    const name = parseName(body.name);
    if (!name.ok) return fail(name.error, 400);
    const type = parseType(body.type);
    if (!type.ok) return fail(type.error, 400);
    const count = parseCount(body.count ?? 0);
    if (!count.ok) return fail(count.error, 400);

    const col = (await getDb()).collection<HabitDoc>("habits");
    if ((await col.countDocuments({ userId })) >= MAX_HABITS_PER_USER) {
      return fail(`You can track at most ${MAX_HABITS_PER_USER} habits.`, 400);
    }

    const doc: HabitDoc = {
      _id: new ObjectId(),
      userId,
      name: name.value,
      type: type.value,
      count: count.value,
      streak: 0,
      bestStreak: 0,
      lastCompletedAt: null,
      lastPeriod: null,
      createdAt: new Date(),
      version: 0,
    };
    await col.insertOne(doc);
    return json({ habit: toClient(doc, new Date(), getTimeZone(req)) }, 201);
  } catch (err) {
    console.error("POST /api/habits:", err);
    return fail("Failed to create habit.", 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = await requireUser(req);
    if (userId instanceof Response) return userId;
    const body = await readBody(req);
    const raw = body?.ids;
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_HABITS_PER_USER) {
      return fail("Provide a non-empty array of habit ids.", 400);
    }
    const ids = raw.map(parseObjectId);
    if (ids.some((id) => id === null)) return fail("Invalid habit id.", 400);

    // userId in the filter is what stops one user deleting another's habits.
    const res = await (await getDb())
      .collection<HabitDoc>("habits")
      .deleteMany({ _id: { $in: ids as ObjectId[] }, userId });
    return json({ deleted: res.deletedCount });
  } catch (err) {
    console.error("DELETE /api/habits:", err);
    return fail("Failed to delete habits.", 500);
  }
}
