import { Suspense, useEffect, useState, type ComponentType, type LazyExoticComponent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchStoreEnabledApps } from "@/hooks/useStoreEnabledApps";
import { APP_REGISTRY } from "@/lib/appStore/registry";
import type { StoreData } from "@/layouts/StorefrontLayout.logic";

interface AppRow { app_id: string; config: any }

/**
 * Mount point for all installed & enabled storefront apps (Spin Wheel, etc.).
 * Only renders if the merchant has installed AND enabled the app in the dashboard.
 */
export default function StorefrontApps({ store, primaryColor, accentColor }: { store: StoreData; primaryColor: string; accentColor?: string }) {
  const [apps, setApps] = useState<AppRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!store?.slug) return;
    (async () => {
      try {
        const data = await fetchStoreEnabledApps(store.slug);
        if (!cancelled) setApps(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setApps([]);
      }
    })();
    return () => { cancelled = true; };
  }, [store?.slug]);

  if (!apps || apps.length === 0) return null;

  return (
    <>
      {apps.map((row) => {
        const meta = APP_REGISTRY.find((a) => a.id === row.app_id);
        if (!meta || !meta.StorefrontComponent) return null;
        const Cmp = meta.StorefrontComponent as LazyExoticComponent<ComponentType<any>>;
        return (
          <Suspense key={row.app_id} fallback={null}>
            <Cmp
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
