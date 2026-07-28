import { supabase } from "@/integrations/supabase/client";
import { storefrontPath } from "@/lib/subdomain";

export interface TrustSlide {
  id: string;
  videoUrl: string;
  posterUrl?: string | null;
  title?: string | null;
  /** when empty/absent, no CTA button is rendered */
  ctaLabel?: string | null;
  /** in-app path (react-router) */
  to?: string;
  /** external absolute URL */
  href?: string;
}

interface TrustVideoRow {
  id: string;
  video_url: string;
  poster_url: string | null;
  title: string | null;
  cta_label: string | null;
  cta_target: string | null;
  sort_order: number;
}

/** Resolve an owner-entered CTA target into a router path or external link. */
function resolveTarget(slug: string, target?: string | null): { to?: string; href?: string } {
  const t = (target || "").trim();
  if (!t || t === "none") return {};
  if (/^https?:\/\//i.test(t)) return { href: t };
  const clean = t.replace(/^\/+/, "");
  return { to: storefrontPath(slug, clean) };
}

/**
 * Owner-uploaded trust videos, then (when the Shop by Video app is enabled)
 * every product video — so the reel continues straight into shoppable content.
 * Called ONLY after the shopper taps the floating button.
 */
export async function fetchTrustReel(storeId: string, slug: string): Promise<TrustSlide[]> {
  const slides: TrustSlide[] = [];

  const { data: rows } = await (supabase as any)
    .from("store_trust_videos")
    .select("id,video_url,poster_url,title,cta_label,cta_target,sort_order")
    .eq("store_id", storeId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .limit(30);

  for (const r of ((rows as TrustVideoRow[]) || [])) {
    if (!r.video_url) continue;
    slides.push({
      id: r.id,
      videoUrl: r.video_url,
      posterUrl: r.poster_url,
      title: r.title,
      ctaLabel: (r.cta_label || "").trim() || null,
      ...resolveTarget(slug, r.cta_target),
    });
  }

  // Chain into Shop by Video product reels when that add-on is enabled.
  try {
    const { data: apps } = await (supabase as any).rpc("get_store_enabled_apps", { _store_slug: slug });
    const enabled = Array.isArray(apps) && apps.some((a: any) => a.app_id === "shop-by-video");
    if (enabled) {
      const { data: products } = await supabase
        .from("products")
        .select("id,slug,name,video_url,video_poster_url")
        .eq("store_id", storeId)
        .eq("is_active", true)
        .not("video_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(15);
      for (const p of ((products as any[]) || [])) {
        if (!p.video_url) continue;
        slides.push({
          id: `p-${p.id}`,
          videoUrl: p.video_url,
          posterUrl: p.video_poster_url,
          title: p.name,
          ctaLabel: "See more details",
          to: storefrontPath(slug, `product/${p.slug}`),
        });
      }
    }
  } catch {
    /* app registry unavailable — trust videos alone are fine */
  }

  return slides;
}

/** Cheap existence probe used by the floating launcher (idle-time only). */
export async function hasTrustVideos(storeId: string): Promise<boolean> {
  const { count } = await (supabase as any)
    .from("store_trust_videos")
    .select("id", { count: "exact", head: true })
    .eq("store_id", storeId)
    .eq("is_active", true);
  return (count ?? 0) > 0;
}
