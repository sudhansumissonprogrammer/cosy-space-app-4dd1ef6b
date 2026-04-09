/**
 * Theme 15 — "Classic Center Alt" layout
 * Same as Theme 14 but uses MobileBottomNavV15 as default.
 */
import { Suspense, lazy } from "react";
import CheckoutAwareLayout from "@/components/storefront/CheckoutAwareLayout";
import ClassicStorefrontSkeleton from "@/components/storefront/ClassicStorefrontSkeleton";
import StorefrontShell from "@/layouts/StorefrontShell";

const LazyMobileBottomNavV15 = lazy(() => import("@/components/storefront/MobileBottomNavV15"));
const LazyMobileBottomNav = lazy(() => import("@/components/storefront/MobileBottomNav"));
const LazyMobileBottomNavModern = lazy(() => import("@/components/storefront/MobileBottomNavModern"));
const LazyMobileBottomNavIconic = lazy(() => import("@/components/storefront/MobileBottomNavIconic"));

function getMobileNav(style: string, store: any) {
  if (style === "iconic") return <LazyMobileBottomNavIconic store={store} />;
  if (style === "modern") return <LazyMobileBottomNavModern store={store} />;
  if (style === "classic") return <LazyMobileBottomNav store={store} />;
  // default for theme-15 is its own V15 nav
  return <LazyMobileBottomNavV15 store={store} />;
}

export default function StorefrontLayoutV15({ slugOverride }: { slugOverride?: string } = {}) {
  return (
    <StorefrontShell
      slugOverride={slugOverride}
      showExitIntent
      skeleton={<ClassicStorefrontSkeleton />}
    >
      {({ store, themeConfig }) => {
        const mobileNavStyle = (themeConfig as any)?.mobile_nav_style || "pill";
        const mobileNavEnabled = themeConfig?.mobile_nav_enabled ?? true;
        return (
          <CheckoutAwareLayout
            store={store}
            headerLogoAlignment={themeConfig?.header_logo_alignment || "center"}
            mobileNavEnabled={mobileNavEnabled}
            mobileNav={
              mobileNavEnabled ? (
                <Suspense fallback={null}>
                  {getMobileNav(mobileNavStyle, store)}
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
