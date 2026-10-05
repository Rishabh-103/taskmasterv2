import { NextRequest } from "next/server";
import { getDb } from "@/lib/mongodb";
import { fail, getTimeZone, json, parseObjectId, requireUser } from "@/lib/http";
import { HabitDoc, applyCompletion, mutateHabit, toClient } from "@/lib/habits";

type Ctx = { params: Promise<{ id: string }> };

// The server decides the time and the streak - the client only says "I did it".
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const userId = await requireUser(req);
    if (userId instanceof Response) return userId;
    const id = parseObjectId((await params).id);
    if (!id) return fail("Invalid habit id.", 400);

    const now = new Date();
    const tz = getTimeZone(req);
    const result = await mutateHabit((await getDb()).collection<HabitDoc>("habits"), id, userId, (h) => {
      const c = applyCompletion(h, now, tz);
      return c.ok ? { fields: c.fields } : { reject: "Already completed for this period." };
    });

    if (result.status === "not_found") return fail("Habit not found.", 404);
    if (result.status === "rejected") return fail(result.reason, 409);
    if (result.status === "conflict") return fail("Habit was modified concurrently. Please retry.", 409);
    return json({ habit: toClient(result.habit, now, tz) });
  } catch (err) {
    console.error("POST /api/habits/[id]/complete:", err);
    return fail("Failed to complete habit.", 500);
  }
}
