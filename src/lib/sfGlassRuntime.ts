/**
 * sfGlassRuntime — capability gate for the storefront glass system.
 *
 * Adds `sfg-off` to <html> when the device can't afford live backdrop blur, so
 * every `.sfg` surface falls back to a solid tint with identical geometry
 * (no layout shift, no re-render, no React involvement).
 *
 * Deliberately conservative: modern Chrome/Android composites backdrop-filter
 * on the GPU cheaply, so we only bail on genuinely constrained hardware.
 */

let done = false;

export function initSfGlass() {
  if (done || typeof window === "undefined") return;
  done = true;

  const root = document.documentElement;
  const mem = (navigator as any).deviceMemory as number | undefined;
  const cores = navigator.hardwareConcurrency;

  const unsupported =
    typeof CSS === "undefined" ||
    !(
      CSS.supports?.("backdrop-filter", "blur(2px)") ||
      CSS.supports?.("-webkit-backdrop-filter", "blur(2px)")
    );

  // deviceMemory is only reported by Chromium; undefined means "assume fine".
  const tooWeak = (typeof mem === "number" && mem <= 1) || (typeof cores === "number" && cores <= 2);

  const saveData = (navigator as any).connection?.saveData === true;

  // While the page scrolls, pause decorative loops and swap SVG refraction for
  // plain GPU blur: both otherwise repaint on every scroll frame on phones.
  let idle: ReturnType<typeof setTimeout> | undefined;
  window.addEventListener("scroll", () => {
    if (!idle) root.classList.add("sf-scrolling");
    else clearTimeout(idle);
    idle = setTimeout(() => { idle = undefined; root.classList.remove("sf-scrolling"); }, 180);
  }, { passive: true });

  if (unsupported || tooWeak || saveData) {
    root.classList.add("sfg-off");
  } else {
    root.classList.remove("sfg-off");
  }
}

/** True when live glass is actually painting (used to skip refraction work). */
export function sfGlassActive() {
  return typeof document !== "undefined" && !document.documentElement.classList.contains("sfg-off");
}
