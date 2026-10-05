import { describe, expect, it } from "vitest";
import { ObjectId } from "mongodb";
import { HabitDoc, applyCompletion, mutateHabit } from "@/lib/habits";
import { FakeCollection } from "./helpers/fakeDb";

/**
 * A collection whose FIRST read by each of N callers blocks until all N have read.
 * This forces the worst case - everyone sees the same stale document - deterministically.
 */
class BarrierCollection extends FakeCollection {
  private waiting = 0;
  private release!: () => void;
  private gate = new Promise<void>((r) => (this.release = r));
  constructor(private callers: number) { super(); }
  async findOne(filter: Record<string, unknown>) {
    const doc = await super.findOne(filter);
    if (this.waiting < this.callers) {
      this.waiting++;
      if (this.waiting === this.callers) this.release();
      await this.gate;
    }
    return doc;
  }
}

describe("mutateHabit (compare-and-swap)", () => {
  it("N callers holding the same stale read: exactly one wins, count increases by exactly 1", async () => {
    const N = 10;
    const col = new BarrierCollection(N);
    const userId = new ObjectId();
    const _id = new ObjectId();
    const habit: HabitDoc = {
      _id, userId, name: "Read", type: "Daily", count: 7, streak: 0, bestStreak: 0,
      lastCompletedAt: null, lastPeriod: null, createdAt: new Date(), version: 0,
    };
    col.docs.push({ ...habit });
    const now = new Date("2026-10-05T10:00:00Z");

    const results = await Promise.all(
      Array.from({ length: N }, () =>
        mutateHabit(col as never, _id, userId, (h) => {
          const c = applyCompletion(h, now, "UTC");
          return c.ok ? { fields: c.fields } : { reject: "done" };
        }),
      ),
    );

    expect(results.filter((r) => r.status === "ok")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(N - 1);
    expect(col.docs[0]).toMatchObject({ count: 8, streak: 1, version: 1 });
  });
});
