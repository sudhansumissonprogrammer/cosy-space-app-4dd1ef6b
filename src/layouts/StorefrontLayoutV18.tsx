/**
 * Theme 18 — Dark Streetwear / All-Black Aesthetic
 * Inspired by thesagacity.in: full-black background, centered logo header,
 * full-screen hero carousel, edge-to-edge product grids, minimal product cards.
 */
import { Suspense, lazy } from "react";
import StorefrontShell from "@/layouts/StorefrontShell";
import CheckoutAwareLayout from "@/components/storefront/CheckoutAwareLayout";
import StorefrontMarquee from "@/components/storefront/StorefrontMarquee";

const LazyMobileBottomNav = lazy(() => import("@/components/storefront/MobileBottomNav"));
const LazyMobileBottomNavModern = lazy(() => import("@/components/storefront/MobileBottomNavModern"));
const LazyMobileBottomNavIconic = lazy(() => import("@/components/storefront/MobileBottomNavIconic"));

function getMobileNav(style: string, store: any) {
  if (style === "iconic") return <LazyMobileBottomNavIconic store={store} />;
  if (style === "modern") return <LazyMobileBottomNavModern store={store} />;
  return <LazyMobileBottomNav store={store} />;
}

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
                  {getMobileNav(mobileNavStyle, store)}
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
