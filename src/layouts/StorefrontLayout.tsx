import { Suspense, lazy } from "react";
import type { Tables } from "@/integrations/supabase/types";
import StorefrontMarquee from "@/components/storefront/StorefrontMarquee";
import CheckoutAwareLayout from "@/components/storefront/CheckoutAwareLayout";
import ClassicStorefrontSkeleton from "@/components/storefront/ClassicStorefrontSkeleton";
import StorefrontShell from "@/layouts/StorefrontShell";

// Re-export for backward compatibility — other layouts import these
export type { Tables };
export type StoreData = Tables<"stores">;
export { useStorefront } from "@/layouts/StorefrontLayout.logic";

const LazyMobileBottomNav = lazy(() => import("@/components/storefront/MobileBottomNav"));
const LazyMobileBottomNavModern = lazy(() => import("@/components/storefront/MobileBottomNavModern"));
const LazyMobileBottomNavIconic = lazy(() => import("@/components/storefront/MobileBottomNavIconic"));

function getMobileNav(style: string, store: any) {
  if (style === "iconic") return <LazyMobileBottomNavIconic store={store} />;
  if (style === "modern") return <LazyMobileBottomNavModern store={store} />;
  return <LazyMobileBottomNav store={store} />;
}

export default function StorefrontLayout({ slugOverride }: { slugOverride?: string } = {}) {
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
            marquee={
              (themeConfig?.marquee_enabled ?? true) ? (
                <StorefrontMarquee text={themeConfig?.marquee_text} />
              ) : undefined
            }
            headerLogoAlignment={themeConfig?.header_logo_alignment || "left"}
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
