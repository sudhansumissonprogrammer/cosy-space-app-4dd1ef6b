/**
 * Theme 15 — "Classic Center Alt" layout
 * Same as Theme 14 but uses MobileBottomNavV15.
 */
import { Suspense, lazy } from "react";
import CheckoutAwareLayout from "@/components/storefront/CheckoutAwareLayout";
import ClassicStorefrontSkeleton from "@/components/storefront/ClassicStorefrontSkeleton";
import StorefrontShell from "@/layouts/StorefrontShell";

const LazyMobileBottomNavV15 = lazy(() => import("@/components/storefront/MobileBottomNavV15"));
const LazyMobileBottomNav = lazy(() => import("@/components/storefront/MobileBottomNav"));
const LazyMobileBottomNavModern = lazy(() => import("@/components/storefront/MobileBottomNavModern"));
const LazyMobileBottomNavStarter = lazy(() => import("@/components/storefront/MobileBottomNavV17"));

export default function StorefrontLayoutV15({ slugOverride }: { slugOverride?: string } = {}) {
  return (
    <StorefrontShell
      slugOverride={slugOverride}
      showExitIntent
      skeleton={<ClassicStorefrontSkeleton />}
    >
      {({ store, themeConfig }) => {
        const mobileNavEnabled = themeConfig?.mobile_nav_enabled ?? true;
        const mobileNavStyle = (themeConfig as any)?.mobile_nav_style || "classic";
        return (
          <CheckoutAwareLayout
            store={store}
            headerLogoAlignment={themeConfig?.header_logo_alignment || "center"}
            mobileNavEnabled={mobileNavEnabled}
            mobileNav={
              mobileNavEnabled ? (
                <Suspense fallback={null}>
                  {mobileNavStyle === "modern" ? <LazyMobileBottomNavModern store={store} /> : mobileNavStyle === "starter" ? <LazyMobileBottomNavStarter store={store} /> : <LazyMobileBottomNavV15 store={store} />}
                </Suspense>
              ) : undefined
            }
            headerStyle={themeConfig?.header_style && themeConfig.header_style !== "normal" ? themeConfig.header_style : "transparent"}
          />
        );
      }}
    </StorefrontShell>
  );
}
