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
const LazyMobileBottomNav = lazy(() => import("@/components/storefront/MobileBottomNav"));
const LazyMobileBottomNavModern = lazy(() => import("@/components/storefront/MobileBottomNavModern"));
const LazyMobileBottomNavIconic = lazy(() => import("@/components/storefront/MobileBottomNavIconic"));

function getMobileNav(style: string, store: any) {
  if (style === "iconic") return <LazyMobileBottomNavIconic store={store} />;
  if (style === "classic") return <LazyMobileBottomNav store={store} />;
  if (style === "modern") return <LazyMobileBottomNavModern store={store} />;
  // default for theme-17 is its own V17 nav
  return <LazyMobileBottomNavV17 store={store} />;
}

function V17Inner({ store, themeConfig }: { store: any; themeConfig: any }) {
  const mobileNavEnabled = themeConfig?.mobile_nav_enabled ?? true;
  const mobileNavStyle = (themeConfig as any)?.mobile_nav_style || "v17";
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const headingFont = themeConfig?.heading_font || "Instrument Sans";
  const bodyFont = themeConfig?.body_font || "Instrument Sans";
  const fontsToLoad = Array.from(new Set([headingFont, bodyFont])).filter(Boolean);
  const googleFontsUrl = `https://fonts.googleapis.com/css2?${fontsToLoad.map(f => `family=${f.replace(/ /g, '+')}:wght@400;500;600;700`).join('&')}&display=swap`;

  return (
    <>
      <style>{`
        @import url('${googleFontsUrl}');
        :root {
          --v17-heading-font: '${headingFont}', sans-serif;
          --v17-body-font: '${bodyFont}', sans-serif;
          --v17-primary: #2B4C3F;
          --v17-bg: #FAFAF6;
          --v17-text: #000000;
          --v17-text-muted: #666;
          --v17-star: #1B5E4B;
          --v17-border: #e8e8e3;
          --v17-footer-bg: #0F2A22;
        }
        .v17-header-scroll { transition: background-color 0.3s ease, box-shadow 0.3s ease, color 0.3s ease; }
        .v17-header-transparent { background-color: transparent !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important; color: #fff !important; }
        .v17-header-transparent button, .v17-header-transparent a, .v17-header-transparent svg { color: #fff !important; stroke: #fff !important; }
        .v17-header-transparent .smart-header { background: transparent !important; }
        .v17-header-solid { background-color: #fff !important; box-shadow: 0 1px 4px rgba(0,0,0,0.08) !important; color: #000 !important; }
        .v17-header-solid button, .v17-header-solid a, .v17-header-solid svg { color: #000 !important; stroke: #000 !important; }
      `}</style>
      <div style={{
        fontFamily: `'${bodyFont}', var(--v17-body-font)`,
        backgroundColor: "var(--v17-bg)",
        color: "var(--v17-text)",
        "--storefront-heading-font": `'${headingFont}', sans-serif`,
        "--storefront-body-font": `'${bodyFont}', sans-serif`,
        "--storefront-primary": "#0F2A22",
        "--storefront-footer-text": "#ffffff",
        "--storefront-marquee-gradient": "linear-gradient(90deg, #0F2A22, #0F2A22, #0F2A22)",
        "--storefront-marquee-text-color": "#ffffff",
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
                {getMobileNav(mobileNavStyle, store)}
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
