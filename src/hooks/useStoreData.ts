import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Centralized hook for fetching store data by storeId.
 * Supports admin mode where owner_id check is skipped.
 */
export function useStoreData(storeId?: string, isAdminView?: boolean) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["store", storeId],
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    queryFn: async () => {
      if (isAdminView) {
        // Admin viewing — fetch without owner filter using slug lookup
        // We already have storeId from admin RPC, so query by id
        const { data, error } = await supabase.rpc("get_store_as_admin", {
          _slug: storeId!, // We'll pass slug here
        });
        if (error) throw error;
        return data as any;
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
