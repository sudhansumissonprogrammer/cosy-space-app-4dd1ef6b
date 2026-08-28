import { supabase } from "@/integrations/supabase/client";
import { storefrontPath } from "@/lib/subdomain";
import { fetchStoreEnabledApps } from "@/hooks/useStoreEnabledApps";

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
  /** Product-tagged slides carry a shoppable card (Shop-by-Video style). */
  product?: {
    name: string;
    imageUrl?: string | null;
    price?: number | null;
    salePrice?: number | null;
    currency?: string | null;
  };
  /** Mini product grid shown on the first slide (store-specific promo). */
  featuredProducts?: Array<{
    name: string;
    imageUrl?: string | null;
    price?: number | null;
    salePrice?: number | null;
    currency?: string | null;
    to: string;
  }>;
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
    const apps = await fetchStoreEnabledApps(slug);
    const enabled = Array.isArray(apps) && apps.some((a: any) => a.app_id === "shop-by-video");
    if (enabled) {
      const { data: products } = await supabase
        .from("products")
        .select("id,slug,name,price,sale_price,currency,image_url,video_url,video_poster_url")
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
          product: {
            name: p.name,
            imageUrl: p.image_url ?? p.video_poster_url ?? null,
            price: p.price ?? null,
            salePrice: p.sale_price ?? null,
            currency: p.currency ?? null,
          },
        });
      }
    }
  } catch {
    /* app registry unavailable — trust videos alone are fine */
  }

  // Utkal Watches only: pin a fixed 4-product mini grid onto the FIRST slide
  // so the opening trust video doubles as a shoppable collection card.
  if (slug === "utkalwatches" && slides.length > 0) {
    try {
      const TARGET_SLUGS = [
        "chronograph-mens-watch-silver-gold-metal-watch-for-man",
        "casio-edifice-chronograph-black-dial-gold-metal-mens-watch-efr-539sg-1avudf",
        "casio-edifice-chronograph-with-black-stainless-steel-strap-mens-watch-black-gold-539bk",
        "sb-premium-iluminator-regular-silver-body-dark-brown-digital-watch-casio-ab19",
      ];
      const { data: products } = await (supabase as any)
        .from("products")
        .select("id,slug,name,price,sale_price,currency,image_url")
        .eq("store_id", storeId)
        .eq("is_active", true)
        .in("slug", TARGET_SLUGS)
        .limit(4);
      const bySlug = new Map(((products as any[]) || []).map((p) => [p.slug, p]));
      const picked = TARGET_SLUGS.map((s) => bySlug.get(s)).filter(Boolean);
      if (picked.length > 0) {
        slides[0].featuredProducts = picked.map((p: any) => ({
          name: p.name,
          imageUrl: p.image_url ?? null,
          price: p.price ?? null,
          salePrice: p.sale_price ?? null,
          currency: p.currency ?? null,
          to: storefrontPath(slug, `product/${p.slug}`),
        }));
        // Bottom button now opens the full collection.
        slides[0].ctaLabel = slides[0].ctaLabel || "See more";
        slides[0].to = storefrontPath(slug, "category/casio-new");
        delete slides[0].href;
      }
    } catch {
      /* featured grid is optional — reel still works without it */
    }
  }

  return slides;
}

/**
 * One-shot probe used by the floating launcher: existence AND the preview row
 * in a single request. Previously the launcher ran a HEAD count followed by a
 * second row fetch — two serial round trips during the image-loading window
 * for zero extra information.
 */
export async function fetchTrustVideoProbe(
  storeId: string,
): Promise<{ available: boolean; preview: { videoUrl: string; posterUrl: string | null } | null }> {
  const { data } = await (supabase as any)
    .from("store_trust_videos")
    .select("video_url,poster_url")
    .eq("store_id", storeId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data?.video_url) return { available: false, preview: null };
  return { available: true, preview: { videoUrl: data.video_url, posterUrl: data.poster_url ?? null } };
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

/**
 * Fetch just the first active trust video for the floating preview thumbnail.
 * Lightweight — one row, three columns. Called only after idle.
 */
export async function fetchFirstTrustVideo(
  storeId: string
): Promise<{ videoUrl: string; posterUrl: string | null } | null> {
  const { data } = await (supabase as any)
    .from("store_trust_videos")
    .select("video_url,poster_url")
    .eq("store_id", storeId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data?.video_url) return null;
  return { videoUrl: data.video_url, posterUrl: data.poster_url ?? null };
}
