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

/** Adds/removes the root class. Safe to call repeatedly. */
export function applySfDarkClass(on: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle(SF_DARK_CLASS, on);
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
