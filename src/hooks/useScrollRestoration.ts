import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * Hydrogen/Remix-style scroll restoration for the storefront.
 *
 * Behavior:
 *  - PUSH      → scroll to top
 *  - POP (back/forward) → restore saved Y (waits up to 800ms for content height)
 *  - REPLACE   → leave scroll untouched
 *
 * Saves scrollY to sessionStorage on every pathname change BEFORE leaving,
 * keyed by `history.state.key` (React Router assigns one per entry).
 *
 * Allow-list: routes in `skipPathPatterns` are skipped entirely (e.g. PDP
 * variant tab switches that just rewrite the URL).
 */
const STORAGE_PREFIX = "sf_scroll:";

function getKey(): string {
  try {
    const k = (window.history.state && (window.history.state as any).key) || "default";
    return STORAGE_PREFIX + k;
  } catch {
    return STORAGE_PREFIX + "default";
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

export function useScrollRestoration(opts?: { skipPathPatterns?: RegExp[] }) {
  const { pathname, search } = useLocation();
  const navType = useNavigationType(); // "PUSH" | "POP" | "REPLACE"
  const lastPathRef = useRef<string | null>(null);
  const skipPatterns = opts?.skipPathPatterns || [];

  // One-time setup: take over scroll restoration from the browser so it
  // doesn't race our manual restore.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("scrollRestoration" in window.history) {
      try { window.history.scrollRestoration = "manual"; } catch {}
    }
    // Persist final scroll position on tab hide/unload too.
    const onHide = () => saveScroll();
    window.addEventListener("pagehide", onHide);
    window.addEventListener("beforeunload", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("beforeunload", onHide);
    };
  }, []);

  // Save scroll position of the OUTGOING page right before we navigate away.
  useEffect(() => {
    const key = pathname + search;
    if (lastPathRef.current === null) {
      lastPathRef.current = key;
      return;
    }
    // Note: at this point history.state.key is already the NEW entry's key,
    // but we want to associate the saved Y with the entry we just LEFT.
    // We saved continuously via the scroll listener below, so this is just
    // a final flush after the URL changed (no-op in most cases).
    lastPathRef.current = key;
  }, [pathname, search]);

  // Continuously persist scrollY for the CURRENT entry (debounced via rAF).
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

  // Apply restore/reset on every route change.
  useEffect(() => {
    if (skipPatterns.some((re) => re.test(pathname))) return;

    if (navType === "POP") {
      const target = readScroll();
      if (target == null || target <= 0) {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
        return;
      }
      // Wait for content height to catch up (lazy-loaded sections, images).
      const start = performance.now();
      const tryRestore = () => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        if (max >= target || performance.now() - start > 800) {
          window.scrollTo({ top: target, left: 0, behavior: "instant" as ScrollBehavior });
          return;
        }
        requestAnimationFrame(tryRestore);
      };
      requestAnimationFrame(tryRestore);
    } else if (navType === "PUSH") {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    }
    // REPLACE → no scroll change (variant switch, query param updates, etc.)
  }, [pathname, navType]);
}
