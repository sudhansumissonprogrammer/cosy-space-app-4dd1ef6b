/**
 * Shared helper for fetching data via the Cloudflare Worker edge cache
 * (Cache API → KV → Supabase). In preview/localhost the Worker is not
 * available, so callers pass a `fallback` async function that talks to
 * Supabase directly.
 *
 * Adds an optional 15min sessionStorage cache so intra-session navigation
 * doesn't re-hit the Worker.
 */
export function isWorkerEnvironment(): boolean {
  if (typeof window === "undefined") return false;
  const hostname = window.location.hostname;
  const isLocal = hostname === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(hostname);
  const isPreview =
    hostname.endsWith(".lovable.app") || hostname.endsWith(".lovableproject.com");
  return !isLocal && !isPreview;
}

export interface WorkerFetchOpts<T> {
  path: string;
  sessionKey?: string;
  sessionTtlMs?: number;
  fallback: () => Promise<T>;
  transform?: (json: any) => T;
  /**
   * When true, an empty array from the Worker is treated as a cache/schema
   * miss and the Supabase fallback is invoked instead. Use for endpoints
   * where empty is almost always a Worker bug (e.g. /api/products for a
   * store that obviously has products). Defaults to false.
   */
  emptyArrayAsFailure?: boolean;
}

export async function fetchViaWorker<T>({
  path,
  sessionKey,
  sessionTtlMs = 15 * 60 * 1000,
  fallback,
  transform,
  emptyArrayAsFailure = false,
}: WorkerFetchOpts<T>): Promise<T> {
  if (!isWorkerEnvironment()) return fallback();

  const useSessionCache = !!sessionKey && sessionTtlMs > 0;

  if (useSessionCache) {
    try {
      const cached = sessionStorage.getItem(sessionKey);
      if (cached) {
        const { ts, data } = JSON.parse(cached);
        if (Date.now() - ts < sessionTtlMs) return data as T;
      }
    } catch {
      /* ignore */
    }
  }

  try {
    // Respect Worker Cache-Control. Session cache + staleTime gate freshness.
    const res = await fetch(`${window.location.origin}${path}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`Worker API error: ${res.status}`);
    const json = await res.json();
    const value = transform ? transform(json) : (json as T);
    if (emptyArrayAsFailure && Array.isArray(value) && value.length === 0) {
      // Treat empty as cache/schema miss — defer to Supabase fallback.
      return fallback();
    }
    if (useSessionCache) {
      try {
        sessionStorage.setItem(sessionKey, JSON.stringify({ ts: Date.now(), data: value }));
      } catch {
        /* quota */
      }
    }
    return value;
  } catch {
    return fallback();
  }
}
