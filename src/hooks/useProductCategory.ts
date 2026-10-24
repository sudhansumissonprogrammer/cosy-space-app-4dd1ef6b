import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Deferred metadata-only lookup; never gates the product or main photo. */
export function useProductCategory(storeId: string, name?: string | null) {
  const { data } = useQuery({
    queryKey: ["seo-product-category", storeId, name],
    enabled: !!storeId && !!name,
    queryFn: async () => {
      const { data, error } = await supabase.from("categories")
        .select("name,slug").eq("store_id", storeId).eq("name", name || "")
        .eq("is_hidden", false).maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 30 * 60 * 1000,
  });
  return data;
}