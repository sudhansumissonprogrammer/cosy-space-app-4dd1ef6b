/**
 * Premium night-mode switch animations (Theme 16 "Classic + Quick Buy").
 *
 * The merchant picks one effect in Theme Settings; the shopper sees it every
 * time they flip the header toggle.
 *
 * How it works (deliberately simple + safe):
 *  1. A full-screen overlay painted in the *destination* colour animates IN.
 *  2. Once the screen is fully covered we flip the `sf-dark` class — so the
 *     repaint happens behind an opaque layer and the shopper never sees a
 *     flash of half-themed UI.
 *  3. The overlay animates OUT, revealing the new theme.
 *
 * Guarantees:
 *  - Uses the Web Animations API only (no library, no snapshotting, no CSS
 *    injected into the page's stylesheet).
 *  - `prefers-reduced-motion`, unsupported browsers, hidden tabs and any
 *    thrown error all fall back to an instant switch.
 *  - A hard watchdog always applies the theme and removes the overlay, so a
 *    stalled animation can never leave the storefront covered.
 *  - Nothing is loaded or executed until the shopper actually taps the toggle
 *    (this module lives in the toggle's lazy chunk) → zero cold-load cost.
 */

export const SF_DARK_EFFECTS = [
  "spotlight",
  "curtain",
  "blinds",
  "eclipse",
  "dissolve",
  "none",
] as const;

export type SfDarkEffect = (typeof SF_DARK_EFFECTS)[number];

export const DEFAULT_SF_DARK_EFFECT: SfDarkEffect = "spotlight";

export function normalizeSfDarkEffect(value: unknown): SfDarkEffect {
  return SF_DARK_EFFECTS.includes(value as SfDarkEffect)
    ? (value as SfDarkEffect)
    : DEFAULT_SF_DARK_EFFECT;
}

const DARK_SURFACE = "#0a0a0a";
const OVERLAY_Z = 2147483000;
const EASE_IN = "cubic-bezier(0.65, 0, 0.35, 1)";
const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";
const WATCHDOG_MS = 2600;

let running = false;

/** Destination background: the dark surface, or the store's own light background. */
function targetColor(toDark: boolean): string {
  if (toDark) return DARK_SURFACE;
  if (typeof window === "undefined") return "#ffffff";
  try {
    const bg = getComputedStyle(document.body).backgroundColor;
    if (bg && !bg.includes("rgba(0, 0, 0, 0)") && bg !== "transparent") return bg;
  } catch {
    /* ignore */
  }
  return "#ffffff";
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function supportsWaapi(): boolean {
  return typeof document !== "undefined" && typeof (document.createElement("div") as any).animate === "function";
}

function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function play(el: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions): Promise<void> {
  try {
    const animation = el.animate(keyframes, { fill: "both", ...options });
    return animation.finished.catch(() => undefined).then(() => undefined);
  } catch {
    return Promise.resolve();
  }
}

function makeHost(): HTMLDivElement {
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.dataset.sfDarkOverlay = "1";
  Object.assign(host.style, {
    position: "fixed",
    inset: "0",
    zIndex: String(OVERLAY_Z),
    pointerEvents: "auto",
    overflow: "hidden",
    contain: "strict",
  } as CSSStyleDeclaration);
  return host;
}

function fillLayer(color: string): HTMLDivElement {
  const layer = document.createElement("div");
  Object.assign(layer.style, {
    position: "absolute",
    inset: "0",
    backgroundColor: color,
    willChange: "transform, opacity, clip-path",
  } as CSSStyleDeclaration);
  return layer;
}

type Phase = { cover: () => Promise<void>; reveal: () => Promise<void> };

/**
 * Overlay geometry. All effect coordinates are expressed **relative to the
 * overlay host**, never to the window: on mobile the visual viewport can be
 * offset/zoomed (URL bar, pinch zoom, keyboard) so window.innerWidth/scroll
 * based maths makes the reveal start from the wrong spot. Measuring the host
 * itself is exact on every device.
 */
let hostSize = { w: 0, h: 0 };

/** Radius needed for a circle at (x, y) to cover the whole overlay. */
function coverRadius(x: number, y: number) {
  const w = hostSize.w || window.innerWidth;
  const h = hostSize.h || window.innerHeight;
  return Math.hypot(Math.max(x, w - x), Math.max(y, h - y));
}


function buildEffect(
  effect: SfDarkEffect,
  host: HTMLDivElement,
  color: string,
  toDark: boolean,
  origin: { x: number; y: number }
): Phase {
  const { x, y } = origin;

  if (effect === "curtain") {
    const layer = fillLayer(color);
    layer.style.backgroundImage = toDark
      ? "linear-gradient(180deg, #1c1c1c 0%, #0a0a0a 60%)"
      : "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(240,240,240,0.98) 60%)";
    layer.style.boxShadow = "0 24px 60px rgba(0,0,0,0.45)";
    host.appendChild(layer);
    return {
      cover: () =>
        play(layer, [{ transform: "translate3d(0,-100%,0)" }, { transform: "translate3d(0,0,0)" }], {
          duration: 420,
          easing: EASE_IN,
        }),
      reveal: () =>
        play(layer, [{ transform: "translate3d(0,0,0)" }, { transform: "translate3d(0,100%,0)" }], {
          duration: 460,
          easing: EASE_OUT,
        }),
    };
  }

  if (effect === "blinds") {
    const SLATS = 7;
    const slats: HTMLDivElement[] = [];
    for (let i = 0; i < SLATS; i++) {
      const slat = document.createElement("div");
      Object.assign(slat.style, {
        position: "absolute",
        top: "0",
        bottom: "0",
        left: `${(i * 100) / SLATS}%`,
        width: `${100 / SLATS + 0.2}%`,
        backgroundColor: color,
        transformOrigin: "top center",
        willChange: "transform",
      } as CSSStyleDeclaration);
      host.appendChild(slat);
      slats.push(slat);
    }
    return {
      cover: () =>
        Promise.all(
          slats.map((slat, i) =>
            play(slat, [{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }], {
              duration: 320,
              delay: i * 45,
              easing: EASE_IN,
            })
          )
        ).then(() => undefined),
      reveal: () =>
        Promise.all(
          slats.map((slat, i) => {
            slat.style.transformOrigin = "bottom center";
            return play(slat, [{ transform: "scaleY(1)" }, { transform: "scaleY(0)" }], {
              duration: 320,
              delay: (SLATS - 1 - i) * 45,
              easing: EASE_OUT,
            });
          })
        ).then(() => undefined),
    };
  }

  if (effect === "eclipse") {
    const wash = fillLayer(color);
    wash.style.opacity = "0";
    const disc = document.createElement("div");
    const r = coverRadius(x, y);
    Object.assign(disc.style, {
      position: "absolute",
      left: `${x - r}px`,
      top: `${y - r}px`,
      width: `${r * 2}px`,
      height: `${r * 2}px`,
      borderRadius: "50%",
      background: toDark
        ? "radial-gradient(circle, #0a0a0a 58%, #171717 72%, rgba(255,214,138,0.55) 76%, rgba(255,214,138,0) 82%)"
        : `radial-gradient(circle, ${color} 58%, rgba(255,255,255,0.9) 72%, rgba(255,196,84,0.5) 76%, rgba(255,196,84,0) 82%)`,
      willChange: "transform, opacity",
    } as CSSStyleDeclaration);
    host.appendChild(wash);
    host.appendChild(disc);
    return {
      cover: () =>
        Promise.all([
          play(disc, [
            { transform: "scale(0.02) rotate(-25deg)", opacity: 0.6 },
            { transform: "scale(1) rotate(0deg)", opacity: 1 },
          ], { duration: 520, easing: EASE_IN }),
          play(wash, [{ opacity: 0 }, { opacity: 1 }], { duration: 520, easing: "linear" }),
        ]).then(() => undefined),
      reveal: () =>
        Promise.all([
          play(disc, [{ opacity: 1 }, { opacity: 0 }], { duration: 340, easing: EASE_OUT }),
          play(wash, [{ opacity: 1 }, { opacity: 0 }], { duration: 380, easing: EASE_OUT }),
        ]).then(() => undefined),
    };
  }

  if (effect === "dissolve") {
    const layer = fillLayer(color);
    layer.style.opacity = "0";
    layer.style.backdropFilter = "blur(18px) saturate(120%)";
    (layer.style as any).webkitBackdropFilter = "blur(18px) saturate(120%)";
    host.appendChild(layer);
    return {
      cover: () =>
        play(layer, [
          { opacity: 0, transform: "scale(1.04)" },
          { opacity: 1, transform: "scale(1)" },
        ], { duration: 340, easing: EASE_IN }),
      reveal: () =>
        play(layer, [
          { opacity: 1, transform: "scale(1)" },
          { opacity: 0, transform: "scale(1.06)" },
        ], { duration: 420, easing: EASE_OUT }),
    };
  }

  // "spotlight" — circular wipe out of the toggle button (default).
  const layer = fillLayer(color);
  const r = coverRadius(x, y);
  layer.style.clipPath = `circle(0px at ${x}px ${y}px)`;
  host.appendChild(layer);
  const glow = document.createElement("div");
  Object.assign(glow.style, {
    position: "absolute",
    left: `${x - 26}px`,
    top: `${y - 26}px`,
    width: "52px",
    height: "52px",
    borderRadius: "50%",
    boxShadow: toDark ? "0 0 40px 12px rgba(255,255,255,0.35)" : "0 0 40px 12px rgba(0,0,0,0.18)",
    opacity: "0",
  } as CSSStyleDeclaration);
  host.appendChild(glow);
  return {
    cover: () =>
      Promise.all([
        play(layer, [
          { clipPath: `circle(0px at ${x}px ${y}px)` },
          { clipPath: `circle(${r}px at ${x}px ${y}px)` },
        ], { duration: 480, easing: EASE_IN }),
        play(glow, [{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], { duration: 480, easing: "linear" }),
      ]).then(() => undefined),
    reveal: () => play(layer, [{ opacity: 1 }, { opacity: 0 }], { duration: 320, easing: EASE_OUT }),
  };
}

/**
 * Runs the chosen effect and calls `apply()` exactly once, while the screen is
 * covered. Always resolves; never leaves an overlay behind.
 */
export async function runSfDarkTransition(
  effect: SfDarkEffect,
  origin: { x: number; y: number } | null,
  toDark: boolean,
  apply: () => void
): Promise<void> {
  let applied = false;
  const applyOnce = () => {
    if (applied) return;
    applied = true;
    apply();
  };

  if (
    effect === "none" ||
    running ||
    typeof document === "undefined" ||
    !document.body ||
    document.visibilityState === "hidden" ||
    prefersReducedMotion() ||
    !supportsWaapi()
  ) {
    applyOnce();
    return;
  }

  running = true;
  const host = makeHost();
  const cleanup = () => {
    applyOnce();
    try {
      host.remove();
    } catch {
      /* already detached */
    }
    running = false;
  };
  const watchdog = window.setTimeout(cleanup, WATCHDOG_MS);

  try {
    // Mount first, then measure: the host is the exact surface the effects
    // paint on, so its own box (not the window) defines the coordinate space.
    document.body.appendChild(host);
    const hostRect = host.getBoundingClientRect();
    hostSize = { w: hostRect.width || window.innerWidth, h: hostRect.height || window.innerHeight };
    const raw = origin ?? { x: hostRect.left + hostSize.w / 2, y: hostRect.top };
    const point = {
      x: Math.min(Math.max(raw.x - hostRect.left, 0), hostSize.w),
      y: Math.min(Math.max(raw.y - hostRect.top, 0), hostSize.h),
    };
    const phase = buildEffect(effect, host, targetColor(toDark), toDark, point);
    await phase.cover();
    applyOnce();
    await nextPaint();
    await phase.reveal();
  } catch {

    /* fall through to cleanup — the theme still flips */
  } finally {
    window.clearTimeout(watchdog);
    cleanup();
  }
}
