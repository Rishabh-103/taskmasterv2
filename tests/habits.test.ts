import { describe, expect, it } from "vitest";
import { ObjectId } from "mongodb";
import { HabitDoc, applyCompletion, applyTypeChange, effectiveStreak, isCompleted } from "@/lib/habits";
import { periodIndex } from "@/lib/period";

const TZ = "UTC";
const day = (n: number) => new Date(Date.UTC(2026, 9, n, 12)); // Oct n, 2026, noon UTC

const habit = (over: Partial<HabitDoc> = {}): HabitDoc => ({
  _id: new ObjectId(), userId: new ObjectId(), name: "Read", type: "Daily", count: 0, streak: 0,
  bestStreak: 0, lastCompletedAt: null, lastPeriod: null, createdAt: day(1), version: 0, ...over,
});

function complete(h: HabitDoc, when: Date) {
  const r = applyCompletion(h, when, TZ);
  if (!r.ok) throw new Error("expected completion to succeed");
  return { ...h, ...r.fields, version: h.version + 1 };
}

describe("completion & streaks", () => {
  it("first completion starts a streak of 1 and increments count", () => {
    const h = complete(habit({ count: 5 }), day(1));
    expect(h).toMatchObject({ count: 6, streak: 1, bestStreak: 1 });
  });

  it("rejects a second completion in the same period", () => {
    const h = complete(habit(), day(1));
    expect(applyCompletion(h, new Date(Date.UTC(2026, 9, 1, 23)), TZ).ok).toBe(false);
  });

  it("consecutive days extend the streak; a gap resets it but keeps best", () => {
    let h = complete(habit(), day(1));
    h = complete(h, day(2));
    h = complete(h, day(3));
    expect(h).toMatchObject({ streak: 3, bestStreak: 3, count: 3 });
    h = complete(h, day(5)); // skipped Oct 4
    expect(h).toMatchObject({ streak: 1, bestStreak: 3, count: 4 });
  });

  it("weekly streak counts consecutive weeks", () => {
    let h = complete(habit({ type: "Weekly" }), day(5));
    h = complete(h, day(12));
    expect(h.streak).toBe(2);
    expect(applyCompletion(h, day(13), TZ).ok).toBe(false); // same week
  });

  it("effectiveStreak decays when a period is missed", () => {
    const h = complete(habit(), day(1));
    expect(effectiveStreak(h, day(1), TZ)).toBe(1);
    expect(effectiveStreak(h, day(2), TZ)).toBe(1); // can still extend tomorrow
    expect(effectiveStreak(h, day(3), TZ)).toBe(0); // missed Oct 2
    expect(isCompleted(h, day(1), TZ)).toBe(true);
    expect(isCompleted(h, day(2), TZ)).toBe(false);
  });
});

describe("type change", () => {
  it("recomputes lastPeriod for the new cadence and restarts the streak", () => {
    const h = complete(complete(habit(), day(1)), day(2));
    const fields = applyTypeChange(h, "Weekly", TZ);
    expect(fields).toMatchObject({ type: "Weekly", streak: 1, lastPeriod: periodIndex("Weekly", day(2), TZ) });
    expect(applyTypeChange(habit(), "Monthly", TZ)).toMatchObject({ lastPeriod: null, streak: 0 });
  });
});
