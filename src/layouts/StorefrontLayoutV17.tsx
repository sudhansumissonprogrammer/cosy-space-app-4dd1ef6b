/**
 * Theme 17 — Streetwear / systumm.shop exact clone
 * Dark green header (#2B4C3F), Cormorant Garamond headings, Jost body,
 * warm off-white bg (#FAFAF6), rounded cards, green stars.
 * NO theme color customization — hardcoded systumm aesthetic.
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
      defaultPrimary="#2B4C3F"
      defaultButtonRadius="0.5rem"
    >
      {({ store, themeConfig }) => {
        const mobileNavEnabled = themeConfig?.mobile_nav_enabled ?? true;
        return (
          <>
            {/* Inject systumm.shop fonts + CSS variables */}
            <style>{`
              @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Jost:wght@300;400;500;600;700&display=swap');
              :root {
                --v17-heading-font: 'Cormorant Garamond', serif;
                --v17-body-font: 'Jost', sans-serif;
                --v17-primary: #2B4C3F;
                --v17-bg: #FAFAF6;
                --v17-text: #1a1a1a;
                --v17-text-muted: #666;
                --v17-star: #1B5E4B;
                --v17-border: #e8e8e3;
              }
            `}</style>
            <div style={{
              fontFamily: "var(--v17-body-font)",
              backgroundColor: "var(--v17-bg)",
              color: "var(--v17-text)",
            }}>
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
            </div>
          </>
        );
      }}
    </StorefrontShell>
  );
}
