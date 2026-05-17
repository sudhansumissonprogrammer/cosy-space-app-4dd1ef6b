/**
 * Network condition hints — used to adapt image quality, preloading,
 * and eager loading decisions for slow/data-saving users.
 *
 * Uses the Network Information API (navigator.connection). Falls back
 * to "fast" assumptions when the API isn't available (Safari, Firefox).
 */

type Conn = {
  saveData?: boolean;
  effectiveType?: string; // 'slow-2g' | '2g' | '3g' | '4g'
  downlink?: number; // Mbps
};

function getConn(): Conn | undefined {
  if (typeof navigator === "undefined") return undefined;
  return (navigator as any).connection as Conn | undefined;
}

/** User has explicitly opted into data-saving mode. */
export function isSaveDataMode(): boolean {
  return getConn()?.saveData === true;
}

/** 2G or slow-2G connection. */
export function is2G(): boolean {
  const t = getConn()?.effectiveType || "";
  return /(?:^|-)2g/.test(t);
}

/** 3G or slower (includes 2G). */
export function isSlowConnection(): boolean {
  const t = getConn()?.effectiveType || "";
  return /2g|3g/.test(t);
}

/**
 * Adaptive image quality:
 *   - save-data / 2G → 50  (visible compression OK, save bytes)
 *   - 3G              → 65
 *   - 4G+ / unknown   → defaultQ (caller's preference)
 */
export function getAdaptiveQuality(defaultQ: number = 82): number {
  if (isSaveDataMode() || is2G()) return 50;
  if (isSlowConnection()) return 65;
  return defaultQ;
}

/**
 * Whether the LCP hero should still preload + use fetchPriority=high.
 * Returns false on save-data so the browser keeps bandwidth for critical
 * JSON/JS instead.
 */
export function shouldPreloadLcp(): boolean {
  if (isSaveDataMode()) return false;
  if (is2G()) return false;
  return true;
}
