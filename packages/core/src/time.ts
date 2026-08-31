/**
 * Outlet-local time.
 *
 * The single most common bug in a booking system is a date that means one
 * thing on the server and another on the guest's phone. The rules here:
 *
 *  - The database stores UTC instants (`timestamptz`) and bare calendar dates
 *    (`date`) for things a human picked on a calendar.
 *  - Times of day are stored as *minutes from local midnight*, never as a
 *    `time` column and never as a UTC offset. "Dinner starts at 17:30" is a
 *    fact about the restaurant, not about a timezone offset that shifts.
 *  - Clients render `startMinutes` and `localDate` directly. They must never
 *    run `new Date(iso).getHours()` on a slot — a guest in Dubai booking a
 *    Singapore table would see 3:30 PM for a 7:30 PM sitting.
 *
 * No date library is pulled in for this. `Intl.DateTimeFormat` with a
 * timeZone does the conversion correctly on Node, Hermes and every browser
 * we support, and it costs nothing in bundle size on mobile.
 */

export interface LocalDateTime {
  year: number;
  month: number; // 1-12
  day: number;
  minutes: number; // from local midnight
}

const PARTS_CACHE = new Map<string, Intl.DateTimeFormat>();

const formatter = (timeZone: string): Intl.DateTimeFormat => {
  let f = PARTS_CACHE.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    PARTS_CACHE.set(timeZone, f);
  }
  return f;
};

export const toLocal = (instant: Date, timeZone: string): LocalDateTime => {
  const parts = formatter(timeZone).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    minutes: get("hour") * 60 + get("minute"),
  };
};

/** "2026-09-14" in the outlet's timezone. */
export const toLocalDateString = (instant: Date, timeZone: string): string => {
  const { year, month, day } = toLocal(instant, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

/**
 * The UTC instant for a local calendar date plus minutes-from-midnight.
 *
 * Implemented by guessing UTC then correcting by the observed offset, twice —
 * the second pass catches the DST-transition edge. Singapore has no DST, but
 * this code will outlive the single-market assumption and the failure mode
 * (an hour-wrong booking twice a year) is expensive.
 */
export const fromLocal = (
  date: string,
  minutes: number,
  timeZone: string,
): Date => {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  let guess = new Date(
    Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60),
  );

  for (let i = 0; i < 2; i++) {
    const local = toLocal(guess, timeZone);
    const deltaDays =
      Date.UTC(local.year, local.month - 1, local.day) - Date.UTC(y, m - 1, d);
    const deltaMinutes = local.minutes - minutes + deltaDays / 60_000;
    if (deltaMinutes === 0) break;
    guess = new Date(guess.getTime() - deltaMinutes * 60_000);
  }
  return guess;
};

export const minutesToLabel = (
  minutes: number,
  locale = "en-SG",
): string => {
  const normalised = ((minutes % 1440) + 1440) % 1440;
  const d = new Date(Date.UTC(2000, 0, 1, 0, normalised));
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(d);
};

/** Slot starts for a service window. End-exclusive. */
export const enumerateSlotStarts = (
  startMinutes: number,
  endMinutes: number,
  intervalMinutes: number,
  turnDurationMinutes: number,
): number[] => {
  const out: number[] = [];
  // The last seating must finish by close, so stop a full turn before the end.
  const lastStart = endMinutes - turnDurationMinutes;
  for (let m = startMinutes; m <= lastStart; m += intervalMinutes) out.push(m);
  return out;
};
