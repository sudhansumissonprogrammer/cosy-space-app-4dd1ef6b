import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { StorefrontContentSkeleton } from "@/components/ContentSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
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

function StorefrontV12Skeleton() {
  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 z-30 px-4 py-3 flex items-center justify-between bg-white"><Skeleton className="h-10 w-10 rounded-md" /><Skeleton className="h-8 w-28" /><div className="flex gap-1"><Skeleton className="h-10 w-10 rounded-md" /><Skeleton className="h-10 w-10 rounded-md" /></div></div>
      <Skeleton className="h-[400px] w-full" />
      <div className="px-4 py-4 flex gap-4">{Array.from({ length: 5 }).map((_, i) => (<div key={i} className="flex flex-col items-center gap-2 flex-shrink-0"><Skeleton className="h-[72px] w-[72px] rounded-full" /><Skeleton className="h-3 w-14" /></div>))}</div>
      <div className="px-4 grid grid-cols-2 gap-3">{Array.from({ length: 4 }).map((_, i) => (<Skeleton key={i} className="h-72 rounded-lg" />))}</div>
    </div>
  );
}

export default function StorefrontLayoutV12({ slugOverride }: { slugOverride?: string } = {}) {
  return (
    <StorefrontShell
      slugOverride={slugOverride}
      defaultPrimary="#FF3F6C"
      wrapperClassName="storefront-font min-h-screen overflow-x-hidden"
      wrapperStyle={{ "--storefront-bottom-nav-height": "64px", fontFamily: "var(--storefront-body-font, 'Inter'), sans-serif", backgroundColor: "var(--storefront-bg, #ffffff)", color: "var(--storefront-text, #1a1a1a)" } as React.CSSProperties}
      skeleton={<StorefrontV12Skeleton />}
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
