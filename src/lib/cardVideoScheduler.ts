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

import { isSaveDataMode, isSlowConnection } from "@/lib/networkHints";

const MOBILE_MAX_WIDTH = 768;
/** Never arm earlier than this after the first registration. */
const ARM_FLOOR_MS = 1200;
/** A card must be at least this visible to be a playback candidate. */
const MIN_RATIO = 0.6;

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

/** One-shot capability check — cached for the page lifetime. */
let eligibleCache: boolean | null = null;

export function isCardVideoEligible(): boolean {
  if (eligibleCache !== null) return eligibleCache;
  if (typeof window === "undefined") return false;
  let ok = true;
  try {
    if (window.innerWidth > MOBILE_MAX_WIDTH) ok = false;
    // Coarse pointer is the real "mobile" signal; a narrow desktop window
    // shouldn't start pulling video.
    if (ok && window.matchMedia && !window.matchMedia("(pointer: coarse)").matches) ok = false;
    if (ok && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) ok = false;
    if (ok && (isSaveDataMode() || isSlowConnection())) ok = false;
  } catch {
    ok = false;
  }
  eligibleCache = ok;
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
    if (p && typeof p.catch === "function") p.catch(() => {});
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
    if (e.ratio < MIN_RATIO) return;
    const r = e.el.getBoundingClientRect();
    if (r.height === 0) return;
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
  const kick = () => window.setTimeout(arm, ARM_FLOOR_MS);
  const ric = (window as any).requestIdleCallback;
  if (typeof ric === "function") ric(kick, { timeout: 3000 });
  else window.setTimeout(kick, ARM_FLOOR_MS);
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
    { threshold: [0, 0.3, 0.6, 0.9] },
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
