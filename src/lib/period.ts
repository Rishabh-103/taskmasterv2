export const HABIT_TYPES = ["Daily", "Weekly", "Monthly"] as const;
export type HabitType = (typeof HABIT_TYPES)[number];

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Calendar date of `date` as seen in time zone `tz`. */
export function localDate(date: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

/**
 * Maps an instant to an integer "period number" for the habit type, in the
 * user's time zone. Two instants are in the same period iff the numbers are
 * equal, and consecutive periods differ by exactly 1 - which makes both
 * "completed this period?" and "streak continues?" simple integer checks.
 *
 * Weeks start on Monday (ISO). 1970-01-01 was a Thursday, hence the +3.
 */
export function periodIndex(type: HabitType, date: Date, tz: string): number {
  const { y, m, d } = localDate(date, tz);
  if (type === "Monthly") return y * 12 + (m - 1);
  const days = Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
  return type === "Daily" ? days : Math.floor((days + 3) / 7);
}
