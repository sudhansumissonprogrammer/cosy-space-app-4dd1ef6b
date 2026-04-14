import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSubdomainSlug } from "@/lib/subdomain";
import type { Tables } from "@/integrations/supabase/types";

export type StoreData = Tables<"stores">;

const PREFETCH_BRIDGE_TIMEOUT_MS = 1500;

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

  // Try to grab pre-fetched data (from Worker or index.html script)
  const injected = (window as any).__STOREFRONT_DATA__;

  const { data, isLoading } = useQuery({
    queryKey: ["storefront-bulk", slug],
    queryFn: async () => {
      // 1. Await the index.html prefetch promise if still in flight,
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
            (window as any).__STOREFRONT_DATA__ = result;
            delete (window as any).__STOREFRONT_PREFETCH__;
            return result as any;
          }
        } catch {
          delete (window as any).__STOREFRONT_PREFETCH__;
          // prefetch failed/timed out, fall through to fresh call
        }
      }

      // 2. Fresh RPC call — use shell (lightweight, no products)
      // This dynamically imports supabase only when needed
      return rpcGetStorefrontShell(slug!);
    },
    enabled: !!slug,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    // If we have injected data, use it as initialData for instant render.
    // Use Date.now() so React Query treats it as fresh (within staleTime)
    // and avoids an immediate redundant background refetch.
    // The Worker/KV data is already recent — no need to re-validate instantly.
    ...(injected?.store && slug && !seeded.current
      ? { initialData: injected, initialDataUpdatedAt: Date.now() }
      : {}),
  });

  // Seed individual cache keys so child pages get instant cache hits.
  // Only re-seed when the underlying storefront data changes — route changes
  // must not overwrite unsaved theme preview selections inside the iframe.
  useEffect(() => {
    if (!data) return;

    const { store, categories, theme_config } = data as any;

    if (store) {
      // Cache the theme in localStorage for instant theme detection on next visit
      try {
        localStorage.setItem(`storefront_theme_${store.slug}`, store.theme);
      } catch {}

      // Prefetch custom pages for sidebar menu
      queryClient.prefetchQuery({
        queryKey: ["storefront-custom-pages", store.id],
        queryFn: async () => {
          const { supabase } = await import("@/integrations/supabase/client");
          const { data: pages } = await supabase
            .from("store_pages")
            .select("id, title, slug, content, image_url")
            .eq("store_id", store.id)
            .eq("page_type", "custom")
            .eq("is_active", true)
            .order("display_order", { ascending: true });
          return pages ?? [];
        },
        staleTime: 5 * 60 * 1000,
      });
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