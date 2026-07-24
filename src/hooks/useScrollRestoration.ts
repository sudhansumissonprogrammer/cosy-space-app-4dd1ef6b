import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * Hydrogen/Remix-style scroll restoration for the storefront — with
 * Flipkart/Meesho-style "anchor restore" on top.
 *
 * Behavior:
 *  - PUSH      → scroll to top
 *  - POP (back/forward) → restore to the EXACT clicked element when possible,
 *                         falling back to the saved scrollY.
 *  - REPLACE   → leave scroll untouched
 *
 * Anchor restore works by listening to all link clicks at the document level
 * (capture phase). When the user taps a product card / category tile / any
 * <a>, we stash:
 *   { href, viewportTop }  ← keyed by the CURRENT history entry key
 * On POP back to that entry, if a matching link is still in the DOM we
 * `scrollTo` so the element sits at the same viewport offset it had when
 * tapped — survives lazy images, infinite-scroll re-renders, height shifts.
 *
 * Allow-list: routes in `skipPathPatterns` are skipped entirely (e.g. PDP
 * variant tab switches that just rewrite the URL).
 */
const STORAGE_PREFIX = "sf_scroll:";
const ANCHOR_PREFIX = "sf_anchor:";
const RESTORE_TIMEOUT_MS = 6000;

function getKey(): string {
  try {
    const k = (window.history.state && (window.history.state as any).key) || "default";
    return STORAGE_PREFIX + k;
  } catch {
    return STORAGE_PREFIX + "default";
  }
}

function getAnchorKey(): string {
  try {
    const k = (window.history.state && (window.history.state as any).key) || "default";
    return ANCHOR_PREFIX + k;
  } catch {
    return ANCHOR_PREFIX + "default";
  }
}

function saveScroll() {
  try {
    sessionStorage.setItem(getKey(), String(window.scrollY || 0));
  } catch {}
}

function readScroll(): number | null {
  try {
    const v = sessionStorage.getItem(getKey());
    if (v == null) return null;
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

interface AnchorInfo {
  href: string;
  viewportTop: number;
  documentTop?: number;
  /** Structural fingerprint of the clicked element (tag + nth-of-type chain up
   *  to ~10 ancestors). Lets us disambiguate the SAME product link that appears
   *  in multiple home sections (e.g. Best Selling carousel vs "Payal" category
   *  strip). Distance-based matching is unreliable on mobile where sections
   *  sit close together. */
  path?: string;
}

function saveAnchor(info: AnchorInfo) {
  try {
    sessionStorage.setItem(getAnchorKey(), JSON.stringify(info));
  } catch {}
}

function readAnchor(): AnchorInfo | null {
  try {
    const raw = sessionStorage.getItem(getAnchorKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.href !== "string") return null;
    return parsed as AnchorInfo;
  } catch {
    return null;
  }
}

/** Build a structural fingerprint for an element: TAG[nth]>TAG[nth]>... up
 *  to `maxDepth` ancestors or until BODY. Uses nth-of-type so that lazily
 *  mounted siblings of different tags don't shift the index. */
function pathFingerprint(el: Element | null, maxDepth = 10): string {
  const parts: string[] = [];
  let cur: Element | null = el;
  let depth = 0;
  while (cur && cur.tagName !== "BODY" && depth < maxDepth) {
    const parent = cur.parentElement;
    if (!parent) break;
    const tag = cur.tagName;
    let n = 1;
    for (let sib = cur.previousElementSibling; sib; sib = sib.previousElementSibling) {
      if (sib.tagName === tag) n++;
    }
    parts.push(`${tag}[${n}]`);
    cur = parent;
    depth++;
  }
  return parts.reverse().join(">");
}

/** Length of the shared prefix of two `>`-separated fingerprint strings. */
function fingerprintOverlap(a: string, b: string): number {
  if (!a || !b) return 0;
  const A = a.split(">");
  const B = b.split(">");
  const n = Math.min(A.length, B.length);
  let i = 0;
  while (i < n && A[i] === B[i]) i++;
  return i;
}

/** Match by pathname + search (ignore origin/hash) — robust across hosts. */
function findAnchorElement(anchor: AnchorInfo): HTMLElement | null {
  let targetPath = anchor.href;
  try {
    const u = new URL(anchor.href, window.location.origin);
    targetPath = u.pathname + u.search;
  } catch {}
  // Prefer links currently visible in viewport flow (skip hidden duplicates).
  const candidates: HTMLElement[] = [];
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"));
  for (const a of links) {
    let aPath = a.getAttribute("href") || "";
    try {
      const u = new URL(a.href, window.location.origin);
      aPath = u.pathname + u.search;
    } catch {}
    if (aPath === targetPath) {
      const rect = a.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) candidates.push(a);
    }
  }
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  // ── Prefer structural match ──────────────────────────────────────
  // If we stored a fingerprint at click time, pick the candidate whose
  // ancestor chain overlaps the most. An exact match short-circuits;
  // otherwise the deepest shared prefix wins (same section, different
  // grid position after re-render). This is far more reliable than
  // distance-based matching for home pages where a product appears in
  // Best Selling AND a category strip that may sit only ~200-800px
  // apart on mobile.
  if (anchor.path) {
    let bestByPath: HTMLElement | null = null;
    let bestOverlap = -1;
    for (const el of candidates) {
      const fp = pathFingerprint(el);
      if (fp === anchor.path) return el;
      const overlap = fingerprintOverlap(fp, anchor.path);
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestByPath = el;
      }
    }
    // Require at least 3 shared ancestors (e.g. same <section> subtree)
    // before trusting the structural pick — otherwise fall through to
    // distance heuristic.
    if (bestByPath && bestOverlap >= 3) return bestByPath;
  }

  if (!Number.isFinite(anchor.documentTop)) return candidates[0];

  // Fallback: closest to stored documentTop, with tight tolerance so
  // sibling section duplicates on mobile (~200-800px apart) are rejected
  // rather than picked incorrectly. Anything further than half a viewport
  // is treated as a mismatch → wait for the correct lazy section to mount.
  const targetTop = anchor.documentTop as number;
  let best: HTMLElement | null = null;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const el of candidates) {
    const top = window.scrollY + el.getBoundingClientRect().top;
    const delta = Math.abs(top - targetTop);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = el;
    }
  }
  const acceptableDelta = Math.max(window.innerHeight * 0.6, 400);
  return bestDelta <= acceptableDelta ? best : null;
}


export function useScrollRestoration(opts?: { skipPathPatterns?: RegExp[] }) {
  const { pathname, search } = useLocation();
  const navType = useNavigationType(); // "PUSH" | "POP" | "REPLACE"
  const lastPathRef = useRef<string | null>(null);
  const skipPatterns = opts?.skipPathPatterns || [];

  // One-time setup
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("scrollRestoration" in window.history) {
      try { window.history.scrollRestoration = "manual"; } catch {}
    }
    // bfcache-friendly persist on tab hide
    const onHide = () => {
      if (document.visibilityState === "hidden") saveScroll();
    };
    document.addEventListener("visibilitychange", onHide);

    // pagehide fires reliably on iOS Safari before bfcache eviction —
    // visibilitychange alone misses some Safari cases. Persist scroll here too.
    const onPageHide = () => saveScroll();
    window.addEventListener("pagehide", onPageHide);

    // bfcache restore: when the browser brings the page back from bfcache
    // (Instagram/WhatsApp in-app browser back, iOS Safari back), the DOM,
    // JS heap, and scroll position are already intact. React-router does NOT
    // fire a navigation event, so our POP handler never runs — which is
    // exactly what we want. But we DO want to notify the app that a fresh
    // paint may be needed (e.g. re-run pixel PageView, refresh stale data).
    // We also re-assert manual scrollRestoration in case Safari reset it.
    const onPageShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      try { window.history.scrollRestoration = "manual"; } catch {}
      try {
        window.dispatchEvent(new CustomEvent("storefront:bfcache-restore"));
      } catch {}
    };
    window.addEventListener("pageshow", onPageShow);

    // ── Anchor capture: stash the clicked link for the CURRENT entry ──
    // Capture phase so we record BEFORE react-router navigates.
    const onClick = (e: MouseEvent) => {
      // Only primary click, no modifier (otherwise opens new tab)
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = e.target as Element | null;
      if (!target) return;
      const link = target.closest("a[href]") as HTMLAnchorElement | null;
      if (!link) return;
      // Skip external / mailto / tel / hash-only / download
      const href = link.getAttribute("href") || "";
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      if (link.target && link.target !== "_self") return;
      if (link.hasAttribute("download")) return;
      try {
        const u = new URL(link.href, window.location.origin);
        if (u.origin !== window.location.origin) return;
      } catch { return; }
      // Flush scroll under CURRENT key first
      saveScroll();
      const rect = link.getBoundingClientRect();
      saveAnchor({
        href: link.href,
        viewportTop: rect.top,
        documentTop: window.scrollY + rect.top,
        path: pathFingerprint(link),
      });
    };
    document.addEventListener("click", onClick, { capture: true });

    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("click", onClick, { capture: true } as any);
    };
  }, []);


  // Track path changes
  useEffect(() => {
    const key = pathname + search;
    if (lastPathRef.current === null) {
      lastPathRef.current = key;
      return;
    }
    lastPathRef.current = key;
  }, [pathname, search]);

  // Continuously persist scrollY for the CURRENT entry (rAF-throttled)
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        saveScroll();
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Apply restore/reset on every route change
  useEffect(() => {
    if (skipPatterns.some((re) => re.test(pathname))) return;

    if (navType === "PUSH") {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
      return;
    }
    if (navType !== "POP") return; // REPLACE → no scroll change

    const anchor = readAnchor();
    const targetY = readScroll();

    const restorePixel = () => {
      if (targetY == null || targetY <= 0) {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
        return;
      }
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const y = Math.min(targetY, Math.max(0, max));
      window.scrollTo({ top: y, left: 0, behavior: "instant" as ScrollBehavior });
    };

    // ── No anchor stored → pixel-Y polling with proper teardown ──
    if (!anchor) {
      let cancelled = false;
      const start = performance.now();
      const tickPixel = () => {
        if (cancelled) return;
        if (targetY == null || targetY <= 0) {
          window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
          return;
        }
        const max = document.documentElement.scrollHeight - window.innerHeight;
        if (max >= targetY || performance.now() - start > RESTORE_TIMEOUT_MS) {
          window.scrollTo({ top: Math.min(targetY, Math.max(0, max)), left: 0, behavior: "instant" as ScrollBehavior });
          return;
        }
        requestAnimationFrame(tickPixel);
      };
      requestAnimationFrame(tickPixel);
      return () => { cancelled = true; };
    }

    // ── Sustained anchor restore ──
    // Re-align until the anchor's resolved scrollY has been stable for
    // ~300ms, capped at RESTORE_TIMEOUT_MS. Realign runs are coalesced
    // per rAF so bursts of DOM mutations / image loads don't hammer
    // querySelectorAll.
    const start = performance.now();
    let done = false;
    let lastY = -1;
    let stableSince = 0;
    let anchored = false;
    let realignScheduled = false;
    const STABLE_MS = 300;

    const tryAnchorRestore = (): boolean => {
      const el = findAnchorElement(anchor);
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const desiredScrollY = window.scrollY + rect.top - anchor.viewportTop;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const y = Math.max(0, Math.min(desiredScrollY, max));
      window.scrollTo({ top: y, left: 0, behavior: "instant" as ScrollBehavior });
      return true;
    };

    const finish = () => {
      if (done) return;
      done = true;
      try { observer.disconnect(); } catch {}
      try { window.removeEventListener("storefront:content-ready", onReady); } catch {}
      try { document.removeEventListener("load", onImgLoad, true); } catch {}
    };

    const realign = () => {
      if (done) return;
      if (!tryAnchorRestore()) return;
      anchored = true;
      const y = Math.round(window.scrollY);
      const now = performance.now();
      if (y === lastY) {
        if (now - stableSince > STABLE_MS) finish();
      } else {
        lastY = y;
        stableSince = now;
      }
    };
    const scheduleRealign = () => {
      if (done || realignScheduled) return;
      realignScheduled = true;
      requestAnimationFrame(() => {
        realignScheduled = false;
        realign();
      });
    };
    const onReady = () => scheduleRealign();
    const onImgLoad = (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (t && t.tagName === "IMG") scheduleRealign();
    };
    window.addEventListener("storefront:content-ready", onReady);
    document.addEventListener("load", onImgLoad, true);
    const observer = new MutationObserver(() => scheduleRealign());
    observer.observe(document.body, { childList: true, subtree: true });

    if (targetY != null && targetY > 0) restorePixel();
    realign(); // immediate attempt

    const tick = () => {
      if (done) return;
      realign();
      if (performance.now() - start > RESTORE_TIMEOUT_MS) {
        if (!anchored) {
          finish();
          restorePixel();
        } else {
          finish();
        }
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    // Critical: tear everything down if the user navigates again mid-restore.
    // Otherwise the observer + tick loop keep calling scrollTo and hijack the
    // next page.
    return () => { finish(); };
  }, [pathname, navType]);
}

