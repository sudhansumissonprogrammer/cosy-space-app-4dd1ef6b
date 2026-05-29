import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSubdomainSlug } from "@/lib/subdomain";
import type { Tables } from "@/integrations/supabase/types";

export type StoreData = Tables<"stores">;

// v8.17.0 cold-load fix: bridge timeout 1500→800ms. If the index.html prefetch
// stalls (slow mobile/4G), waiting 1.5s before falling back wastes the entire
// shell-only Promise advantage. 800ms is still enough for Supabase RPC on a
// healthy connection but lets us bail to the direct RPC faster on bad ones.
const PREFETCH_BRIDGE_TIMEOUT_MS = 800;

/** Lazy supabase import — keeps the 45KB chunk off the storefront critical path
 *  when the prefetch bridge (index.html) already fetched the data */
async function rpcGetStorefrontShell(slug: string) {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data, error } = await supabase.rpc("get_storefront_shell" as any, {
    _slug: slug,
  });
  if (error) throw error;
  return data as any;
}

/**
 * Core storefront data-fetching hook.
 *
 * Resolution order for slug:
 *   1. slugOverride (subdomain / custom-domain, passed from App.tsx)
 *   2. URL param :slug (path-based /store/:slug)
 *   3. getSubdomainSlug() (fallback)
 *
 * Data source priority:
 *   1. window.__STOREFRONT_DATA__ (injected by Cloudflare Worker or index.html prefetch)
 *   2. React Query cache hit
 *   3. Fresh RPC call to get_storefront_data
 *
 * Seeds individual query keys (storefront-products, storefront-categories, etc.)
 * so child pages can read from cache without extra fetches.
 */
export function useStorefront(slugOverride?: string) {
  const { slug: paramSlug } = useParams<{ slug: string }>();
  const slug = slugOverride || paramSlug || getSubdomainSlug() || undefined;
  const queryClient = useQueryClient();
  const seeded = useRef(false);
  const initialInjectedRef = useRef(false);

  // Try to grab pre-fetched data (from Worker or index.html script)
  const rawInjected = (window as any).__STOREFRONT_DATA__;
  const injected = rawInjected?.store?.slug === slug ? rawInjected : undefined;
  const useInjectedInitialData = !!(injected?.store && slug && !seeded.current);
  if (useInjectedInitialData && !initialInjectedRef.current) initialInjectedRef.current = true;

  const { data, isLoading } = useQuery({
    queryKey: ["storefront-bulk", slug],
    queryFn: async () => {
      // 1. Check synchronous injected data first (Worker already set it)
      const rawSyncData = (window as any).__STOREFRONT_DATA__;
      const syncData = rawSyncData?.store?.slug === slug ? rawSyncData : undefined;
      if (syncData?.store && !initialInjectedRef.current) {
        delete (window as any).__STOREFRONT_DATA__;
        delete (window as any).__STOREFRONT_PREFETCH__;
        return syncData as any;
      }
      if (syncData?.store && initialInjectedRef.current) {
        delete (window as any).__STOREFRONT_DATA__;
      }

      // 2. Await the index.html prefetch promise if still in flight,
      // but never block forever (prevents infinite shimmer state).
      const prefetch = (window as any).__STOREFRONT_PREFETCH__;
      if (prefetch) {
        try {
          const result = await Promise.race([
            Promise.resolve(prefetch),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("storefront_prefetch_timeout")), PREFETCH_BRIDGE_TIMEOUT_MS)
            ),
          ]);

          if ((result as any)?.store) {
            delete (window as any).__STOREFRONT_PREFETCH__;
            return result as any;
          }
        } catch {
          delete (window as any).__STOREFRONT_PREFETCH__;
        }
      }

      // 3. Fresh RPC call — use shell (lightweight, no products)
      return rpcGetStorefrontShell(slug!);
    },
    enabled: !!slug,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    // Seed initialData with a stale timestamp so React Query schedules an
    // immediate background refetch. This guarantees that if the merchant
    // changed the theme/colors, a refresh on the storefront picks up the
    // new values within ~1 RTT (instead of waiting 2 minutes for staleTime).
    ...(useInjectedInitialData
      ? { initialData: injected, initialDataUpdatedAt: 0 }
      : {}),
  });

  // Seed individual cache keys so child pages get instant cache hits.
  // Only re-seed when the underlying storefront data changes — route changes
  // must not overwrite unsaved theme preview selections inside the iframe.
  useEffect(() => {
    if (!data) return;

    const { store, categories, theme_config } = data as any;

    if (store) {
      // Cost-cut: tell fireMetaCAPI to skip the edge function entirely until
      // the merchant configures a Meta access token. Avoids per-visitor probe.
      try {
        (window as any).__SF_META_CAPI_ENABLED__ = !!(data as any)?.meta_capi_enabled;
      } catch {}

      // Cache the theme in localStorage for instant theme detection on next visit
      try {
        localStorage.setItem(`storefront_theme_${store.slug}`, store.theme);
      } catch {}

      // Bootstrap cache: store_id + fonts (read synchronously by index.html on
      // next visit to fire products fetch in PARALLEL with shell + inject font
      // preload at HTML parse time).
      try {
        const t = (data as any)?.theme || (data as any)?.theme_config || {};
        const prev = JSON.parse(localStorage.getItem(`sf_boot_${store.slug}`) || "{}");
        localStorage.setItem(
          `sf_boot_${store.slug}`,
          JSON.stringify({
            sid: store.id,
            hf: t.heading_font || prev.hf || null,
            bf: t.body_font || prev.bf || null,
            imgs: prev.imgs || [],
          })
        );
      } catch {}

      // Custom pages are now bundled in the get_storefront_shell RPC payload
      // and seeded into the cache below — no extra prefetch needed.
      // (Saves ~600 Supabase requests/day.)
      const customPages = (data as any)?.custom_pages;
      if (Array.isArray(customPages)) {
        queryClient.setQueryData(["storefront-custom-pages", store.id], customPages);
      }
    }

    // Seed categories into cache so child pages get instant hits
    if (categories && store) {
      queryClient.setQueryData(["storefront-categories", store.id], categories);
    }
    if (theme_config && store) {
      queryClient.setQueryData(["storefront-theme-config", store.id], theme_config);
    }
    // Seed shipping config so TrustStrip / SideCart / CartPage get instant cache hit
    const shipping_config = (data as any)?.shipping_config;
    if (shipping_config && store) {
      queryClient.setQueryData(["storefront-shipping-config", store.id], shipping_config);
    }
    // Seed total product count so home page knows pagination state
    if (store && (data as any)?.total_products != null) {
      queryClient.setQueryData(["storefront-total-products", store.id], (data as any).total_products);
    }

    // Clear injected data after first seed so future fetches use fresh cache/query data
    if (!seeded.current) {
      seeded.current = true;
      if ((window as any).__STOREFRONT_DATA__) {
        delete (window as any).__STOREFRONT_DATA__;
      }
    }
  }, [data, queryClient]);

  const store = (data as any)?.store as StoreData | undefined;

  return { store: store ?? null, isLoading, slug };
}