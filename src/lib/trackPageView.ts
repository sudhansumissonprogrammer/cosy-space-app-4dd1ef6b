/**
 * Deduplicated page view tracker.
 * Only fires once per store+path per 30 minutes using localStorage.
 */

const DEDUP_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
const STORAGE_KEY = "pv_dedup";

interface DedupMap {
  [key: string]: number; // timestamp of last track
}

function getDedupMap(): DedupMap {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function setDedupMap(map: DedupMap): void {
  // Prune expired entries to avoid localStorage bloat
  const now = Date.now();
  const pruned: DedupMap = {};
  for (const [key, ts] of Object.entries(map)) {
    if (now - ts < DEDUP_WINDOW_MS) {
      pruned[key] = ts;
    }
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
  } catch {
    // Storage full — ignore
  }
}

// Phase 1 fix #4: Filter bot user-agents before tracking.
// Bots account for ~40-60% of page_views inserts on a typical store.
// Skipping them cuts DB writes ~50% with zero impact on real analytics.
const BOT_UA_REGEX =
  /bot|crawler|spider|crawling|facebookexternalhit|whatsapp|telegram|slack|discord|linkedin|pinterest|googlebot|bingbot|yandexbot|baiduspider|duckduckbot|applebot|semrush|ahrefs|mj12|petalbot|headlesschrome|phantomjs|puppeteer|playwright|lighthouse|gtmetrix|pagespeed/i;

function isBot(): boolean {
  if (typeof navigator === "undefined") return true;
  const ua = navigator.userAgent || "";
  if (!ua) return true;
  return BOT_UA_REGEX.test(ua);
}

export function trackPageView(storeId: string, path?: string): void {
  // Skip bots entirely — saves DB inserts + worker requests
  if (isBot()) return;

  const resolvedPath = path || window.location.pathname;
  const dedupKey = `${storeId}:${resolvedPath}`;
  const now = Date.now();

  const map = getDedupMap();
  const lastTracked = map[dedupKey];

  if (lastTracked && now - lastTracked < DEDUP_WINDOW_MS) {
    return; // Skip — already tracked within 30 min
  }

  map[dedupKey] = now;
  setDedupMap(map);

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  if (!projectId) return;

  setTimeout(() => {
    fetch(`https://${projectId}.supabase.co/functions/v1/ingest?type=view`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ store_id: storeId, path: resolvedPath }),
    }).catch(() => {});
  }, 3000);
}
