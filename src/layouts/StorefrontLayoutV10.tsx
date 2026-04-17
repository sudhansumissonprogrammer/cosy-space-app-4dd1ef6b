import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { StorefrontContentSkeleton } from "@/components/ContentSkeleton";
import StorefrontShell from "@/layouts/StorefrontShell";
import DesktopNavBar from "@/components/storefront/DesktopNavBar";
import { ElegantHeader, ElegantTabBar, ElegantFooter } from "@/components/storefront/ElegantComponents";

const V10_COLORS = {
  defaultPrimary: "#1a1a1a",
  defaultBg: "#f7f5f0",
  defaultText: "#1a1a1a",
  defaultAccent: "#3d1c28",
  headingFontFallback: "Alegreya SC",
  bodyFontFallback: "Inter",
};

export default function StorefrontLayoutV10({ slugOverride }: { slugOverride?: string } = {}) {
  return (
    <StorefrontShell
      slugOverride={slugOverride}
      defaultPrimary="#1a1a1a"
      wrapperClassName="storefront-font min-h-screen overflow-x-hidden"
      wrapperStyle={{ "--storefront-bottom-nav-height": "64px", fontFamily: "var(--storefront-body-font, 'Inter'), sans-serif", backgroundColor: "var(--storefront-bg, #f7f5f0)", color: "var(--storefront-text, #1a1a1a)" } as React.CSSProperties}
    >
      {({ store }) => (
        <>
          <DesktopNavBar store={store} />
          <div className="md:hidden"><ElegantHeader store={store} colors={V10_COLORS} /></div>
          <main className="pb-16 md:pb-0">
            <Suspense fallback={<StorefrontContentSkeleton />}><Outlet context={store} /></Suspense>
          </main>
          <ElegantFooter store={store} colors={V10_COLORS} />
          <ElegantTabBar store={store} colors={V10_COLORS} useTextForActive />
        </>
      )}
    </StorefrontShell>
  );
}
