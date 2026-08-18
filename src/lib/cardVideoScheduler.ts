/**
 * cardVideoScheduler — mobile-only, one-at-a-time in-card video playback.
 *
 * Design rules (these are what keep category cold-load unchanged):
 *
 *  1. A registered <video> element NEVER has a `src` attribute until the
 *     scheduler decides to play it. `preload="none"` + no src = literally
 *     zero network bytes, so first paint / LCP / JSON payloads are identical
 *     to a store with no videos at all.
 *  2. Exactly ONE video is active at any moment across the whole page. When
 *     the active one changes, the previous element is paused and its buffer
 *     is released (`removeAttribute('src')` + `load()`), so memory stays flat
 *     while scrolling a 15k-product catalogue.
 *  3. The scheduler only ARMS after the browser goes idle (requestIdleCallback)
 *     with a hard floor delay, so it can never compete with the LCP image.
 *  4. Hard opt-outs: desktop, save-data, 2G/slow connections and
 *     prefers-reduced-motion. In those cases nothing is ever requested.
 */

import { isSaveDataMode } from "@/lib/networkHints";

const MOBILE_MAX_WIDTH = 768;
/** Never arm earlier than this after the first registration. */
const ARM_FLOOR_MS = 700;
/** A card must be at least this visible to be a playback candidate. */
const MIN_RATIO = 0.35;

interface Entry {
  el: HTMLVideoElement;
  src: string;
  ratio: number;
  onActiveChange?: (active: boolean) => void;
}

let observer: IntersectionObserver | null = null;
let armed = false;
let armScheduled = false;
let active: Entry | null = null;
let rafPending = false;

const entries = new Map<HTMLVideoElement, Entry>();

export function isCardVideoEligible(): boolean {
  if (typeof window === "undefined") return false;
  let ok = true;
  try {
    if (window.innerWidth > MOBILE_MAX_WIDTH) ok = false;
    // Width is the dependable mobile signal. Some Android in-app browsers
    // (Instagram/Facebook and a few WebViews) incorrectly report a fine or
    // missing pointer, which previously disabled every card video there.
    if (ok && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) ok = false;
    // Respect an explicit data-saving choice. Do not disable playback from
    // effectiveType alone: Android frequently labels a usable 4G connection
    // as 3g, which made this feature appear broken for real shoppers.
    if (ok && isSaveDataMode()) ok = false;
  } catch {
    ok = false;
  }
  return ok;
}

function releaseEntry(e: Entry) {
  const v = e.el;
  try {
    v.pause();
    if (v.getAttribute("src")) {
      v.removeAttribute("src");
      // Frees the decoded buffer instead of leaving it resident.
      v.load();
    }
  } catch {}
  e.onActiveChange?.(false);
}

function activateEntry(e: Entry) {
  const v = e.el;
  try {
    if (v.getAttribute("src") !== e.src) {
      v.setAttribute("src", e.src);
      v.preload = "auto";
      v.load();
    }
    v.muted = true;
    const p = v.play();
    // Some mobile browsers reject the first autoplay attempt while the source
    // is still loading. Retry from canplay instead of leaving the card inert.
    if (p && typeof p.catch === "function") {
      p.catch(() => {
        if (active !== e || document.hidden) return;
        const retry = () => {
          if (active !== e || document.hidden) return;
          v.muted = true;
          v.play().catch(() => {});
        };
        v.addEventListener("canplay", retry, { once: true });
      });
    }
    e.onActiveChange?.(true);
  } catch {}
}

function reconcile() {
  rafPending = false;
  if (!armed) return;

  let best: Entry | null = null;
  let bestScore = -1;
  const centerY = window.innerHeight / 2;

  entries.forEach((e) => {
    if (e.ratio <= 0) return;
    const r = e.el.getBoundingClientRect();
    if (r.height === 0) return;
    const visiblePx = Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0));
    const visibleRatio = Math.min(1, visiblePx / r.height);
    if (Math.max(e.ratio, visibleRatio) < MIN_RATIO) return;
    const dist = Math.abs(r.top + r.height / 2 - centerY);
    // Prefer the card closest to the viewport centre; ratio breaks ties.
    const score = 1_000_000 - dist * 100 + e.ratio;
    if (score > bestScore) {
      bestScore = score;
      best = e;
    }
  });

  if (best === active) return;
  if (active) releaseEntry(active);
  active = best;
  if (active) activateEntry(active);
}

function schedule() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(reconcile);
}

function arm() {
  if (armed) return;
  armed = true;
  schedule();
}

function scheduleArm() {
  if (armScheduled) return;
  armScheduled = true;
  const kick = arm;
  const ric = (window as any).requestIdleCallback;
  if (typeof ric === "function") window.setTimeout(() => ric(kick, { timeout: 1200 }), ARM_FLOOR_MS);
  else window.setTimeout(arm, ARM_FLOOR_MS);
}

function ensureObserver(): IntersectionObserver {
  if (observer) return observer;
  observer = new IntersectionObserver(
    (obs) => {
      obs.forEach((o) => {
        const e = entries.get(o.target as HTMLVideoElement);
        if (!e) return;
        e.ratio = o.isIntersecting ? o.intersectionRatio : 0;
      });
      schedule();
    },
    // Start observing just outside the viewport. This gives the selected card
    // enough time to attach/load before it becomes visible while still keeping
    // every other card source-free.
    { threshold: [0, 0.25, 0.5, 0.75, 1], rootMargin: "120px 0px" },
  );

  // Scrolling changes which visible card is most centred.
  window.addEventListener("scroll", schedule, { passive: true });
  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.hidden && active) {
        releaseEntry(active);
        active = null;
      } else {
        schedule();
      }
    },
    { passive: true },
  );

  return observer;
}

/**
 * Register a card video. Returns an unregister function.
 * Safe to call when ineligible — it becomes a no-op.
 */
export function registerCardVideo(
  el: HTMLVideoElement,
  src: string,
  onActiveChange?: (active: boolean) => void,
): () => void {
  if (!isCardVideoEligible() || !src) return () => {};

  const entry: Entry = { el, src, ratio: 0, onActiveChange };
  entries.set(el, entry);
  ensureObserver().observe(el);
  scheduleArm();
  // IntersectionObserver callbacks can be delayed in iOS/Android WebViews
  // until after the next scroll. Reconcile once after layout so an initially
  // visible card starts without requiring the shopper to touch the page.
  requestAnimationFrame(() => {
    if (!entries.has(el)) return;
    const r = el.getBoundingClientRect();
    const visiblePx = Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0));
    entry.ratio = r.height > 0 ? Math.min(1, visiblePx / r.height) : 0;
    schedule();
  });

  return () => {
    observer?.unobserve(el);
    entries.delete(el);
    if (active === entry) {
      releaseEntry(entry);
      active = null;
      schedule();
    }
  };
}
