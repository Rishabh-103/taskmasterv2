import { HABIT_TYPES, HabitType } from "./period";

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };
const ok = <T,>(value: T): Parsed<T> => ({ ok: true, value });
const fail = <T,>(error: string): Parsed<T> => ({ ok: false, error });

export const MAX_HABITS_PER_USER = 100;

export function parseName(v: unknown): Parsed<string> {
  if (typeof v !== "string") return fail("Habit name is required.");
  const s = v.trim();
  if (!s) return fail("Habit name cannot be empty.");
  if (s.length > 80) return fail("Habit name must be 80 characters or fewer.");
  return ok(s);
}

export function parseType(v: unknown): Parsed<HabitType> {
  return typeof v === "string" && (HABIT_TYPES as readonly string[]).includes(v)
    ? ok(v as HabitType)
    : fail("Type must be Daily, Weekly or Monthly.");
}

export function parseCount(v: unknown): Parsed<number> {
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 1_000_000) {
    return fail("Count must be a whole number between 0 and 1,000,000.");
  }
  return ok(v);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseEmail(v: unknown): Parsed<string> {
  if (typeof v !== "string") return fail("Email is required.");
  const s = v.trim().toLowerCase();
  if (s.length > 254 || !EMAIL_RE.test(s)) return fail("Enter a valid email address.");
  return ok(s);
}

/** bcrypt only uses the first 72 bytes, so cap there instead of silently truncating. */
export function parsePassword(v: unknown): Parsed<string> {
  if (typeof v !== "string") return fail("Password is required.");
  if (v.length < 8) return fail("Password must be at least 8 characters.");
  if (new TextEncoder().encode(v).length > 72) return fail("Password must be at most 72 bytes.");
  return ok(v);
}
