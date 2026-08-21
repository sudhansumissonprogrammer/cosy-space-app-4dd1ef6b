/**
 * Storefront dark mode ("Dark Streetwear") — Theme 16 (Classic + Quick Buy) only.
 *
 * Rules:
 *  - Default is ALWAYS light. Nothing changes unless the shopper opts in.
 *  - Preference is per-device (localStorage).
 *  - Never applied on /checkout — checkout stays pixel-identical.
 *  - Zero cold-load cost: CSS + toggle ship inside the theme-16 chunk and the
 *    class is applied synchronously before the storefront tree paints.
 */

export const SF_DARK_KEY = "sf_dark_mode";
export const SF_DARK_CLASS = "sf-dark";
export const SF_DARK_EVENT = "sf-dark-change";

export function isCheckoutPath(
  pathname: string = typeof window !== "undefined" ? window.location.pathname : ""
) {
  return pathname.includes("/checkout");
}

export function readSfDark(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(SF_DARK_KEY) === "1";
  } catch {
    return false;
  }
}

/** The surface the dark palette paints on — keep in sync with sf-dark.css. */
export const SF_DARK_SURFACE = "#0a0a0a";

/**
 * Keeps the mobile browser chrome (address bar / status bar) in step with the
 * storefront. Without this the phone UI stays white while the page is black,
 * which is the most visible part of the screen on mobile.
 */
function syncThemeColor(on: boolean) {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) return;
  if (on) {
    if (!meta.dataset.sfLight) meta.dataset.sfLight = meta.content || "";
    meta.content = SF_DARK_SURFACE;
  } else if (meta.dataset.sfLight !== undefined) {
    meta.content = meta.dataset.sfLight;
    delete meta.dataset.sfLight;
  }
}

/**
 * Removes any transition overlay left on document.body. The animation host is
 * created outside React (see sfDarkTransition), so an SPA navigation during
 * the animation would otherwise leave a full-viewport, click-blocking layer on
 * the next screen. Lives here (not in the transition module) so layouts can
 * call it without pulling the animation engine into their chunk.
 */
export function removeSfDarkOverlays() {
  if (typeof document === "undefined") return;
  document.querySelectorAll("[data-sf-dark-overlay]").forEach((node) => {
    try {
      node.remove();
    } catch {
      /* ignore */
    }
  });
}

/** Adds/removes the root class. Safe to call repeatedly. */
export function applySfDarkClass(on: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle(SF_DARK_CLASS, on);
  syncThemeColor(on);
}

export function setSfDark(on: boolean) {
  try {
    localStorage.setItem(SF_DARK_KEY, on ? "1" : "0");
  } catch {
    /* private mode — session only */
  }
  applySfDarkClass(on && !isCheckoutPath());
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SF_DARK_EVENT, { detail: on }));
  }
}
