import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CustomPage {
  id: string;
  title: string;
  slug: string;
  content: string | null;
  image_url: string | null;
}

/**
 * Read custom pages bundled in the Worker-injected __STOREFRONT_DATA__ shell.
 * If present (production fast-path), we skip the network round-trip entirely.
 * Falls back to a direct Supabase query (preview / cold-load without shell).
 */
function readShellCustomPages(): CustomPage[] | null {
  if (typeof window === "undefined") return null;
  const shell = (window as any).__STOREFRONT_DATA__;
  const arr = shell?.custom_pages;
  return Array.isArray(arr) ? (arr as CustomPage[]) : null;
}

export function useCustomPages(storeId: string | undefined) {
  const queryClient = useQueryClient();

  // Hydrate the cache synchronously from window.__STOREFRONT_DATA__ on first
  // mount so consumers (DesktopNavBar, HamburgerMenu, …) get instant data
  // without firing a Supabase query.
  useEffect(() => {
    if (!storeId) return;
    const existing = queryClient.getQueryData<CustomPage[]>(["storefront-custom-pages", storeId]);
    if (existing && existing.length) return;
    const fromShell = readShellCustomPages();
    if (fromShell) {
      queryClient.setQueryData(["storefront-custom-pages", storeId], fromShell);
    }
  }, [storeId, queryClient]);

  return useQuery({
    queryKey: ["storefront-custom-pages", storeId],
    queryFn: async () => {
      // Prefer shell data — zero network requests.
      const fromShell = readShellCustomPages();
      if (fromShell) return fromShell;

      const { data, error } = await supabase
        .from("store_pages")
        .select("id, title, slug, content, image_url")
        .eq("store_id", storeId!)
        .eq("page_type", "custom")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CustomPage[];
    },
    enabled: !!storeId,
    staleTime: 5 * 60 * 1000,
    // If shell already provided the data, skip the fetch entirely.
    initialData: () => readShellCustomPages() ?? undefined,
  });
}
