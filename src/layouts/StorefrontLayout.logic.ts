import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getSubdomainSlug } from "@/lib/subdomain";
import type { Tables } from "@/integrations/supabase/types";

export type StoreData = Tables<"stores">;

const PREFETCH_BRIDGE_TIMEOUT_MS = 1500;

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
      // 1. Use injected data (Cloudflare Worker or resolved index.html prefetch)
      const wd = (window as any).__STOREFRONT_DATA__;
      if (wd?.store) return wd;

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
            (window as any).__STOREFRONT_DATA__ = result;
            delete (window as any).__STOREFRONT_PREFETCH__;
            return result as any;
          }
        } catch {
          delete (window as any).__STOREFRONT_PREFETCH__;
          // prefetch failed/timed out, fall through to fresh call
        }
      }

      // 3. Fresh RPC call (fallback)
      const { data: result, error } = await supabase.rpc("get_storefront_data" as any, {
        _slug: slug!,
        _product_limit: 20,
      });

      if (error) throw error;
      return result as any;
    },
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    // If we have injected data, use it as initialData for instant render
    ...(injected?.store && slug && !seeded.current
      ? { initialData: injected }
      : {}),
  });

  // Seed individual cache keys so child pages get instant cache hits
  useEffect(() => {
    if (!data || seeded.current) return;
    seeded.current = true;

    const { store, products, categories, theme_config } = data as any;

    if (store) {
      // Cache the theme in localStorage for instant theme detection on next visit
      try {
        localStorage.setItem(`storefront_theme_${store.slug}`, store.theme);
      } catch {}
    }

    if (products && store) {
      queryClient.setQueryData(["storefront-products", store.id], products);
    }
    if (categories && store) {
      queryClient.setQueryData(["storefront-categories", store.id], categories);
    }
    if (theme_config && store) {
      queryClient.setQueryData(["storefront-theme-config", store.id], theme_config);
    }

    // Clear injected data after seeding — prevents stale data on SPA navigation
    if ((window as any).__STOREFRONT_DATA__) {
      delete (window as any).__STOREFRONT_DATA__;
    }
  }, [data, queryClient]);

  const store = (data as any)?.store as StoreData | undefined;

  return { store: store ?? null, isLoading, slug };
}
