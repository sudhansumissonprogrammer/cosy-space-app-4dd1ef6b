import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { StorefrontContentSkeleton } from "@/components/ContentSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
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

function StorefrontV10Skeleton() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f7f5f0" }}>
      <div className="sticky top-0 z-30 px-4 py-3 flex items-center justify-between" style={{ backgroundColor: "#f7f5f0" }}>
        <Skeleton className="h-10 w-10 rounded-md" /><Skeleton className="h-8 w-28" /><div className="flex gap-1"><Skeleton className="h-10 w-10 rounded-md" /><Skeleton className="h-10 w-10 rounded-md" /></div>
      </div>
      <Skeleton className="h-[400px] w-full" />
      <div className="px-4 py-4 flex gap-4">{Array.from({ length: 5 }).map((_, i) => (<div key={i} className="flex flex-col items-center gap-2 flex-shrink-0"><Skeleton className="h-[72px] w-[72px] rounded-full" /><Skeleton className="h-3 w-14" /></div>))}</div>
      <div className="px-4 grid grid-cols-2 gap-3">{Array.from({ length: 4 }).map((_, i) => (<Skeleton key={i} className="h-72 rounded-lg" />))}</div>
    </div>
  );
}

export default function StorefrontLayoutV10({ slugOverride }: { slugOverride?: string } = {}) {
  return (
    <StorefrontShell
      slugOverride={slugOverride}
      defaultPrimary="#1a1a1a"
      wrapperClassName="storefront-font min-h-screen overflow-x-hidden"
      wrapperStyle={{ "--storefront-bottom-nav-height": "64px", fontFamily: "var(--storefront-body-font, 'Inter'), sans-serif", backgroundColor: "var(--storefront-bg, #f7f5f0)", color: "var(--storefront-text, #1a1a1a)" } as React.CSSProperties}
      skeleton={<StorefrontV10Skeleton />}
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
