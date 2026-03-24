import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Centralized hook for fetching store data by storeId.
 * Uses a shared query key ["store", storeId] so all pages
 * that need store data share the same cached result.
 * 
 * Cache is pre-seeded by useMyStore() in DashboardLayout,
 * so most child pages get an instant cache hit.
 *
 * Uses SELECT * because child pages (StoreSettings, StoreDomain, etc.)
 * need varying sets of columns.
 *
 * staleTime is set high (10 min) since store settings rarely change
 * and are invalidated on mutation.
 */
export function useStoreData(storeId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["store", storeId],
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .eq("id", storeId!)
        .eq("owner_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!storeId && !!user,
  });
}
