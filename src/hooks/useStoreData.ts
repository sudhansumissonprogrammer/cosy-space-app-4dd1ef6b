import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdminView } from "@/contexts/AdminViewContext";

const STORE_SETTINGS_COLUMNS =
  "id, owner_id, name, slug, description, logo_url, created_at, updated_at, whatsapp_number, banner_url, is_suspended, business_hours, location, is_verified, city, state, currency, instagram_url, facebook_url, order_mode, theme, features, custom_domain, return_policy, shipping_policy, best_selling_carousel, mobile_hero_url, facebook_pixel_id, meta_title, meta_description, og_image_url, mobile_hero_images, domain_verified, about_us_text, about_us_image_url, partial_payment_enabled, partial_payment_type, partial_payment_value, billing_mode, checkout_v2_enabled, capi_disabled" as const;

async function fetchViaAdminRpc(storeId: string) {
  const { data, error } = await supabase.rpc("get_store_as_admin", { _slug: storeId });
  if (error) throw error;
  return data as any;
}

/**
 * Centralized hook for fetching store data by storeId.
 * Owner path uses SELECT with owner filter. In admin view (or if the
 * AdminViewContext hasn't flipped yet on first mount) we fall back to
 * the admin RPC so the settings form doesn't render every input blank
 * during the admin-view resolution race.
 */
export function useStoreData(storeId?: string) {
  const { user } = useAuth();
  const isAdminView = useIsAdminView();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["store", storeId],
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    initialData: () => storeId ? queryClient.getQueryData(["store", storeId]) : undefined,
    initialDataUpdatedAt: 0,
    queryFn: async () => {
      if (isAdminView) {
        try {
          const adminData = await fetchViaAdminRpc(storeId!);
          if (adminData) return adminData;
        } catch (_) {
          // fall through to cache
        }
        return (queryClient.getQueryData(["store", storeId!]) as any) ?? null;
      }

      const { data, error } = await supabase
        .from("stores")
        .select(STORE_SETTINGS_COLUMNS)
        .eq("id", storeId!)
        .eq("owner_id", user!.id)
        .maybeSingle();
      if (error) throw error;

      if (data) return data;

      // Owner filter returned no row → current user isn't the owner.
      // Most likely: admin viewing another store and AdminViewContext
      // hasn't flipped to true yet (race between useAdminStoreView RPC
      // and the first useStoreData mount). Try the admin RPC directly.
      try {
        const adminData = await fetchViaAdminRpc(storeId!);
        if (adminData) return adminData;
      } catch (_) {
        // not admin — ignore
      }
      const cached = queryClient.getQueryData(["store", storeId!]);
      if (cached) return cached as any;
      return null;
    },
    enabled: !!storeId && (isAdminView || !!user),
  });

  // When AdminViewContext flips true after mount, invalidate any null
  // result captured during the race so the admin path re-runs.
  useEffect(() => {
    if (isAdminView && storeId && query.data == null) {
      queryClient.invalidateQueries({ queryKey: ["store", storeId] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdminView, storeId]);

  return query;
}
