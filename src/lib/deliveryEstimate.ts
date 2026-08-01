/**
 * Delivery date estimator based on Indian pincode.
 * Heuristic-only — uses first 1-2 digits of pincode to classify
 * metro / tier-1 / tier-2 / remote and adds business days accordingly.
 *
 * Excludes Sundays. Returns null if pincode is invalid (<6 digits).
 */

// First 2 digits of pincode → approximate region tier
// (Indian Postal Service zones — known metro hubs ship faster)
const METRO_PREFIXES = new Set([
  "11", // Delhi
  "40", // Mumbai
  "56", // Bangalore
  "60", // Chennai
  "70", // Kolkata
  "50", // Hyderabad
  "41", // Pune
  "38", // Ahmedabad
]);

const TIER1_FIRST_DIGITS = new Set(["1", "2", "3", "4", "5", "6", "7"]);

export type DeliveryTier = "metro" | "tier1" | "tier2" | "remote";

export function getDeliveryTier(pincode: string): DeliveryTier | null {
  const clean = (pincode || "").replace(/\D/g, "");
  if (clean.length < 6) return null;
  const first2 = clean.slice(0, 2);
  const first1 = clean.slice(0, 1);
  if (METRO_PREFIXES.has(first2)) return "metro";
  if (TIER1_FIRST_DIGITS.has(first1)) return "tier1";
  if (first1 === "8") return "tier2";
  return "remote"; // 9xxxxx — northeast, J&K
}

/**
 * Single, uniform promise across the whole platform: 5 days from today.
 * (Order on the 1st → delivery on the 6th.) No ranges, no tier drift —
 * PDP, checkout and WhatsApp must all show the exact same date.
 */
export const DELIVERY_DAYS = 5;

/** Add N calendar days; if it lands on a Sunday, push to Monday. */
export function addDeliveryDays(start: Date, days: number = DELIVERY_DAYS): Date {
  const d = new Date(start);
  d.setDate(d.getDate() + days);
  if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  return d;
}

export interface DeliveryEstimate {
  tier: DeliveryTier;
  minDate: Date;
  maxDate: Date;
  /** "Mon, 28 Apr" — short form for badges */
  shortLabel: string;
  /** "Mon, 28 Apr – Wed, 30 Apr" */
  rangeLabel: string;
  daysAway: number;
}

export function estimateDelivery(pincode: string, from: Date = new Date()): DeliveryEstimate | null {
  const tier = getDeliveryTier(pincode);
  if (!tier) return null;
  const { min, max } = DAYS_BY_TIER[tier];
  const minDate = addBusinessDays(from, min);
  const maxDate = addBusinessDays(from, max);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  const daysAway = Math.ceil((minDate.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
  return {
    tier,
    minDate,
    maxDate,
    shortLabel: fmt(minDate),
    rangeLabel: `${fmt(minDate)} – ${fmt(maxDate)}`,
    daysAway,
  };
}
