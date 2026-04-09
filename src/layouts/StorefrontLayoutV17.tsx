/**
 * Theme 17 — Streetwear / Dark Green Aesthetic
 * Inspired by systumm.shop: dark header, centered logo, full-screen hero,
 * 2-col product grid with wishlist/cart overlays, scrolling trust ticker,
 * customer reviews section, and sticky mobile bottom nav with custom icons.
 */
import { Suspense, lazy } from "react";
import StorefrontShell from "@/layouts/StorefrontShell";
import CheckoutAwareLayout from "@/components/storefront/CheckoutAwareLayout";
import StorefrontMarquee from "@/components/storefront/StorefrontMarquee";

const LazyMobileBottomNavV17 = lazy(() => import("@/components/storefront/MobileBottomNavV17"));

export default function StorefrontLayoutV17({ slugOverride }: { slugOverride?: string } = {}) {
  return (
    <StorefrontShell
      slugOverride={slugOverride}
      showExitIntent
      defaultPrimary="#1B3A2D"
      defaultButtonRadius="0.25rem"
    >
      {({ store, themeConfig }) => {
        const mobileNavEnabled = themeConfig?.mobile_nav_enabled ?? true;
        return (
          <CheckoutAwareLayout
            store={store}
            marquee={
              (themeConfig?.marquee_enabled ?? true) ? (
                <StorefrontMarquee text={themeConfig?.marquee_text || "Oversized Fits. Premium Feel."} />
              ) : undefined
            }
            headerLogoAlignment={themeConfig?.header_logo_alignment || "left"}
            mobileNavEnabled={mobileNavEnabled}
            mobileNav={
              mobileNavEnabled ? (
                <Suspense fallback={null}>
                  <LazyMobileBottomNavV17 store={store} />
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
