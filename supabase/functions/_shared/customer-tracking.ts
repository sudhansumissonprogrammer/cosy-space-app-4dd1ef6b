/** Speed Post Track courier codes; anything unlisted opens as India Post. */
const SPEEDPOST_TRACK_COURIER: Record<string, string> = {
  delhivery: "delhivery",
  dtdc: "dtdc",
  bluedart: "bluedart",
  ekart: "ekart",
  shadowfax: "shadowfax",
  xpressbees: "xpressbees",
};

/** Customer links only; Valmo does not imply API-backed status polling. */
export function customerTrackingUrl(slug: string | null | undefined, awb: string): string {
  const number = awb.trim();
  if (slug === "valmo") return `https://www.valmo.in/track/${encodeURIComponent(number)}`;
  // The courier code must match the parcel's courier, otherwise the site
  // looks the number up as India Post and shows "invalid tracking number".
  const c = SPEEDPOST_TRACK_COURIER[String(slug || "").toLowerCase()] || "speedpost";
  const payload = btoa(JSON.stringify({ t: number, c }));
  return `https://speedposttrack.io/tracking-result?d=${encodeURIComponent(payload)}&utm_source=copy&utm_medium=share&utm_campaign=parcel_tracking`;
}

export function validShipmentTrackingNumber(awb: string): boolean {
  return /^[A-Za-z0-9._-]{4,40}$/.test(awb.trim());
}
