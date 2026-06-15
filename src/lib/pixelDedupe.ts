/**
 * Per-event rapid-tap dedupe for Meta Pixel calls.
 *
 * Problem
 * -------
 * A shopper can tap "Add to Cart" 3–5× in a second (touch lag, bouncy UX,
 * accidental double-taps). Each tap fires an `AddToCart` event. Meta sees the
 * burst as event inflation / bot-like traffic — a known low-quality signal
 * that contributes to pixel/ad-account flags.
 *
 * The cart quantity still increments correctly — only the TRACKING event is
 * throttled. UX is unchanged.
 *
 * Usage
 * -----
 *   if (shouldFirePixelEvent("AddToCart", productId, variantId)) {
 *     fbPixelTrack("AddToCart", ...);
 *     fireMetaCAPI(...);
 *   }
 */

const DEFAULT_WINDOW_MS = 1500;
const lastFired = new Map<string, number>();

export function shouldFirePixelEvent(
  eventName: string,
  ...keyParts: (string | undefined | null)[]
): boolean {
  const key = `${eventName}|${keyParts.filter(Boolean).join("|")}`;
  const now = Date.now();
  const prev = lastFired.get(key);
  if (prev && now - prev < DEFAULT_WINDOW_MS) return false;
  lastFired.set(key, now);

  // Light cleanup so the map doesn't grow unbounded in long sessions.
  if (lastFired.size > 200) {
    for (const [k, t] of lastFired) {
      if (now - t > DEFAULT_WINDOW_MS * 4) lastFired.delete(k);
    }
  }
  return true;
}
