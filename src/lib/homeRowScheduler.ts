/**
 * Scheduler for storefront home category-row data fetches.
 *
 * Problem observed in production (mobile, serdiyajewellers.shop): five
 * `/api/category?slug=...&limit=50` requests fired inside the LCP window
 * because every CategorySection uses a 400px IntersectionObserver margin and
 * an empty 220px placeholder — so all rows "intersect" at once on a 844px
 * viewport. Those five payloads competed with the hero/product images for
 * bandwidth and pushed LCP past 3s.
 *
 * This module keeps the same behaviour but:
 *   1. Holds row fetches until the page has finished its initial load
 *      (window 'load', capped at 1200ms) so images win the race.
 *   2. Caps concurrency at 2 so rows arrive progressively instead of in a
 *      single burst.
 *
 * Nothing about the payload, cache key, or fallback path changes.
 */

import { fetchCategoryEdge } from "@/lib/storefrontEdgeApi";

const MAX_CONCURRENT = 2;
const READY_CAP_MS = 1200;

let readyPromise: Promise<void> | null = null;

function whenReady(): Promise<void> {
  if (readyPromise) return readyPromise;
  readyPromise = new Promise<void>((resolve) => {
    if (typeof window === "undefined" || document.readyState === "complete") {
      resolve();
      return;
    }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    window.addEventListener("load", finish, { once: true });
    setTimeout(finish, READY_CAP_MS);
  });
  return readyPromise;
}

let active = 0;
const waiters: Array<() => void> = [];

function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT) {
    active++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => waiters.push(resolve));
}

function release() {
  const next = waiters.shift();
  if (next) next();
  else active = Math.max(0, active - 1);
}

/** Edge category fetch, deferred past first load and concurrency-limited. */
export async function fetchCategoryRowQueued(slug: string, limit?: number): Promise<any | null> {
  await whenReady();
  await acquire();
  try {
    return await fetchCategoryEdge(slug, limit as any);
  } finally {
    release();
  }
}
