/**
 * Theme 14 — "Classic Center" layout
 * Same as Theme 1 but: NO marquee in layout, logo defaults to center,
 * header style defaults to transparent.
 */
import { Suspense, lazy } from "react";
import CheckoutAwareLayout from "@/components/storefront/CheckoutAwareLayout";
import ClassicStorefrontSkeleton from "@/components/storefront/ClassicStorefrontSkeleton";
import StorefrontShell from "@/layouts/StorefrontShell";

const LazyMobileBottomNav = lazy(() => import("@/components/storefront/MobileBottomNav"));
const LazyMobileBottomNavModern = lazy(() => import("@/components/storefront/MobileBottomNavModern"));
const LazyMobileBottomNavStarter = lazy(() => import("@/components/storefront/MobileBottomNavV17"));

export default function StorefrontLayoutV14({ slugOverride }: { slugOverride?: string } = {}) {
  return (
    <StorefrontShell
      slugOverride={slugOverride}
      showExitIntent
      skeleton={<ClassicStorefrontSkeleton />}
    >
      {({ store, themeConfig }) => {
        const mobileNavStyle = (themeConfig as any)?.mobile_nav_style || "classic";
        const mobileNavEnabled = themeConfig?.mobile_nav_enabled ?? true;
        return (
          <CheckoutAwareLayout
            store={store}
            headerLogoAlignment={themeConfig?.header_logo_alignment || "center"}
            mobileNavEnabled={mobileNavEnabled}
            mobileNav={
              mobileNavEnabled ? (
                <Suspense fallback={null}>
                  {mobileNavStyle === "modern" ? <LazyMobileBottomNavModern store={store} /> : mobileNavStyle === "starter" ? <LazyMobileBottomNavStarter store={store} /> : <LazyMobileBottomNav store={store} />}
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
