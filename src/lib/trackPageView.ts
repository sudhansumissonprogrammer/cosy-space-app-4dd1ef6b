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

export function trackPageView(storeId: string, path?: string): void {
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
