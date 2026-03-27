import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Canonical hook for fetching the current user's store.
 * Unifies column selection across Dashboard, DashboardLayout, and AppSidebar.
 * Seeds ["store", storeId] cache so child pages using useStoreData() get a cache hit.
 */

const MY_STORE_COLUMNS = "id, name, slug, logo_url, currency, order_mode, whatsapp_number, theme, features, is_suspended" as const;

export function useMyStore() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ["my-store", user?.id],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select(MY_STORE_COLUMNS)
        .eq("owner_id", user!.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;

      // Seed the per-storeId cache ONLY if it doesn't already have richer data.
      // useMyStore fetches partial columns; useStoreData fetches SELECT *.
      // Overwriting full data with partial data would erase fields like
      // mobile_hero_url, instagram_url, etc. causing the settings form to reset.
      if (data?.id) {
        queryClient.setQueryData(["store", data.id], (existing: any) => {
          // If we already have full data (has fields not in MY_STORE_COLUMNS), keep it
          if (existing && existing.instagram_url !== undefined) return existing;
          return data;
        });
      }

      return data;
    },
    enabled: !!user,
  });
}
