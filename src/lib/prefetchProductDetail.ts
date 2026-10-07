/**
 * Prefetch the ProductDetail chunk + data + hero image on hover/touch so
 * the whole PDP is warm by the time the user actually taps through.
 *
 * Three side-effects, all fire-and-forget, all idempotent per slug:
 *   1. JS chunk: import("@/pages/ProductDetail") — saves ~150-400ms cold.
 *   2. Data: fetchPdpEdge(slug) — stashed in pdpPrefetchCache; the PDP
 *      useQuery reads it on mount to skip the initial RPC round-trip.
 *   3. Image: warms optimizeImageUrl(image, 800) — same URL the gallery
 *      requests, so skeleton → gallery swap becomes a cache-hit and the
 *      "flash then reload" disappears.
 */

import { fetchPdpEdge } from "@/lib/storefrontEdgeApi";
import { optimizeImageUrl } from "@/lib/imageOptimize";

let chunkLoaded = false;

/** Prefetched PDP payloads keyed by slug; consumed by ProductDetail.tsx */
export const pdpPrefetchCache = new Map<string, Promise<any | null>>();

/** Slugs whose hero image has already been warmed. */
const warmedImages = new Set<string>();

export function prefetchProductDetail(opts?: { slug?: string; image?: string | null }) {
  // 1) Chunk — load once per session.
  if (!chunkLoaded) {
    chunkLoaded = true;
    import("@/pages/ProductDetail").catch(() => {
      chunkLoaded = false; // retry on next hover if failed
    });
  }

  const slug = opts?.slug?.trim();

  // 2) Data — one in-flight promise per slug; PDP awaits it on mount.
  if (slug && !pdpPrefetchCache.has(slug)) {
    pdpPrefetchCache.set(
      slug,
      fetchPdpEdge(slug).catch(() => null),
    );
    // Evict after 30s so stale prefetches don't survive back-nav loops.
    setTimeout(() => pdpPrefetchCache.delete(slug), 30_000);
  }

  // 3) Image — request the exact same URL the PDP gallery will request.
  const image = opts?.image;
  if (slug && image && !warmedImages.has(slug)) {
    warmedImages.add(slug);
    try {
       const url = optimizeImageUrl(image, 1200);
      if (url) {
        const img = new Image();
        // decoding=async lets the browser decode off the main thread.
        img.decoding = "async";
        (img as any).fetchPriority = "high";
        img.src = url;
      }
    } catch { /* noop */ }
  }
}
