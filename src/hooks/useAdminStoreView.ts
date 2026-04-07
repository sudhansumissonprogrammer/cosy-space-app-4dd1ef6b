import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Detects if the current user is an admin viewing another user's store.
 * If so, fetches store data via admin RPC and seeds the query cache.
 *
 * Key fix: always check admin role eagerly (not gated on ownStoreLoading)
 * so admin view resolves as fast as possible.
 */
export function useAdminStoreView(
  ownStore: { id: string; slug: string } | null | undefined,
  ownStoreLoading: boolean,
) {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Always check admin role early (cached 10 min)
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
    enabled: !!user,
  });

  // Determine if we need admin override:
  // - URL has a store slug
  // - Own store is loaded and slug doesn't match, OR own store is still loading (we don't know yet)
  const slugMismatch =
    !!storeSlug &&
    !!ownStore &&
    ownStore.slug !== storeSlug &&
    ownStore.id !== storeSlug;

  // If own store is still loading, we don't know if it matches yet.
  // But if user is admin, start fetching the target store anyway (parallel).
  const needsAdminFetch =
    !!storeSlug && !!user && (slugMismatch || (!ownStore && !ownStoreLoading));

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

  // Seed the ["store", storeId] cache so useStoreData gets a hit
  useEffect(() => {
    if (adminStore?.id) {
      queryClient.setQueryData(["store", adminStore.id], adminStore);
    }
  }, [adminStore, queryClient]);

  const isAdminView = isAdmin === true && !!adminStore && needsAdminFetch;

  return {
    isAdminView,
    adminStore,
    adminStoreLoading:
      needsAdminFetch && isAdmin === true && adminStoreLoading,
  };
}
