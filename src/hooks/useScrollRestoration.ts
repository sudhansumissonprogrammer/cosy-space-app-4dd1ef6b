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

/** Match by pathname + search (ignore origin/hash) — robust across hosts. */
function findAnchorElement(href: string): HTMLElement | null {
  let targetPath = href;
  try {
    const u = new URL(href, window.location.origin);
    targetPath = u.pathname + u.search;
  } catch {}
  // Prefer links currently visible in viewport flow (skip hidden duplicates).
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"));
  for (const a of links) {
    let aPath = a.getAttribute("href") || "";
    try {
      const u = new URL(a.href, window.location.origin);
      aPath = u.pathname + u.search;
    } catch {}
    if (aPath === targetPath) {
      const rect = a.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) return a;
    }
  }
  return null;
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
      saveAnchor({ href: link.href, viewportTop: rect.top });
    };
    document.addEventListener("click", onClick, { capture: true });

    return () => {
      document.removeEventListener("visibilitychange", onHide);
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

    if (navType === "POP") {
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

      const tryAnchorRestore = (): boolean => {
        if (!anchor) return false;
        const el = findAnchorElement(anchor.href);
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        // Position the element at the same viewport offset it had when tapped
        const desiredScrollY = window.scrollY + rect.top - anchor.viewportTop;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const y = Math.max(0, Math.min(desiredScrollY, max));
        window.scrollTo({ top: y, left: 0, behavior: "instant" as ScrollBehavior });
        return true;
      };

      // Try immediately
      if (tryAnchorRestore()) return;

      // Otherwise poll up to RESTORE_TIMEOUT_MS, also reacting to DOM mutations
      // (Meesho/Flipkart feel — wait until the tapped card actually mounts).
      const start = performance.now();
      let done = false;
      const observer = new MutationObserver(() => {
        if (done) return;
        if (tryAnchorRestore()) {
          done = true;
          observer.disconnect();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });

      const tick = () => {
        if (done) return;
        if (tryAnchorRestore()) {
          done = true;
          observer.disconnect();
          return;
        }
        if (performance.now() - start > RESTORE_TIMEOUT_MS) {
          done = true;
          observer.disconnect();
          // Final fallback: pixel Y (waiting for height too)
          const max = document.documentElement.scrollHeight - window.innerHeight;
          if (targetY != null && targetY > 0 && max < targetY && performance.now() - start < RESTORE_TIMEOUT_MS + 500) {
            requestAnimationFrame(tick);
            return;
          }
          restorePixel();
          return;
        }
        requestAnimationFrame(tick);
      };

      // If no anchor stored, run pixel-Y path with extended polling
      if (!anchor) {
        const tickPixel = () => {
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
        observer.disconnect();
        requestAnimationFrame(tickPixel);
        return;
      }

      requestAnimationFrame(tick);
    } else if (navType === "PUSH") {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    }
    // REPLACE → no scroll change
  }, [pathname, navType]);
}
