/**
 * Theme 18 — Dark Streetwear / All-Black Aesthetic
 * Inspired by thesagacity.in: full-black background, centered logo header,
 * full-screen hero carousel, edge-to-edge product grids, minimal product cards.
 */
import { Suspense, lazy } from "react";
import V17CartBadge from "@/components/storefront/V17CartBadge";
import StorefrontShell from "@/layouts/StorefrontShell";
import CheckoutAwareLayout from "@/components/storefront/CheckoutAwareLayout";
import StorefrontMarquee from "@/components/storefront/StorefrontMarquee";

const LazyMobileBottomNav = lazy(() => import("@/components/storefront/MobileBottomNav"));
const LazyMobileBottomNavModern = lazy(() => import("@/components/storefront/MobileBottomNavModern"));

export default function StorefrontLayoutV18({ slugOverride }: { slugOverride?: string } = {}) {
  return (
    <StorefrontShell
      slugOverride={slugOverride}
      defaultPrimary="#ffffff"
      defaultButtonRadius="0"
      wrapperClassName="storefront-font min-h-screen font-sans"
      wrapperStyle={{ backgroundColor: "#0a0a0a", color: "#f5f5f5" }}
    >
      {({ store, themeConfig }) => {
        const mobileNavStyle = (themeConfig as any)?.mobile_nav_style || "modern";
        const mobileNavEnabled = themeConfig?.mobile_nav_enabled ?? true;
        return (
          <CheckoutAwareLayout
            store={store}
            marquee={
              (themeConfig?.marquee_enabled ?? false) ? (
                <StorefrontMarquee text={themeConfig?.marquee_text} />
              ) : undefined
            }
            headerLogoAlignment={themeConfig?.header_logo_alignment || "center"}
            mobileNavEnabled={mobileNavEnabled}
            mobileNav={
              mobileNavEnabled ? (
                <Suspense fallback={null}>
                  {mobileNavStyle === "modern" ? <LazyMobileBottomNavModern store={store} /> : <LazyMobileBottomNav store={store} />}
                </Suspense>
              ) : undefined
            }
            headerStyle={themeConfig?.header_style || "normal"}
            useSearchInHeader
            customCartIcon={<V17CartBadge />}
            headerBgOverride="#0a0a0a"
            headerIconColor="#ffffff"
          />
        );
      }}
    </StorefrontShell>
  );
}
