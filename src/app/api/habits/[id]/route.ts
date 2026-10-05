import { NextRequest } from "next/server";
import { getDb } from "@/lib/mongodb";
import { fail, getTimeZone, json, parseObjectId, readBody, requireUser } from "@/lib/http";
import { HabitDoc, HabitFields, applyTypeChange, mutateHabit, toClient } from "@/lib/habits";
import { parseCount, parseName, parseType } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

// Only name, type and count are editable. Anything else in the body (userId,
// createdAt, streak, ...) is ignored rather than written through.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const userId = await requireUser(req);
    if (userId instanceof Response) return userId;
    const id = parseObjectId((await params).id);
    if (!id) return fail("Invalid habit id.", 400);
    const body = await readBody(req);
    if (!body) return fail("Invalid request body.", 400);

    const name = body.name === undefined ? null : parseName(body.name);
    if (name && !name.ok) return fail(name.error, 400);
    const type = body.type === undefined ? null : parseType(body.type);
    if (type && !type.ok) return fail(type.error, 400);
    const count = body.count === undefined ? null : parseCount(body.count);
    if (count && !count.ok) return fail(count.error, 400);
    if (!name && !type && !count) return fail("Nothing to update.", 400);

    const tz = getTimeZone(req);
    const result = await mutateHabit(
      (await getDb()).collection<HabitDoc>("habits"),
      id,
      userId,
      (h) => {
        const fields: HabitFields = {};
        if (name?.ok) fields.name = name.value;
        if (count?.ok) fields.count = count.value;
        if (type?.ok && type.value !== h.type) Object.assign(fields, applyTypeChange(h, type.value, tz));
        return { fields };
      },
    );

    if (result.status === "not_found") return fail("Habit not found.", 404);
    if (result.status === "conflict") return fail("Habit was modified concurrently. Please retry.", 409);
    if (result.status === "rejected") return fail(result.reason, 400);
    return json({ habit: toClient(result.habit, new Date(), tz) });
  } catch (err) {
    console.error("PATCH /api/habits/[id]:", err);
    return fail("Failed to update habit.", 500);
  }
}
