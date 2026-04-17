/**
 * Theme 15 — "Classic Center Alt" layout
 * Same as Theme 14 but defaults to MobileBottomNavV15.
 */
import { Suspense, lazy } from "react";
import CheckoutAwareLayout from "@/components/storefront/CheckoutAwareLayout";
import StorefrontShell from "@/layouts/StorefrontShell";

const LazyMobileBottomNav = lazy(() => import("@/components/storefront/MobileBottomNav"));
const LazyMobileBottomNavModern = lazy(() => import("@/components/storefront/MobileBottomNavModern"));
const LazyMobileBottomNavV15 = lazy(() => import("@/components/storefront/MobileBottomNavV15"));
const LazyMobileBottomNavV17 = lazy(() => import("@/components/storefront/MobileBottomNavV17"));

const VALID_NAV_STYLES = ["classic", "modern", "v15", "v17"];

export default function StorefrontLayoutV15({ slugOverride }: { slugOverride?: string } = {}) {
  return (
    <StorefrontShell
      slugOverride={slugOverride}
      showExitIntent
    >
      {({ store, themeConfig }) => {
        const rawNavStyle = (themeConfig as any)?.mobile_nav_style || "v15";
        const mobileNavStyle = VALID_NAV_STYLES.includes(rawNavStyle) ? rawNavStyle : "v15";
        const mobileNavEnabled = themeConfig?.mobile_nav_enabled ?? true;
        return (
          <CheckoutAwareLayout
            store={store}
            headerLogoAlignment={themeConfig?.header_logo_alignment || "center"}
            mobileNavEnabled={mobileNavEnabled}
            mobileNav={
              mobileNavEnabled ? (
                <Suspense fallback={null}>
                  {mobileNavStyle === "v17" ? <LazyMobileBottomNavV17 store={store} /> :
                   mobileNavStyle === "v15" ? <LazyMobileBottomNavV15 store={store} /> :
                   mobileNavStyle === "modern" ? <LazyMobileBottomNavModern store={store} /> :
                   <LazyMobileBottomNav store={store} />}
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
