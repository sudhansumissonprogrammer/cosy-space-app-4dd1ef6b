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

const LazyMobileBottomNav = lazy(() => import("@/components/storefront/MobileBottomNav"));
const LazyMobileBottomNavModern = lazy(() => import("@/components/storefront/MobileBottomNavModern"));
const LazyMobileBottomNavV15 = lazy(() => import("@/components/storefront/MobileBottomNavV15"));
const LazyMobileBottomNavV17 = lazy(() => import("@/components/storefront/MobileBottomNavV17"));

function V18Inner({ store, themeConfig }: { store: any; themeConfig: any }) {
  const mobileNavStyle = (themeConfig as any)?.mobile_nav_style || "modern";
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

  const mobileNavComponent = mobileNavEnabled ? (
    <Suspense fallback={null}>
      {mobileNavStyle === "v17" ? <LazyMobileBottomNavV17 store={store} /> :
       mobileNavStyle === "v15" ? <LazyMobileBottomNavV15 store={store} /> :
       mobileNavStyle === "modern" ? <LazyMobileBottomNavModern store={store} /> :
       <LazyMobileBottomNav store={store} />}
    </Suspense>
  ) : undefined;

  return (
    <>
      <style>{`
        .v18-header-scroll { transition: background-color 0.3s ease, box-shadow 0.3s ease; position: fixed !important; top: 0; left: 0; right: 0; z-index: 40; }
        .v18-header-transparent, .v18-header-solid { background-color: transparent !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important; color: #fff !important; border-color: transparent !important; box-shadow: none !important; }
        .v18-header-transparent button, .v18-header-transparent a, .v18-header-transparent svg,
        .v18-header-solid button, .v18-header-solid a, .v18-header-solid svg { color: #fff !important; stroke: #fff !important; }
        .storefront-font .smart-header { position: fixed !important; top: 0; left: 0; right: 0; z-index: 40; background-color: transparent !important; backdrop-filter: none !important; border-bottom: none !important; box-shadow: none !important; }
        .storefront-font .smart-header button, .storefront-font .smart-header a, .storefront-font .smart-header svg { color: #fff !important; stroke: #fff !important; }

        /* Mobile bottom nav — dark bg, pure white icons/text for Theme 18 */
        .storefront-font nav[class*="fixed bottom-0"] { background-color: #111 !important; border-top-color: #222 !important; }
        .storefront-font nav[class*="fixed bottom-0"] svg { color: #fff !important; fill: #fff !important; stroke: #fff !important; }
        .storefront-font nav[class*="fixed bottom-0"] span { color: #fff !important; }
        .storefront-font nav[class*="fixed bottom-0"] a, .storefront-font nav[class*="fixed bottom-0"] button { color: #fff !important; }
        .storefront-font nav[class*="fixed bottom-0"] div[class*="rounded-[28px]"] { background-color: #1a1a1a !important; border-color: #333 !important; }
        .storefront-font nav[class*="fixed bottom-0"] button[class*="rounded-full"][class*="w-[52px]"] { background-color: #fff !important; }
        .storefront-font nav[class*="fixed bottom-0"] button[class*="rounded-full"][class*="w-[52px]"] svg { color: #0a0a0a !important; stroke: #0a0a0a !important; }
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
      defaultPrimary="#ffffff"
      defaultButtonRadius="0"
      wrapperClassName="storefront-font min-h-screen font-sans"
      wrapperStyle={{
        backgroundColor: "#0a0a0a",
        color: "#f5f5f5",
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
