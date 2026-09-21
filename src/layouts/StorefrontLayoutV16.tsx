/**
 * Theme 16 — Exact duplicate of Theme 1 (Classic).
 * Only difference: Buy Now triggers a phone-collection modal before checkout.
 */
import { Suspense, lazy, useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import "@/styles/sf-dark.css";
import { applySfDarkClass, readSfDark, removeSfDarkOverlays } from "@/lib/sfDarkMode";
import StorefrontMarquee from "@/components/storefront/StorefrontMarquee";
import CheckoutAwareLayout from "@/components/storefront/CheckoutAwareLayout";
import StorefrontShell from "@/layouts/StorefrontShell";

const LazyMobileBottomNav = lazy(() => import("@/components/storefront/MobileBottomNavSwitcher"));

const VALID_NAV_STYLES = ["classic", "modern", "v15", "v17", "glass", "notch", "neon", "tube", "bubble", "skeuo3d", "indicator", "wave"] as const;
type NavVariant = typeof VALID_NAV_STYLES[number];

export default function StorefrontLayoutV16({ slugOverride }: { slugOverride?: string } = {}) {
  // Restore the shopper's night-mode choice before the storefront paints, and
  // keep it off on checkout (which must stay pixel-identical to today).
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    // A route change mid-animation would strand the body-level overlay on top
    // of the new page (it eats clicks until the watchdog fires) — drop it.
    removeSfDarkOverlays();
    applySfDarkClass(readSfDark() && !pathname.includes("/checkout"));
    return () => applySfDarkClass(false);
  }, [pathname]);

  return (
    <StorefrontShell
      slugOverride={slugOverride}
      showExitIntent
    >
      {({ store, themeConfig }) => {
        const rawNavStyle = (themeConfig as any)?.mobile_nav_style || "classic";
        const mobileNavStyle = VALID_NAV_STYLES.includes(rawNavStyle) ? rawNavStyle : "classic";
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
                  <LazyMobileBottomNav store={store} variant={mobileNavStyle as NavVariant} swapCartWhatsApp />
                </Suspense>
              ) : undefined
            }
            swapCartWhatsApp
            showDarkToggle
            fixedHeader
            darkToggleEffect={(themeConfig as any)?.dark_toggle_effect}
            showPremiumBadge={(themeConfig as any)?.show_premium_header_badge === true}
            headerStyle={themeConfig?.header_style || "normal"}
          />
        );
      }}
    </StorefrontShell>
  );
}
