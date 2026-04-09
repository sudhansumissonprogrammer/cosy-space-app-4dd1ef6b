/**
 * Theme 17 — Streetwear / systumm.shop exact clone
 * Dark green header (#2B4C3F), Instrument Sans body,
 * warm off-white bg (#FAFAF6), rounded cards, green stars.
 * Footer: deep dark green (#0F2A22).
 */
import { Suspense, lazy, useState, useEffect } from "react";
import StorefrontShell from "@/layouts/StorefrontShell";
import CheckoutAwareLayout from "@/components/storefront/CheckoutAwareLayout";
import StorefrontMarquee from "@/components/storefront/StorefrontMarquee";

const LazyMobileBottomNavV17 = lazy(() => import("@/components/storefront/MobileBottomNavV17"));

function V17Inner({ store, themeConfig }: { store: any; themeConfig: any }) {
  const mobileNavEnabled = themeConfig?.mobile_nav_enabled ?? true;
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&display=swap');
        :root {
          --v17-heading-font: 'Instrument Sans', sans-serif;
          --v17-body-font: 'Instrument Sans', sans-serif;
          --v17-primary: #2B4C3F;
          --v17-bg: #FAFAF6;
          --v17-text: #000000;
          --v17-text-muted: #666;
          --v17-star: #1B5E4B;
          --v17-border: #e8e8e3;
          --v17-footer-bg: #0F2A22;
        }
        .v17-header-scroll { transition: background-color 0.3s ease, box-shadow 0.3s ease; }
        .v17-header-transparent { background-color: transparent !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
        .v17-header-solid { background-color: #fff !important; box-shadow: 0 1px 4px rgba(0,0,0,0.08) !important; backdrop-filter: blur(12px) !important; }
      `}</style>
      <div style={{
        fontFamily: "var(--v17-body-font)",
        backgroundColor: "var(--v17-bg)",
        color: "var(--v17-text)",
        "--storefront-primary": "#0F2A22",
        "--storefront-footer-text": "#ffffff",
      } as React.CSSProperties}>
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
          headerStyle="transparent"
          headerClassName={`v17-header-scroll ${scrolled ? 'v17-header-solid' : 'v17-header-transparent'}`}
        />
      </div>
    </>
  );
}

export default function StorefrontLayoutV17({ slugOverride }: { slugOverride?: string } = {}) {
  return (
    <StorefrontShell
      slugOverride={slugOverride}
      showExitIntent
      defaultPrimary="#2B4C3F"
      defaultButtonRadius="0.5rem"
    >
      {({ store, themeConfig }) => <V17Inner store={store} themeConfig={themeConfig} />}
    </StorefrontShell>
  );
}
