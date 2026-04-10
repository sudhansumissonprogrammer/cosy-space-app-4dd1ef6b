import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Canonical hook for fetching the current user's store.
 * Unifies column selection across Dashboard, DashboardLayout, and AppSidebar.
 * Seeds ["store", storeId] cache so child pages using useStoreData() get a cache hit.
 */

const MY_STORE_COLUMNS = "id, name, slug, logo_url, currency, order_mode, whatsapp_number, theme, features, is_suspended, custom_domain" as const;

export function useMyStore() {
  const { user } = useAuth();

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

      // DO NOT seed ["store", storeId] cache here.
      // useMyStore fetches only partial columns (MY_STORE_COLUMNS).
      // useStoreData fetches SELECT * for settings pages.
      // Seeding would overwrite full data with partial data, causing
      // fields like instagram_url, mobile_hero_url to disappear.

      return data;
    },
    enabled: !!user,
  });
}
