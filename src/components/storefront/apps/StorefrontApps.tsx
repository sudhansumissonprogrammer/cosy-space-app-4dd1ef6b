import { lazy, Suspense } from "react";
import { useStoreEnabledApps } from "@/hooks/useStoreEnabledApps";
import type { StoreData } from "@/layouts/StorefrontLayout.logic";

const SpinWheel = lazy(() => import("./SpinWheel/SpinWheelApp"));

/**
 * Mount point for all installed & enabled storefront apps (Spin Wheel, etc.).
 * Only renders if the merchant has installed AND enabled the app in the dashboard.
 */
export default function StorefrontApps({ store, primaryColor, accentColor }: { store: StoreData; primaryColor: string; accentColor?: string }) {
  const { data: apps } = useStoreEnabledApps(store.slug);

  if (!apps || apps.length === 0) return null;

  return (
    <>
      {apps.map((row) => {
        if (row.app_id !== "spin-wheel") return null;
        return (
          <Suspense key={row.app_id} fallback={null}>
            <SpinWheel
              storeId={store.id}
              storeName={store.name}
              primaryColor={primaryColor}
              accentColor={accentColor}
              config={row.config || {}}
            />
          </Suspense>
        );
      })}
    </>
  );
}
