import { createContext, useContext } from "react";

/**
 * Provides the resolved store for the current dashboard session.
 * DashboardLayout populates this — child pages should read from here
 * instead of calling useMyStore() directly, so admin-view works.
 */
interface DashboardStoreContextType {
  store: any | null | undefined;
  storeId: string | undefined;
  storeSlug: string | undefined;
  isLoading: boolean;
}

const DashboardStoreContext = createContext<DashboardStoreContextType>({
  store: undefined,
  storeId: undefined,
  storeSlug: undefined,
  isLoading: true,
});

export const DashboardStoreProvider = DashboardStoreContext.Provider;

export function useDashboardStore() {
  return useContext(DashboardStoreContext);
}
