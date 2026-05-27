/**
 * Theme 14 — "Classic Center" layout
 * Same as Theme 1 but: NO marquee in layout, logo defaults to center,
 * header style defaults to transparent.
 */
import { Suspense, lazy } from "react";
import CheckoutAwareLayout from "@/components/storefront/CheckoutAwareLayout";
import StorefrontShell from "@/layouts/StorefrontShell";

const LazyMobileBottomNav = lazy(() => import("@/components/storefront/MobileBottomNavSwitcher"));

const VALID_NAV_STYLES = ["classic", "modern", "v15", "v17", "glass", "notch", "neon", "tube", "bubble", "skeuo3d", "indicator", "wave"] as const;
type NavVariant = typeof VALID_NAV_STYLES[number];

export default function StorefrontLayoutV14({ slugOverride }: { slugOverride?: string } = {}) {
  return (
    <StorefrontShell
      slugOverride={slugOverride}
      showExitIntent
    >
      {({ store, themeConfig }) => {
        const rawNavStyle = (themeConfig as any)?.mobile_nav_style || "classic";
        const mobileNavStyle = VALID_NAV_STYLES.includes(rawNavStyle) ? rawNavStyle : "classic";
        const mobileNavEnabled = themeConfig?.mobile_nav_enabled ?? true;
        return (
          <CheckoutAwareLayout
            store={store}
            headerLogoAlignment={themeConfig?.header_logo_alignment || "center"}
            mobileNavEnabled={mobileNavEnabled}
            mobileNav={
              mobileNavEnabled && themeConfig ? (
                <Suspense fallback={null}>
                  <LazyMobileBottomNav store={store} variant={mobileNavStyle as NavVariant} />
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
