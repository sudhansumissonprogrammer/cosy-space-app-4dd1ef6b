import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Detects if the current user is an admin viewing another user's store.
 * Uses the URL storeSlug param and checks against the user's own store.
 * If admin + slug doesn't match own store, fetches via admin RPC.
 */
export function useAdminStoreView(ownStore: { id: string; slug: string } | null | undefined) {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const { user } = useAuth();

  // Determine if we need admin override
  const needsAdminFetch = !!storeSlug && !!user && !!ownStore !== undefined &&
    (!ownStore || (ownStore.slug !== storeSlug && ownStore.id !== storeSlug));

  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", user?.id],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.rpc("has_role", {
        _user_id: user!.id,
        _role: "admin" as any,
      });
      return !!data;
    },
    enabled: !!user && needsAdminFetch,
  });

  const { data: adminStore, isLoading: adminStoreLoading } = useQuery({
    queryKey: ["admin-store-view", storeSlug],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_store_as_admin", {
        _slug: storeSlug!,
      });
      if (error) throw error;
      return data as any;
    },
    enabled: needsAdminFetch && isAdmin === true,
  });

  return {
    isAdminView: needsAdminFetch && isAdmin === true,
    adminStore,
    adminStoreLoading,
  };
}
