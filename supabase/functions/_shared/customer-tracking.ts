/** Customer links only; Valmo does not imply API-backed status polling. */
export function customerTrackingUrl(slug: string | null | undefined, awb: string): string {
  const number = awb.trim();
  if (slug === "valmo") return `https://www.valmo.in/track/${encodeURIComponent(number)}`;
  const payload = btoa(JSON.stringify({ t: number, c: "speedpost" }));
  return `https://speedposttrack.io/tracking-result?d=${encodeURIComponent(payload)}&utm_source=copy&utm_medium=share&utm_campaign=parcel_tracking`;
}

export function validShipmentTrackingNumber(awb: string): boolean {
  return /^[A-Za-z0-9._-]{4,40}$/.test(awb.trim());
}