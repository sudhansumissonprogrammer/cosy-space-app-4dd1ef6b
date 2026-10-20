/** Speed Post Track courier codes; anything unlisted opens as India Post. */
const SPEEDPOST_TRACK_COURIER: Record<string, string> = {
  delhivery: "delhivery",
  dtdc: "dtdc",
  bluedart: "bluedart",
  ekart: "ekart",
  shadowfax: "shadowfax",
  xpressbees: "xpressbees",
};

/** Courier-specific landing pages on Speed Post Track (same site, same payload). */
const SPEEDPOST_TRACK_LANDING: Record<string, string> = {
  shadowfax: "shadowfax-tracking",
};

/** Customer links only; Valmo does not imply API-backed status polling. */
export function customerTrackingUrl(slug: string | null | undefined, awb: string): string {
  const number = awb.trim();
  if (slug === "valmo") return `https://www.valmo.in/track/${encodeURIComponent(number)}`;
  // The courier code must match the parcel's courier, otherwise the site
  // looks the number up as India Post and shows "invalid tracking number".
  const key = String(slug || "").toLowerCase();
  const c = SPEEDPOST_TRACK_COURIER[key] || "speedpost";
  const payload = btoa(JSON.stringify({ t: number, c }));
  const query = `d=${encodeURIComponent(payload)}&utm_source=copy&utm_medium=share&utm_campaign=parcel_tracking`;
  if (SPEEDPOST_TRACK_LANDING[key]) {
    return `https://speedposttrack.io/${SPEEDPOST_TRACK_LANDING[key]}?${query}`;
  }
  return `https://speedposttrack.io/tracking-result?${query}`;
}

export function validShipmentTrackingNumber(awb: string): boolean {
  return /^[A-Za-z0-9._-]{4,40}$/.test(awb.trim());
}
