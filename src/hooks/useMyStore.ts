import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Canonical hook for fetching the current user's store.
 * Unifies column selection across Dashboard, DashboardLayout, and AppSidebar.
 *
 * Performance: Hydrates from localStorage cache on mount so returning users
 * see their store data instantly (eliminates ~500-600ms loading skeleton on
 * dashboard cold load). Cache is keyed by user.id and refreshed on every
 * successful fetch. Stale data is OK because React Query refetches in the
 * background and updates seamlessly.
 */

const MY_STORE_COLUMNS =
  "id, name, slug, logo_url, currency, order_mode, whatsapp_number, theme, features, is_suspended, custom_domain, billing_mode" as const;

const LS_KEY_PREFIX = "sf:my-store:v1:";
const LS_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h — stale data is fine; RQ refetches in bg

type CachedStore = { ts: number; data: any };

function readCache(userId: string): any | undefined {
  try {
    const raw = localStorage.getItem(LS_KEY_PREFIX + userId);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as CachedStore;
    if (!parsed?.data || typeof parsed.ts !== "number") return undefined;
    if (Date.now() - parsed.ts > LS_MAX_AGE_MS) return undefined;
    // Invalidate caches written before `billing_mode` was part of the selection,
    // otherwise commission-mode stores hydrate without the Wallet menu visible.
    if (!("billing_mode" in parsed.data)) return undefined;
    return parsed.data;
  } catch {
    return undefined;
  }
}

function writeCache(userId: string, data: any) {
  try {
    localStorage.setItem(
      LS_KEY_PREFIX + userId,
      JSON.stringify({ ts: Date.now(), data }),
    );
  } catch {
    // Ignore quota / private-mode errors
  }
}

export function useMyStore() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["my-store", user?.id],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    initialData: user?.id ? readCache(user.id) : undefined,
    initialDataUpdatedAt: 0, // mark as stale so a background refetch always runs
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select(MY_STORE_COLUMNS)
        .eq("owner_id", user!.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;

      // Persist for next visit's instant hydration
      if (data && user?.id) writeCache(user.id, data);

      // DO NOT seed ["store", storeId] cache here.
      // useMyStore fetches only partial columns (MY_STORE_COLUMNS).
      // useStoreData fetches SELECT * for settings pages.
      // Seeding would overwrite full data with partial data, causing
      // fields like instagram_url, mobile_hero_url to disappear.

      return data;
    },
    enabled: !!user,
  });

  // While the auth user is still resolving, the query is disabled and React
  // Query reports isLoading=false. Without this guard, the dashboard briefly
  // falls through to the "Create your store" empty state on cold load when
  // there is no localStorage cache. Treat "no user yet" as still loading.
  return {
    ...query,
    isLoading: query.isLoading || !user,
  };
}
