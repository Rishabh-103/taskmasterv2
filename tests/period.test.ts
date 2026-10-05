import { describe, expect, it } from "vitest";
import { isValidTimeZone, periodIndex } from "@/lib/period";

const at = (iso: string) => new Date(iso);

describe("periodIndex", () => {
  it("daily: same local day => same index, next day => +1", () => {
    const a = periodIndex("Daily", at("2026-10-05T01:00:00Z"), "UTC");
    expect(periodIndex("Daily", at("2026-10-05T23:59:59Z"), "UTC")).toBe(a);
    expect(periodIndex("Daily", at("2026-10-06T00:00:00Z"), "UTC")).toBe(a + 1);
  });

  it("respects the user's time zone for day boundaries", () => {
    const t = at("2026-10-05T20:00:00Z"); // 01:30 on Oct 6 in Kolkata (UTC+5:30)
    expect(periodIndex("Daily", t, "Asia/Kolkata")).toBe(periodIndex("Daily", at("2026-10-06T12:00:00Z"), "UTC"));
    expect(periodIndex("Daily", t, "Asia/Kolkata")).not.toBe(periodIndex("Daily", t, "UTC"));
  });

  it("handles leap days and year boundaries as consecutive days", () => {
    const d = (s: string) => periodIndex("Daily", at(s), "UTC");
    expect(d("2028-03-01T12:00:00Z")).toBe(d("2028-02-29T12:00:00Z") + 1);
    expect(d("2027-01-01T12:00:00Z")).toBe(d("2026-12-31T12:00:00Z") + 1);
  });

  it("weekly: Monday-Sunday is one period; Sunday->Monday rolls over", () => {
    const w = (s: string) => periodIndex("Weekly", at(s), "UTC");
    expect(w("2026-10-05T00:00:00Z")).toBe(w("2026-10-11T23:59:59Z")); // Mon..Sun
    expect(w("2026-10-12T00:00:00Z")).toBe(w("2026-10-05T00:00:00Z") + 1);
  });

  it("weekly: continuous across a year boundary", () => {
    const w = (s: string) => periodIndex("Weekly", at(s), "UTC");
    expect(w("2027-01-04T12:00:00Z")).toBe(w("2026-12-28T12:00:00Z") + 1);
  });

  it("monthly: rolls over at month and year boundaries", () => {
    const m = (s: string) => periodIndex("Monthly", at(s), "UTC");
    expect(m("2026-10-31T23:59:59Z")).toBe(m("2026-10-01T00:00:00Z"));
    expect(m("2026-11-01T00:00:00Z")).toBe(m("2026-10-15T00:00:00Z") + 1);
    expect(m("2027-01-01T00:00:00Z")).toBe(m("2026-12-31T00:00:00Z") + 1);
  });
});

describe("isValidTimeZone", () => {
  it("accepts IANA zones and rejects junk", () => {
    expect(isValidTimeZone("Asia/Kolkata")).toBe(true);
    expect(isValidTimeZone("Not/AZone")).toBe(false);
  });
});
