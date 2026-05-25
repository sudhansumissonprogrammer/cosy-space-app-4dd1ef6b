import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdminView } from "@/contexts/AdminViewContext";

const STORE_SETTINGS_COLUMNS =
  "id, owner_id, name, slug, description, logo_url, created_at, updated_at, whatsapp_number, banner_url, is_suspended, business_hours, location, is_verified, city, state, currency, instagram_url, facebook_url, order_mode, theme, features, custom_domain, return_policy, shipping_policy, best_selling_carousel, mobile_hero_url, facebook_pixel_id, meta_title, meta_description, og_image_url, mobile_hero_images, domain_verified, about_us_text, about_us_image_url, partial_payment_enabled, partial_payment_type, partial_payment_value" as const;

/**
 * Centralized hook for fetching store data by storeId.
 * In admin view mode, the data is pre-seeded by useAdminStoreView,
 * so this hook returns cached data. If cache misses, it fetches via admin RPC.
 */
export function useStoreData(storeId?: string) {
  const { user } = useAuth();
  const isAdminView = useIsAdminView();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ["store", storeId],
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    initialData: () => storeId ? queryClient.getQueryData(["store", storeId]) : undefined,
    queryFn: async () => {
      if (isAdminView) {
        const cached = queryClient.getQueryData(["store", storeId!]);
        if (cached) return cached as any;

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
        .select(STORE_SETTINGS_COLUMNS)
        .eq("id", storeId!)
        .eq("owner_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
    enabled: !!storeId && (isAdminView || !!user),
  });
}
