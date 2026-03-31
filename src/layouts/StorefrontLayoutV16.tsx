/**
 * Theme 16 — Classic + Quick Buy with Modern Premium Header
 *
 * Uses a custom cinematic-style header (pill nav, centered logo with lines)
 * instead of the shared CheckoutAwareLayout header.
 */
import { Suspense, lazy, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import StorefrontMarquee from "@/components/storefront/StorefrontMarquee";
import ClassicStorefrontSkeleton from "@/components/storefront/ClassicStorefrontSkeleton";
import StorefrontShell from "@/layouts/StorefrontShell";
import Theme16Header from "@/components/storefront/Theme16Header";
import { StorefrontContentSkeleton } from "@/components/ContentSkeleton";

const LazyMobileBottomNav = lazy(() => import("@/components/storefront/MobileBottomNav"));
const LazyMobileBottomNavModern = lazy(() => import("@/components/storefront/MobileBottomNavModern"));
const LazyStorefrontFooter = lazy(() => import("@/components/storefront/StorefrontFooter"));
const LazyCheckoutExitDialog = lazy(() => import("@/components/storefront/CheckoutExitDialog"));

export default function StorefrontLayoutV16({ slugOverride }: { slugOverride?: string } = {}) {
  return (
    <StorefrontShell
      slugOverride={slugOverride}
      showExitIntent
      skeleton={<ClassicStorefrontSkeleton />}
    >
      {({ store, themeConfig }) => {
        const mobileNavStyle = (themeConfig as any)?.mobile_nav_style || "classic";
        const mobileNavEnabled = themeConfig?.mobile_nav_enabled ?? true;
        const marqueeEnabled = themeConfig?.marquee_enabled ?? true;

        return <Theme16Inner
          store={store}
          mobileNavStyle={mobileNavStyle}
          mobileNavEnabled={mobileNavEnabled}
          marqueeEnabled={marqueeEnabled}
          marqueeText={themeConfig?.marquee_text}
        />;
      }}
    </StorefrontShell>
  );
}

function Theme16Inner({
  store,
  mobileNavStyle,
  mobileNavEnabled,
  marqueeEnabled,
  marqueeText,
}: {
  store: any;
  mobileNavStyle: string;
  mobileNavEnabled: boolean;
  marqueeEnabled: boolean;
  marqueeText?: string;
}) {
  const location = useLocation();
  const isCheckout = location.pathname.includes("/checkout");
  const [orderPlaced, setOrderPlaced] = useState(false);

  useEffect(() => {
    const handler = () => setOrderPlaced(true);
    window.addEventListener("order-placed", handler);
    return () => window.removeEventListener("order-placed", handler);
  }, []);

  useEffect(() => { if (!isCheckout) setOrderPlaced(false); }, [isCheckout]);

  useEffect(() => {
    const timer = setTimeout(() => {
      import("@/lib/prefetchStorefrontRoutes").then(m => m.prefetchStorefrontRoutes());
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      {!isCheckout && marqueeEnabled && <StorefrontMarquee text={marqueeText} />}

      <Theme16Header store={store} onOrderPlaced={orderPlaced} />

      <main className={mobileNavEnabled ? "pb-14 sm:pb-0" : ""}>
        <Suspense fallback={<StorefrontContentSkeleton />}>
          <Outlet context={store} />
        </Suspense>
      </main>

      {mobileNavEnabled && !isCheckout && (
        <Suspense fallback={null}>
          {mobileNavStyle === "modern"
            ? <LazyMobileBottomNavModern store={store} />
            : <LazyMobileBottomNav store={store} />
          }
        </Suspense>
      )}

      <Suspense fallback={null}><LazyStorefrontFooter store={store} /></Suspense>
    </>
  );
}
