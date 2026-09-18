export type TrackingAvailability = "live" | "temporarily_unavailable" | "manual";

export function trackingAvailability(lastError?: string | null): TrackingAvailability {
  if (!lastError) return "live";
  if (/captcha_required|17track: no scans|public tracking unavailable/i.test(lastError)) {
    return "temporarily_unavailable";
  }
  return "manual";
}

export function trackingUnavailableMessage(hasCourierScans: boolean): string {
  return hasCourierScans
    ? "The courier's live service is temporarily unavailable. Showing the last confirmed scans below."
    : "Live courier scans are temporarily unavailable. Use official courier tracking to check the latest movement.";
}