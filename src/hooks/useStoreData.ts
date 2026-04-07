import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdminView } from "@/contexts/AdminViewContext";

/**
 * Centralized hook for fetching store data by storeId.
 * In admin view mode, the data is pre-seeded by useAdminStoreView,
 * so this hook returns cached data without owner_id filtering.
 */
export function useStoreData(storeId?: string) {
  const { user } = useAuth();
  const isAdminView = useIsAdminView();

  return useQuery({
    queryKey: ["store", storeId],
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    queryFn: async () => {
      // In admin view, data should already be in cache from useAdminStoreView.
      // If not cached, we can't fetch without owner check, so return null.
      if (isAdminView) {
        // Fallback: shouldn't reach here if cache is seeded properly
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
