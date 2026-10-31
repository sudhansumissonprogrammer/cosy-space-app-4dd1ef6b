/** Daily archives contain counts, not identities for whole-range deduplication. */
export function analyticsVisitorTitle(measurement?: string): string {
  return measurement === "daily_aggregates" ? "Visitors (daily totals)" : "Unique Visitors";
}