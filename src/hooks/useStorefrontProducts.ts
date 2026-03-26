import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isCustomDomainHost, isSubdomainHost, getSubdomainSlug } from "@/lib/subdomain";

const PAGE_SIZE = 20;

/** Lightweight column list — avoids fetching heavy fields (product_images, product_variants) */
const PRODUCT_COLUMNS =
  "id,category,cost_price,created_at,currency,description,image_url,is_active,is_best_selling,name,price,sale_price,sku,slug,stock_quantity,store_id,updated_at";

/**
 * Determine the Worker API base URL for product fetches.
 *
 * On production (custom domain or subdomain): current origin serves the Worker.
 * On preview/localhost: falls back to direct Supabase (Worker not available).
 */
function getWorkerApiBase(): string | null {
  const hostname = window.location.hostname;
  if (isCustomDomainHost(hostname) || isSubdomainHost(hostname)) {
    return window.location.origin;
  }
  return null;
}

/**
 * Fetch products via Worker /api/products (Cache → KV → DB).
 * Falls back to direct Supabase only in preview/localhost environments.
 */
async function fetchProducts(storeId: string): Promise<any[]> {
  const workerBase = getWorkerApiBase();

  if (workerBase) {
    // ── Production: call Worker API (no direct DB calls) ──
    const domain = window.location.hostname.toLowerCase();
    const url = `${workerBase}/api/products?store_id=${encodeURIComponent(storeId)}&domain=${encodeURIComponent(domain)}`;

    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!res.ok) throw new Error(`Worker API error: ${res.status}`);
    return await res.json();
  }

  // ── Preview/localhost fallback: direct Supabase (Worker not available) ──
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
 * Production: fetches via Worker /api/products (Cache → KV → DB).
 * Preview: falls back to direct Supabase.
 *
 * Returns { products, isLoading } — products is always an array (never undefined).
 */
export function useStorefrontProducts(storeId: string | undefined) {
  const { data, isLoading } = useQuery({
    queryKey: ["storefront-products", storeId],
    queryFn: () => fetchProducts(storeId!),
    staleTime: 5 * 60 * 1000,
    enabled: !!storeId,
  });

  return { products: data || [], isLoading };
}

export { PRODUCT_COLUMNS, PAGE_SIZE };
