import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { addDays, format, differenceInCalendarDays } from "date-fns";

export type AnalyticsRange = "today" | "yesterday" | "7d" | "30d" | "90d" | "custom" | "all";
export function analyticsRange(range: AnalyticsRange, now: Date, timezone = "Asia/Kolkata", from?: Date, to?: Date) {
  const today = formatInTimeZone(now, timezone, "yyyy-MM-dd");
  const shift = (day: string, n: number) => format(addDays(new Date(`${day}T12:00:00`), n), "yyyy-MM-dd");
  const midnight = (day: string) => fromZonedTime(`${day}T00:00:00`, timezone);
  let start = today, end = now;
  if (range === "all") return { rangeStart: new Date(0), rangeEnd: now, priorStart: new Date(0), priorEnd: new Date(0) };
  if (range === "yesterday") { start = shift(today, -1); end = new Date(midnight(today).getTime() - 1); }
  else if (range === "custom" && from && to) { start = format(from, "yyyy-MM-dd"); end = new Date(midnight(shift(format(to, "yyyy-MM-dd"), 1)).getTime() - 1); }
  else if (range !== "today") start = shift(today, -(range === "7d" ? 6 : range === "90d" ? 89 : 29));
  const days = differenceInCalendarDays(new Date(formatInTimeZone(end, timezone, "yyyy-MM-dd") + "T12:00:00"), new Date(start + "T12:00:00")) + 1;
  return { rangeStart: midnight(start), rangeEnd: end, priorStart: midnight(shift(start, -days)), priorEnd: midnight(start) };
}