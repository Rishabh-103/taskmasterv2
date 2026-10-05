import type { Collection, ObjectId } from "mongodb";
import { HabitType, periodIndex } from "./period";
import type { ClientHabit } from "./types";

export interface HabitDoc {
  _id: ObjectId;
  userId: ObjectId;
  name: string;
  type: HabitType;
  count: number;
  streak: number;
  bestStreak: number;
  lastCompletedAt: Date | null;
  /** periodIndex(type, lastCompletedAt) - kept in sync whenever type changes. */
  lastPeriod: number | null;
  createdAt: Date;
  /** Optimistic-concurrency token, bumped on every write. */
  version: number;
}

export type HabitFields = Partial<
  Pick<HabitDoc, "name" | "type" | "count" | "streak" | "bestStreak" | "lastCompletedAt" | "lastPeriod">
>;

export function isCompleted(h: Pick<HabitDoc, "type" | "lastPeriod">, now: Date, tz: string) {
  return h.lastPeriod !== null && h.lastPeriod === periodIndex(h.type, now, tz);
}

/** A streak is alive only if the last completion was this period or the one before. */
export function effectiveStreak(h: Pick<HabitDoc, "type" | "lastPeriod" | "streak">, now: Date, tz: string) {
  if (h.lastPeriod === null) return 0;
  return h.lastPeriod >= periodIndex(h.type, now, tz) - 1 ? h.streak : 0;
}

export type Completion = { ok: true; fields: Required<Pick<HabitFields, "count" | "streak" | "bestStreak" | "lastCompletedAt" | "lastPeriod">> } | { ok: false };

export function applyCompletion(h: HabitDoc, now: Date, tz: string): Completion {
  const current = periodIndex(h.type, now, tz);
  if (h.lastPeriod === current) return { ok: false };
  const streak = h.lastPeriod === current - 1 ? h.streak + 1 : 1;
  return {
    ok: true,
    fields: {
      count: h.count + 1,
      streak,
      bestStreak: Math.max(h.bestStreak, streak),
      lastCompletedAt: now,
      lastPeriod: current,
    },
  };
}

/** Changing cadence makes the old streak meaningless; keep best streak and the last completion. */
export function applyTypeChange(h: HabitDoc, type: HabitType, tz: string): HabitFields {
  const lastPeriod = h.lastCompletedAt ? periodIndex(type, h.lastCompletedAt, tz) : null;
  return { type, lastPeriod, streak: lastPeriod === null ? 0 : 1 };
}

export function toClient(h: HabitDoc, now: Date, tz: string): ClientHabit {
  return {
    _id: h._id.toString(),
    name: h.name,
    type: h.type,
    count: h.count,
    streak: effectiveStreak(h, now, tz),
    bestStreak: h.bestStreak,
    completed: isCompleted(h, now, tz),
    lastCompletedAt: h.lastCompletedAt ? h.lastCompletedAt.toISOString() : null,
    createdAt: h.createdAt.toISOString(),
  };
}

export type MutateResult =
  | { status: "ok"; habit: HabitDoc }
  | { status: "not_found" }
  | { status: "rejected"; reason: string }
  | { status: "conflict" };

/**
 * Read-modify-write guarded by the `version` field (compare-and-swap).
 * If another request wrote in between, the CAS matches nothing and we re-read
 * and re-evaluate, so concurrent taps can never double-count.
 */
export async function mutateHabit(
  col: Pick<Collection<HabitDoc>, "findOne" | "updateOne">,
  id: ObjectId,
  userId: ObjectId,
  fn: (h: HabitDoc) => { fields: HabitFields } | { reject: string },
  attempts = 3,
): Promise<MutateResult> {
  for (let i = 0; i < attempts; i++) {
    const h = await col.findOne({ _id: id, userId });
    if (!h) return { status: "not_found" };
    const out = fn(h);
    if ("reject" in out) return { status: "rejected", reason: out.reject };
    const res = await col.updateOne(
      { _id: id, userId, version: h.version },
      { $set: { ...out.fields, version: h.version + 1 } },
    );
    if (res.matchedCount === 1) {
      return { status: "ok", habit: { ...h, ...out.fields, version: h.version + 1 } };
    }
  }
  return { status: "conflict" };
}
