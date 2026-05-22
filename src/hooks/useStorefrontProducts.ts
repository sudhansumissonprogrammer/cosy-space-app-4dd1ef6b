import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
// supabase is dynamic-imported inside the preview/localhost fallback only
// to keep the 171KB supabase chunk OUT of the storefront-shell static graph.

const PAGE_SIZE = 20;

/** Lightweight column list — avoids fetching heavy fields (product_images, product_variants) */
const PRODUCT_COLUMNS =
  "id,category,currency,description,image_url,is_active,is_best_selling,name,price,sale_price,slug,stock_quantity,store_id";

/** Full columns including cost/sku/timestamps — used for dashboard and follow-up fetches */
const PRODUCT_COLUMNS_FULL =
  "id,category,cost_price,created_at,currency,description,image_url,is_active,is_best_selling,name,price,sale_price,sku,slug,stock_quantity,store_id,updated_at";

/**
 * Fetch products via Worker /api/products (domain resolved from Host header).
 * Falls back to direct Supabase ONLY in preview/localhost environments
 * where the Worker is not available — using the SAME interface shape.
 */
async function fetchProducts(storeId: string): Promise<any[]> {
  // 1. Check Worker-inlined products (embedded in HTML — instant, no fetch)
  const inlineProducts = (window as any).__PRODUCTS_INLINE__;
  if (inlineProducts) {
    (window as any).__PRODUCTS_INLINE__ = null;
    try {
      const parsed = typeof inlineProducts === "string" ? JSON.parse(inlineProducts) : inlineProducts;
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch { /* fall through */ }
  }

  // 2. Check if index.html prefetch already has products in flight
  const prefetchPromise = (window as any).__PRODUCTS_PREFETCH__;
  if (prefetchPromise) {
    (window as any).__PRODUCTS_PREFETCH__ = null;
    try {
      const result = await prefetchPromise;
      if (Array.isArray(result) && result.length > 0) return result;
    } catch { /* fall through */ }
  }

  const hostname = window.location.hostname;
  const isLocal = hostname === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(hostname);
  const isPreview = hostname.endsWith(".lovable.app") || hostname.endsWith(".lovableproject.com");

  if (!isLocal && !isPreview) {
    // ── sessionStorage cache: avoid re-hitting Worker on intra-session navigation ──
    // Cache for 15min per session — survives Home → Shop → Home round trips
    // without triggering a fresh /api/products Worker invocation.
    const SS_KEY = `__sf_products_${hostname}`;
    const SS_TTL = 15 * 60 * 1000;
    try {
      const cached = sessionStorage.getItem(SS_KEY);
      if (cached) {
        const { ts, data } = JSON.parse(cached);
        if (Date.now() - ts < SS_TTL && Array.isArray(data) && data.length > 0) {
          return data;
        }
      }
    } catch { /* ignore */ }

    const res = await fetch(`${window.location.origin}/api/products`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`Worker API error: ${res.status}`);
    const json = await res.json();
    try { sessionStorage.setItem(SS_KEY, JSON.stringify({ ts: Date.now(), data: json })); } catch { /* quota */ }
    return json;
  }

  // ── Preview/localhost fallback: direct Supabase (lazy import) ──
  const { supabase } = await import("@/integrations/supabase/client");
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("store_id", storeId)
    .eq("is_active", true)
    .order("is_best_selling", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .limit(PAGE_SIZE);

  if (error) throw error;
  return data || [];
}

/**
 * Shared hook for fetching the first page of storefront products.
 * Used by ALL home page variants (V1–V13).
 *
 * Production: Worker /api/products (Cache → KV → DB, no direct DB).
 * Preview: Supabase fallback.
 *
 * Returns { products, isLoading } — products is always an array (never undefined).
 */
export function useStorefrontProducts(storeId: string | undefined) {
  const { data, isLoading } = useQuery({
    queryKey: ["storefront-products", storeId],
    queryFn: () => fetchProducts(storeId!),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    enabled: !!storeId,
  });

  // Note: storefront:content-ready is now fired from StorefrontShell as soon
  // as shell data loads (not waiting for products). The Worker's skeleton
  // cleanup still polls for a real painted <img>, so users never see a flash.
  // We keep a backup dispatch here for pages that mount StorefrontShell but
  // don't render shell-level imagery — fires only if Shell didn't already.
  const signalled = useRef(false);
  useEffect(() => {
    if (!signalled.current && data !== undefined && !isLoading) {
      signalled.current = true;
      if (typeof window !== "undefined" && !(window as any).__SF_READY_FIRED__) {
        (window as any).__SF_READY_FIRED__ = true;
        requestAnimationFrame(() => {
          window.dispatchEvent(new Event("storefront:content-ready"));
        });
      }

      // Bootstrap cache: persist top 2 product image URLs by slug so the next
      // visit can inject <link rel=preload as=image fetchpriority=high> at
      // HTML parse time — kicks off LCP image download ~300ms earlier than
      // waiting for the products RTT.
      try {
        const arr = Array.isArray(data) ? data : [];
        const imgs = arr
          .map((p: any) => p?.image_url)
          .filter((u: any) => typeof u === "string" && u.length > 0)
          .slice(0, 2);
        if (imgs.length && arr[0]?.store_id) {
          // We don't have slug here, but we can find it via React Query cache key.
          // Simpler: walk localStorage for any sf_boot_ key whose sid matches.
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith("sf_boot_")) continue;
            try {
              const v = JSON.parse(localStorage.getItem(key) || "{}");
              if (v.sid === arr[0].store_id) {
                v.imgs = imgs;
                localStorage.setItem(key, JSON.stringify(v));
                break;
              }
            } catch {}
          }
        }
      } catch {}
    }
  }, [data, isLoading]);

  /** True when the Worker #sf-skel is still covering the page — lets home pages skip their own skeleton */
  const edgeSkelVisible = typeof document !== "undefined" && !!document.getElementById("sf-skel");

  return { products: data || [], isLoading, edgeSkelVisible };
}

export { PRODUCT_COLUMNS, PRODUCT_COLUMNS_FULL, PAGE_SIZE };
