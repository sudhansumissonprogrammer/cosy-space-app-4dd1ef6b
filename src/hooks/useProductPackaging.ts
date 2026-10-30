import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CategoryPackaging } from "@/lib/categoryPackaging";

export async function fetchProductPackaging(storeId: string, productId: string): Promise<CategoryPackaging | null> {
  const { data, error } = await supabase.rpc("get_product_packaging", { _store_id: storeId, _product_id: productId });
  if (error) throw error;
  return data ? data as unknown as CategoryPackaging : null;
}

export function useProductPackaging(storeId: string, productId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["product-packaging", storeId, productId],
    enabled: enabled && !!productId,
    queryFn: () => productId ? fetchProductPackaging(storeId, productId) : Promise.resolve(null),
    staleTime: 0,
  });
}