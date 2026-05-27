/**
 * Theme 18 — Dark Streetwear / All-Black Aesthetic
 * Inspired by thesagacity.in: full-black background, centered logo header,
 * full-screen hero carousel, edge-to-edge product grids, minimal product cards.
 */
import { Suspense, lazy, useState, useEffect } from "react";
import V17CartBadge from "@/components/storefront/V17CartBadge";
import StorefrontShell from "@/layouts/StorefrontShell";
import CheckoutAwareLayout from "@/components/storefront/CheckoutAwareLayout";
import StorefrontMarquee from "@/components/storefront/StorefrontMarquee";

const LazyMobileBottomNav = lazy(() => import("@/components/storefront/MobileBottomNavSwitcher"));
type NavVariant = "classic" | "modern" | "v15" | "v17";

function V18Inner({ store, themeConfig }: { store: any; themeConfig: any }) {
  const rawNavStyle = (themeConfig as any)?.mobile_nav_style || "modern";
  // Normalize legacy/unknown values to valid options
  const mobileNavStyle = ["classic", "modern", "v15", "v17", "glass", "notch", "neon", "tube", "bubble"].includes(rawNavStyle) ? rawNavStyle : "modern";
  const mobileNavEnabled = themeConfig?.mobile_nav_enabled ?? true;
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const s = window.scrollY > 50;
      setScrolled(s);
      document.documentElement.classList.toggle('v18-scrolled', s);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.documentElement.classList.remove('v18-scrolled');
    };
  }, []);

  const mobileNavComponent = mobileNavEnabled && themeConfig ? (
    <Suspense fallback={null}>
      <LazyMobileBottomNav store={store} variant={mobileNavStyle as NavVariant} />
    </Suspense>
  ) : undefined;

  return (
    <>
      <style>{`
        .v18-header-scroll { transition: background-color 0.3s ease, box-shadow 0.3s ease; position: fixed; top: 0; left: 0; right: 0; z-index: 40; }
        .v18-header-transparent { background-color: transparent; backdrop-filter: none; -webkit-backdrop-filter: none; color: #fff; border-color: transparent; box-shadow: none; }
        .v18-header-solid { background-color: rgba(10,10,10,0.92); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); color: #fff; border-color: transparent; box-shadow: 0 1px 8px rgba(0,0,0,0.4); }
        .v18-header-transparent button, .v18-header-transparent a, .v18-header-transparent svg,
        .v18-header-solid button, .v18-header-solid a, .v18-header-solid svg { color: #fff; stroke: #fff; }
        .storefront-font .smart-header { position: fixed; top: 0; left: 0; right: 0; z-index: 40; }
        .storefront-font .smart-header button, .storefront-font .smart-header a, .storefront-font .smart-header svg { color: #fff; stroke: #fff; }
        .storefront-font main { padding-top: 0; }
        .storefront-font .smart-header + main { padding-top: 3.5rem; }
        .v18-hero-pull { margin-top: -3.5rem; }
        .storefront-font nav[class*="bottom-nav"], .storefront-font div[class*="bottom-nav"], .storefront-font .fixed.bottom-0 { background-color: #0a0a0a !important; border-color: rgba(255,255,255,0.1) !important; }
        .storefront-font nav[class*="bottom-nav"] svg, .storefront-font div[class*="bottom-nav"] svg, .storefront-font .fixed.bottom-0 svg { color: #ffffff !important; stroke: #ffffff !important; }
        .storefront-font nav[class*="bottom-nav"] span, .storefront-font div[class*="bottom-nav"] span, .storefront-font .fixed.bottom-0 span { color: #ffffff !important; }
        .storefront-font nav[class*="bottom-nav"] a, .storefront-font div[class*="bottom-nav"] a, .storefront-font .fixed.bottom-0 a { color: #ffffff !important; }
        .storefront-font nav[class*="bottom-nav"] button, .storefront-font div[class*="bottom-nav"] button, .storefront-font .fixed.bottom-0 button { color: #ffffff !important; }
        .storefront-font nav[class*="bottom-nav"] [class*="rounded-full"], .storefront-font div[class*="bottom-nav"] [class*="rounded-full"] { --storefront-bg: #0a0a0a; }
        .storefront-font nav[class*="bottom-nav"] .pointer-events-auto > div { background-color: #1a1a1a !important; border-color: rgba(255,255,255,0.15) !important; }
      `}</style>
      <CheckoutAwareLayout
        store={store}
        marquee={
          (themeConfig?.marquee_enabled ?? false) ? (
            <StorefrontMarquee text={themeConfig?.marquee_text} />
          ) : undefined
        }
        headerLogoAlignment={themeConfig?.header_logo_alignment || "center"}
        mobileNavEnabled={mobileNavEnabled}
        mobileNav={mobileNavComponent}
        headerStyle="transparent"
        headerClassName={`v18-header-scroll ${scrolled ? 'v18-header-solid' : 'v18-header-transparent'}`}
        useSearchInHeader
        customCartIcon={<V17CartBadge />}
        headerBgOverride="transparent"
        headerIconColor="#ffffff"
      />
    </>
  );
}

export default function StorefrontLayoutV18({ slugOverride }: { slugOverride?: string } = {}) {
  return (
    <StorefrontShell
      slugOverride={slugOverride}
      showWhatsApp={false}
      defaultPrimary="#ffffff"
      defaultButtonRadius="0"
      wrapperClassName="storefront-font min-h-screen font-sans overflow-x-hidden"
      wrapperStyle={{
        backgroundColor: "#0a0a0a",
        color: "#f5f5f5",
        "--storefront-text": "#f5f5f5",
        "--storefront-bg": "#0a0a0a",
        "--storefront-btn-text": "#0a0a0a",
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
      {({ store, themeConfig }) => <V18Inner store={store} themeConfig={themeConfig} />}
    </StorefrontShell>
  );
}
