/**
 * Single source of truth for Meta Pixel `PageView` de-duplication.
 *
 * Why: PageView can be fired from three independent places —
 *   1. the inline bootstrap in index.html (first paint),
 *   2. `useFacebookPixel` (React fallback when the inline path didn't run),
 *   3. `StorefrontShell`'s SPA route-change effect.
 *
 * Each had its own ad-hoc guard, so an extra shell mount (theme switch,
 * Suspense re-mount, back/forward restore) could fire a second, byte-identical
 * PageView for the SAME path — which Meta's Ads Data Advisor flags as
 * "event fired twice with identical data".
 *
 * `claimPageView()` is the ONLY gate every caller must pass. It is:
 *   - per pixel + per path,
 *   - cross-tab (localStorage),
 *   - time-boxed (default 10s) so a genuine later revisit of the same page
 *     still counts.
 */

const DEFAULT_WINDOW_MS = 10_000;

function key(pixelId: string, path: string) {
  return `__sf_pv_dedup_${pixelId}_${path}`;
}

/**
 * Returns true when the caller is allowed to fire PageView for this
 * pixel + path, and atomically records the claim. Returns false when a
 * PageView was already fired for the same pixel + path inside the window.
 */
export function claimPageView(
  pixelId: string | null | undefined,
  path?: string,
  windowMs: number = DEFAULT_WINDOW_MS
): boolean {
  if (!pixelId) return false;
  if (typeof window === "undefined") return false;
  const p = path || window.location.pathname || "/";
  const k = key(pixelId, p);
  const now = Date.now();

  // In-memory first (survives storage being blocked in some WebViews).
  const mem: Record<string, number> =
    (window as any).__SF_PV_CLAIMS__ || ((window as any).__SF_PV_CLAIMS__ = {});
  if (mem[k] && now - mem[k] < windowMs) return false;

  try {
    const raw = localStorage.getItem(k);
    const last = raw ? Number(raw) || 0 : 0;
    if (last && now - last < windowMs) {
      mem[k] = last;
      return false;
    }
  } catch {}

  mem[k] = now;
  try {
    localStorage.setItem(k, String(now));
  } catch {}
  try {
    const bc = new BroadcastChannel("sf-pv");
    bc.postMessage({ k, t: now });
    bc.close();
  } catch {}
  return true;
}

/**
 * Records that a PageView was already fired for this pixel + path WITHOUT
 * firing one — used to register the inline bootstrap's boot-time PageView so
 * React never re-fires it for the same path.
 */
export function registerPageViewFired(pixelId: string | null | undefined, path?: string) {
  claimPageView(pixelId, path);
}
