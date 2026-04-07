import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdminView } from "@/contexts/AdminViewContext";

/**
 * Centralized hook for fetching store data by storeId.
 * In admin view mode, the data is pre-seeded by useAdminStoreView,
 * so this hook returns cached data. If cache misses, it fetches via admin RPC.
 */
export function useStoreData(storeId?: string) {
  const { user } = useAuth();
  const isAdminView = useIsAdminView();

  return useQuery({
    queryKey: ["store", storeId],
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    queryFn: async () => {
      if (isAdminView) {
        // Admin view: fetch via admin RPC using store id
        // First try to find the slug for this store id
        const { data: adminData, error: adminError } = await supabase.rpc(
          "get_store_as_admin",
          { _slug: storeId! },
        );
        if (!adminError && adminData) return adminData as any;

        // If slug lookup fails, the cache should have been seeded.
        // Return null as last resort.
        return null;
      }

      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .eq("id", storeId!)
        .eq("owner_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!storeId && (isAdminView || !!user),
  });
}
