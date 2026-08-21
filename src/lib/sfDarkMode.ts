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

/**
 * Store-scoped preference key. Path storefronts share one origin, while
 * subdomains/custom domains have their own host; including the resolved store
 * identity prevents one preview/store from switching another one to dark.
 */
export function getSfDarkKey(): string {
  if (typeof window === "undefined") return SF_DARK_KEY;
  try {
    const pathSlug = window.location.pathname.match(/^\/store\/([^/?#]+)/)?.[1];
    const host = window.location.hostname.toLowerCase();
    const injectedSlug = window.__STORE_SLUG__;
    const platformSlug = host.endsWith(".shopbanao.in") ? host.slice(0, -".shopbanao.in".length) : "";
    const identity = injectedSlug || pathSlug || platformSlug || host;
    return `${SF_DARK_KEY}:${identity || "default"}`;
  } catch {
    return `${SF_DARK_KEY}:default`;
  }
}

export function readSfDark(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(getSfDarkKey()) === "1";
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
    localStorage.setItem(getSfDarkKey(), on ? "1" : "0");
    // Remove the old global preference so it can never leak into another
    // storefront that shares this browser origin.
    localStorage.removeItem(SF_DARK_KEY);
  } catch {
    /* private mode — session only */
  }
  applySfDarkClass(on && !isCheckoutPath());
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SF_DARK_EVENT, { detail: on }));
  }
}
