/**
 * Tiny haptic + tap-feedback helper for mobile bottom-nav switching.
 * Safe on every browser — silently no-ops where Vibration API is missing.
 *
 * Usage:
 *   <Link onClick={navTap} ...>
 *
 * Combine in your own handler if you also have e.preventDefault() etc:
 *   onClick={(e) => { navTap(); myHandler(e); }}
 */
export function navTap() {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      (navigator as Navigator).vibrate?.(8);
    }
  } catch {
    /* ignore */
  }
}
