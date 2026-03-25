import { useParams } from "react-router-dom";
import { useMyStore } from "@/hooks/useMyStore";

/**
 * Resolves the :storeSlug URL param to a store UUID.
 * Uses the cached my-store data (already loaded by DashboardLayout)
 * so there's zero extra network requests.
 *
 * Returns { storeId, storeSlug, store } for compatibility with
 * all existing dashboard pages that previously used storeId from params.
 */
export function useStoreSlugParam() {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const { data: store } = useMyStore();

  // The slug from URL should match the cached store's slug
  const storeId = store?.slug === storeSlug ? store.id : undefined;

  return { storeId, storeSlug, store };
}
