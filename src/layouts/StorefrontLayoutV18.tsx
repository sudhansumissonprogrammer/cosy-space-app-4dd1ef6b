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
const LazyMobileBottomNavV15 = lazy(() => import("@/components/storefront/MobileBottomNavV15"));
const LazyMobileBottomNavV17 = lazy(() => import("@/components/storefront/MobileBottomNavV17"));

export default function StorefrontLayoutV18({ slugOverride }: { slugOverride?: string } = {}) {
  return (
    <StorefrontShell
      slugOverride={slugOverride}
      defaultPrimary="#ffffff"
      defaultButtonRadius="0"
      wrapperClassName="storefront-font min-h-screen font-sans"
      wrapperStyle={{
        backgroundColor: "#0a0a0a",
        color: "#f5f5f5",
        // Override shadcn CSS variables so ALL Tailwind semantic classes
        // (text-foreground, bg-card, text-muted-foreground, border-border etc.)
        // resolve to dark-theme values across every page in Theme 18.
        "--background": "0 0% 4%",
        "--foreground": "0 0% 96%",
        "--card": "0 0% 7%",
        "--card-foreground": "0 0% 96%",
        "--popover": "0 0% 7%",
        "--popover-foreground": "0 0% 96%",
        "--primary": "0 0% 100%",
        "--primary-foreground": "0 0% 4%",
        "--secondary": "0 0% 12%",
        "--secondary-foreground": "0 0% 90%",
        "--muted": "0 0% 15%",
        "--muted-foreground": "0 0% 60%",
        "--accent": "0 0% 15%",
        "--accent-foreground": "0 0% 96%",
        "--destructive": "0 72% 51%",
        "--destructive-foreground": "0 0% 100%",
        "--border": "0 0% 18%",
        "--input": "0 0% 18%",
        "--ring": "0 0% 60%",
      } as React.CSSProperties}
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
                  {mobileNavStyle === "v17" ? <LazyMobileBottomNavV17 store={store} /> :
                   mobileNavStyle === "v15" ? <LazyMobileBottomNavV15 store={store} /> :
                   mobileNavStyle === "modern" ? <LazyMobileBottomNavModern store={store} /> :
                   <LazyMobileBottomNav store={store} />}
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
