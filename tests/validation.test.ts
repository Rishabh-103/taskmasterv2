import { describe, expect, it } from "vitest";
import { parseCount, parseEmail, parseName, parsePassword, parseType } from "@/lib/validation";

describe("validation", () => {
  it("name: trims, rejects empty / non-string / too long", () => {
    expect(parseName("  Read  ")).toEqual({ ok: true, value: "Read" });
    expect(parseName("   ").ok).toBe(false);
    expect(parseName(42).ok).toBe(false);
    expect(parseName("x".repeat(81)).ok).toBe(false);
  });
  it("type: only the three cadences", () => {
    expect(parseType("Weekly").ok).toBe(true);
    expect(parseType("Hourly").ok).toBe(false);
    expect(parseType(undefined).ok).toBe(false);
  });
  it("count: whole numbers in range only (no strings, floats, negatives)", () => {
    expect(parseCount(0).ok).toBe(true);
    for (const bad of ["3", 1.5, -1, NaN, 1_000_001]) expect(parseCount(bad).ok).toBe(false);
  });
  it("email: normalises case, rejects malformed", () => {
    expect(parseEmail(" A@B.com ")).toEqual({ ok: true, value: "a@b.com" });
    expect(parseEmail("nope").ok).toBe(false);
  });
  it("password: 8..72 bytes", () => {
    expect(parsePassword("1234567").ok).toBe(false);
    expect(parsePassword("12345678").ok).toBe(true);
    expect(parsePassword("é".repeat(37)).ok).toBe(false); // 74 bytes
  });
});
