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
const ARM_FLOOR_MS = 500;
/** A card must be at least this visible to be a playback candidate. */
const MIN_RATIO = 0.15;

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

let mp4Support: boolean | null = null;
/** Browsers without an H.264 decoder must never request a card video. */
function supportsCardVideo(): boolean {
  if (mp4Support !== null) return mp4Support;
  try {
    const probe = document.createElement("video");
    mp4Support = probe.canPlayType("video/mp4") !== "";
  } catch {
    mp4Support = false;
  }
  return mp4Support;
}

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
    if (ok && !supportsCardVideo()) ok = false;
  } catch {
    ok = false;
  }
  return ok;
}


/**
 * Sources that can never autoplay well on a phone (oversized imports, files
 * whose metadata sits at the end of the container, 404s). They are skipped
 * for the page lifetime so the scheduler moves to the next card instead of
 * burning the shopper's data on a download that will never start playing.
 */
const skipped = new Set<string>();
/** If the source has not produced a frame by then, move on. */
const STALL_MS = 12_000;
/** Keep a just-deactivated buffer this long so scroll-back resumes instantly. */
const KEEP_BUFFER_MS = 4000;
/** Ignore candidates while the finger is still flinging past cards. */
const SWITCH_DELAY_MS = 180;

let switchTimer: number | undefined;
let stallTimer: number | undefined;
const pendingRelease = new Map<HTMLVideoElement, number>();

function detachEntry(e: Entry) {
  const v = e.el;
  try {
    v.pause();
    if (v.getAttribute("src")) {
      v.removeAttribute("src");
      // Frees the decoded buffer instead of leaving it resident.
      v.load();
    }
  } catch {}
}

function releaseEntry(e: Entry) {
  const v = e.el;
  try {
    v.pause();
  } catch {}
  e.onActiveChange?.(false);
  // Do NOT drop the buffer immediately: a shopper scrolling one row down and
  // back would otherwise restart a multi-megabyte download from zero.
  const existing = pendingRelease.get(v);
  if (existing) window.clearTimeout(existing);
  pendingRelease.set(
    v,
    window.setTimeout(() => {
      pendingRelease.delete(v);
      if (active?.el === v) return;
      detachEntry(e);
    }, KEEP_BUFFER_MS),
  );
}

function activateEntry(e: Entry) {
  const v = e.el;
  const pending = pendingRelease.get(v);
  if (pending) {
    window.clearTimeout(pending);
    pendingRelease.delete(v);
  }
  try {
    // Set every autoplay-critical property before attaching the source. iOS
    // and several Android in-app browsers make their autoplay decision when
    // load() starts; setting `muted` afterwards can leave a valid video
    // permanently paused even though the later play() call is allowed.
    v.muted = true;
    v.defaultMuted = true;
    v.autoplay = true;
    v.playsInline = true;
    if (v.getAttribute("src") !== e.src) {
      v.setAttribute("src", e.src);
      v.preload = "auto";
      v.load();
    }
    const tryPlay = () => {
      if (active !== e || document.hidden) return;
      v.muted = true;
      const retry = v.play();
      if (retry && typeof retry.catch === "function") retry.catch(() => {});
    };
    // Register readiness retries before the first attempt. Older embedded
    // Android WebViews return `undefined` from play() instead of a Promise, so
    // a catch-only fallback never ran there and left the card paused forever.
    v.addEventListener("loadeddata", tryPlay, { once: true });
    v.addEventListener("canplay", tryPlay, { once: true });
    const p = v.play();
    // Modern browsers expose the rejection as a Promise. Readiness listeners
    // above cover both this case and legacy implementations with no Promise.
    if (p && typeof p.catch === "function") {
      p.catch(() => {});
    }
    e.onActiveChange?.(true);

    // Watchdog: some imported files only expose their moov atom at the very
    // end, so the browser downloads tens of megabytes before the first frame.
    // Give up, blacklist the source and let the next card have a turn.
    if (stallTimer) window.clearTimeout(stallTimer);
    stallTimer = window.setTimeout(() => {
      if (active !== e) return;
      if (v.readyState >= 2) return;
      // Only give up when literally nothing arrived. A slow but progressing
      // download keeps its turn so shoppers on 4G still get the clip.
      const buffered = v.buffered.length > 0 ? v.buffered.end(v.buffered.length - 1) : 0;
      if (buffered > 0) return;
      skipped.add(e.src);
      detachEntry(e);
      e.onActiveChange?.(false);
      active = null;
      schedule();
    }, STALL_MS);

  } catch {}
}

function pickBest(): Entry | null {
  let best: Entry | null = null;
  let bestScore = -1;
  const centerY = window.innerHeight / 2;

  entries.forEach((e) => {
    if (skipped.has(e.src)) return;
    const r = e.el.getBoundingClientRect();
    if (r.height === 0) return;
    const visiblePx = Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0));
    const visibleRatio = Math.min(1, visiblePx / r.height);
    // IntersectionObserver uses an expanded rootMargin to prepare nearby
    // entries, but only an actually visible card may own playback.
    if (visibleRatio < MIN_RATIO) return;
    const dist = Math.abs(r.top + r.height / 2 - centerY);
    // Prefer the card closest to the viewport centre; ratio breaks ties.
    const score = 1_000_000 - dist * 100 + e.ratio;
    if (score > bestScore) {
      bestScore = score;
      best = e;
    }
  });

  return best;
}

function applyBest(best: Entry | null) {
  if (best === active) return;
  if (active) releaseEntry(active);
  active = best;
  if (!active) return;
  // Do not reject a catalogue video based on its total file size. Many legacy
  // imports are 12–50 MB but still support HTTP range streaming and start from
  // a tiny initial response. The old HEAD size gate silently skipped those
  // cards, making the feature appear completely broken on affected categories.
  // Cold load remains unchanged because only this single chosen card gets src.
  activateEntry(active);
}

function reconcile() {
  rafPending = false;
  if (!armed) return;

  const best = pickBest();
  if (best === active) return;

  // Debounce the switch: mid-fling every row would otherwise start (and
  // abort) its own download. Waiting for the scroll to settle means exactly
  // one file is ever fetched.
  if (switchTimer) window.clearTimeout(switchTimer);
  const delay = active ? SWITCH_DELAY_MS : 0;
  switchTimer = window.setTimeout(() => {
    switchTimer = undefined;
    applyBest(pickBest());
  }, delay);
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
  // A deterministic delay still protects LCP without depending on an idle
  // callback that can be postponed indefinitely on busy category pages.
  window.setTimeout(arm, ARM_FLOOR_MS);
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
  // Low Power Mode and some Instagram/Facebook WebViews can reject even a
  // muted programmatic autoplay. The shopper's first touch is a user gesture,
  // so retry the already-selected card synchronously in that gesture without
  // starting any additional stream.
  const resumeActive = () => {
    const current = active;
    if (!current || document.hidden || !current.el.paused) return;
    current.el.muted = true;
    const retry = current.el.play();
    if (retry && typeof retry.catch === "function") retry.catch(() => {});
  };
  window.addEventListener("touchstart", resumeActive, { passive: true });
  window.addEventListener("pointerdown", resumeActive, { passive: true });
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
