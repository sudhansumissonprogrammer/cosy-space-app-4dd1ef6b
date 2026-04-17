import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { StorefrontContentSkeleton } from "@/components/ContentSkeleton";
import StorefrontShell from "@/layouts/StorefrontShell";
import DesktopNavBar from "@/components/storefront/DesktopNavBar";
import { ElegantHeader, ElegantTabBar, ElegantFooter } from "@/components/storefront/ElegantComponents";

const V12_COLORS = {
  defaultPrimary: "#FF3F6C",
  defaultBg: "#ffffff",
  defaultText: "#1a1a1a",
  defaultAccent: "#111111",
  headingFontFallback: "Poppins",
  bodyFontFallback: "Inter",
};

export default function StorefrontLayoutV12({ slugOverride }: { slugOverride?: string } = {}) {
  return (
    <StorefrontShell
      slugOverride={slugOverride}
      defaultPrimary="#FF3F6C"
      wrapperClassName="storefront-font min-h-screen overflow-x-hidden"
      wrapperStyle={{ "--storefront-bottom-nav-height": "64px", fontFamily: "var(--storefront-body-font, 'Inter'), sans-serif", backgroundColor: "var(--storefront-bg, #ffffff)", color: "var(--storefront-text, #1a1a1a)" } as React.CSSProperties}
    >
      {({ store }) => (
        <>
          <DesktopNavBar store={store} />
          <div className="md:hidden"><ElegantHeader store={store} colors={V12_COLORS} /></div>
          <main className="pb-16 md:pb-0">
            <Suspense fallback={<StorefrontContentSkeleton />}><Outlet context={store} /></Suspense>
          </main>
          <ElegantFooter store={store} colors={V12_COLORS} />
          <ElegantTabBar store={store} colors={V12_COLORS} />
        </>
      )}
    </StorefrontShell>
  );
}
