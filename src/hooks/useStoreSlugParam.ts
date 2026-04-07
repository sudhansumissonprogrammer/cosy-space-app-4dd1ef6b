import { useParams } from "react-router-dom";
import { useMyStore } from "@/hooks/useMyStore";
import { useAdminStoreView } from "@/hooks/useAdminStoreView";

/**
 * Resolves the :storeSlug URL param to a store UUID.
 * Supports admin viewing other stores via admin RPC.
 */
export function useStoreSlugParam() {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const { data: ownStore, isLoading: ownStoreLoading } = useMyStore();
  const { isAdminView, adminStore } = useAdminStoreView(ownStore, ownStoreLoading);

  if (isAdminView && adminStore) {
    return {
      storeId: adminStore.id as string,
      storeSlug: adminStore.slug as string,
      store: adminStore,
      isAdminView: true,
    };
  }

  // Normal flow
  const storeId = ownStore?.slug === storeSlug
    ? ownStore.id
    : ownStore?.id === storeSlug
      ? ownStore.id
      : undefined;

  return { storeId, storeSlug: ownStore?.slug || storeSlug, store: ownStore, isAdminView: false };
}
