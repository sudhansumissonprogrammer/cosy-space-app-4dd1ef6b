/**
 * Theme 21 — Exact duplicate of Theme 1 (Classic).
 * Only difference: Buy Now triggers a phone-collection modal before checkout.
 */
import { Suspense, lazy } from "react";
import StorefrontMarquee from "@/components/storefront/StorefrontMarquee";
import CheckoutAwareLayout from "@/components/storefront/CheckoutAwareLayout";
import StorefrontShell from "@/layouts/StorefrontShell";

const LazyMobileBottomNav = lazy(() => import("@/components/storefront/MobileBottomNavSwitcher"));

const VALID_NAV_STYLES = ["classic", "modern", "v15", "v17"] as const;
type NavVariant = typeof VALID_NAV_STYLES[number];

export default function StorefrontLayoutV21({ slugOverride }: { slugOverride?: string } = {}) {
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
            marquee={
              (themeConfig?.marquee_enabled ?? true) ? (
                <StorefrontMarquee text={themeConfig?.marquee_text} />
              ) : undefined
            }
            headerLogoAlignment={themeConfig?.header_logo_alignment || "left"}
            mobileNavEnabled={mobileNavEnabled}
            mobileNav={
              mobileNavEnabled && themeConfig ? (
                <Suspense fallback={null}>
                  <LazyMobileBottomNav store={store} variant={mobileNavStyle as NavVariant} />
                </Suspense>
              ) : undefined
            }
            headerStyle={themeConfig?.header_style || "normal"}
          />
        );
      }}
    </StorefrontShell>
  );
}
