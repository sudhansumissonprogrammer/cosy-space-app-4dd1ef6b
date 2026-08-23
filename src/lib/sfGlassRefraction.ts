/**
 * sfGlassRefraction — upgrades every `.sfg` surface from "frosted blur" to real
 * Apple-style refraction (SVG displacement inside `backdrop-filter`).
 *
 * Plain `backdrop-filter: blur()` reads as flat plastic. Apple's material bends
 * the content behind the panel at its rim with a faint prism fringe while the
 * interior stays legible — that is what `src/lib/liquidGlass.ts` produces.
 *
 * This module wires that optics module to the CSS class system automatically:
 *   - Chromium only (the optics module falls back on Safari/Firefox anyway).
 *   - Skipped entirely when `html.sfg-off` (low-end device gate).
 *   - Only attaches to elements currently in/near the viewport, capped, and
 *     never to panels larger than ~900px per side (GPU cost).
 *   - Opt out per element with `data-sfg-flat`.
 */

import { liquidGlass, liquidGlassSupported, type LiquidGlassHandle } from "@/lib/liquidGlass";
import { sfGlassActive } from "@/lib/sfGlassRuntime";

const MAX_LIVE = 10;
const MAX_SIDE = 900;

const handles = new WeakMap<Element, LiquidGlassHandle>();
let live = 0;
let io: IntersectionObserver | null = null;
let mo: MutationObserver | null = null;
let started = false;

/** Shape-aware optics: bars want a soft wide bend, pills a tight bright rim. */
function optionsFor(el: HTMLElement) {
  const cl = el.classList;
  if (cl.contains("sfg-pill") || cl.contains("sfg-chip")) {
    return { scale: -84, chroma: 5, border: 0.14, mapBlur: 7, blur: 5, saturate: 1.7 };
  }
  if (cl.contains("sfg-sheet") || cl.contains("sfg-panel")) {
    return { scale: -110, chroma: 6, border: 0.06, mapBlur: 14, blur: 7, saturate: 1.6 };
  }
  // bars + anything else
  return { scale: -96, chroma: 5, border: 0.05, mapBlur: 16, blur: 6, saturate: 1.6 };
}

function attach(el: HTMLElement) {
  if (handles.has(el) || live >= MAX_LIVE) return;
  if (el.dataset.sfgFlat !== undefined) return;
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  if (!w || !h || w > MAX_SIDE || h > MAX_SIDE) return;
  // Header that only glasses on scroll: wait until it is actually glass.
  if (el.classList.contains("sfg-on-scroll") && !el.classList.contains("is-glass")) return;
  handles.set(el, liquidGlass(el, optionsFor(el)));
  el.classList.add("sfg-refract");
  live++;
}

function detach(el: HTMLElement) {
  const h = handles.get(el);
  if (!h) return;
  h.destroy();
  handles.delete(el);
  el.classList.remove("sfg-refract");
  live--;
}

function scan(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>(".sfg").forEach((el) => io?.observe(el));
}

export function initSfGlassRefraction() {
  if (started || typeof window === "undefined") return;
  if (!liquidGlassSupported || !sfGlassActive()) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  started = true;

  io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const el = e.target as HTMLElement;
        if (e.isIntersecting) attach(el);
        else detach(el);
      }
    },
    { rootMargin: "120px" },
  );

  scan();

  mo = new MutationObserver((records) => {
    for (const r of records) {
      r.addedNodes.forEach((n) => {
        if (!(n instanceof HTMLElement)) return;
        if (n.classList.contains("sfg")) io?.observe(n);
        scan(n);
      });
      r.removedNodes.forEach((n) => {
        if (n instanceof HTMLElement && handles.has(n)) detach(n);
      });
      if (r.type === "attributes" && r.target instanceof HTMLElement) {
        const el = r.target;
        if (el.classList.contains("sfg")) io?.observe(el);
        else if (handles.has(el)) detach(el);
      }
    }
  });
  mo.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class"],
  });
}

export default initSfGlassRefraction;
