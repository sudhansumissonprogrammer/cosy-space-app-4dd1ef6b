import { Suspense } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Store, ShoppingCart, Heart, User, Home, Grid3X3 } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { useStorefrontAuth } from "@/contexts/StorefrontAuthContext";
import StorefrontFooter from "@/components/storefront/StorefrontFooter";
import MobileAppHeader from "@/components/storefront/MobileAppHeader";
import { StorefrontContentSkeleton } from "@/components/ContentSkeleton";
import { storefrontPath } from "@/lib/subdomain";
import { Skeleton } from "@/components/ui/skeleton";
import StorefrontShell from "@/layouts/StorefrontShell";
import DesktopNavBar from "@/components/storefront/DesktopNavBar";
import type { StoreData } from "@/layouts/StorefrontLayout";
import ScrollProgressBar from "@/components/storefront/ScrollProgressBar";

function BottomTabBar({ store }: { store: StoreData }) {
  const location = useLocation();
  const _ = useWishlist();
  const { user } = useStorefrontAuth();

  const basePath = storefrontPath(store.slug);
  const tabs = [
    { icon: Home, label: "Home", to: basePath, match: basePath },
    { icon: Grid3X3, label: "Categories", to: storefrontPath(store.slug, "categories"), match: "categories" },
    { icon: Store, label: "Shop", to: storefrontPath(store.slug, "shop"), match: "shop" },
    { icon: Heart, label: "Wishlist", to: storefrontPath(store.slug, "wishlist"), match: "wishlist" },
    { icon: User, label: "Profile", to: storefrontPath(store.slug, user ? "account" : "login"), match: "account" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t md:hidden" style={{ backgroundColor: "var(--storefront-bg, hsl(var(--background)))", borderColor: "var(--storefront-text, hsl(var(--foreground)))10" }}>
      <div className="flex items-center justify-around px-1 pb-[env(safe-area-inset-bottom)]" style={{ minHeight: "56px" }}>
        {tabs.map((tab) => {
          const isActive = tab.match === basePath ? location.pathname === basePath || location.pathname === basePath + "/" : location.pathname.includes(tab.match);
          const TabIcon = tab.icon;
          return (
            <Link key={tab.label} to={tab.to} className="flex flex-col items-center justify-center gap-0.5 py-2 px-3 transition-colors relative" style={{ minWidth: "48px" }}>
              <div className="flex items-center justify-center" style={{ width: "24px", height: "24px" }}>
                <TabIcon className="h-5 w-5 transition-colors" style={{ color: isActive ? "var(--storefront-primary, hsl(var(--primary)))" : "var(--storefront-text, hsl(var(--foreground)))60" }} />
              </div>
              <span className="text-[11px] font-medium" style={{ color: isActive ? "var(--storefront-primary, hsl(var(--primary)))" : "var(--storefront-text, hsl(var(--foreground)))50" }}>{tab.label}</span>
              {isActive && <div className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-6 rounded-full" style={{ backgroundColor: "var(--storefront-primary, hsl(var(--primary)))" }} />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function StorefrontV3Skeleton() {
  return (
    <div className="min-h-screen bg-background font-sans">
      <div className="sticky top-0 z-30 border-b bg-card px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <Skeleton className="h-9 flex-1 rounded-full" />
          <Skeleton className="h-9 w-9 rounded-xl" />
        </div>
      </div>
      <div className="px-3 py-3"><Skeleton className="h-40 w-full rounded-2xl" /></div>
      <div className="px-3">
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (<Skeleton key={i} className="h-56 rounded-2xl" />))}
        </div>
      </div>
    </div>
  );
}

export default function StorefrontLayoutV3({ slugOverride }: { slugOverride?: string } = {}) {
  return (
    <StorefrontShell
      slugOverride={slugOverride}
      defaultPrimary="#3B82F6"
      defaultButtonRadius="0.75rem"
      wrapperStyle={{ "--storefront-bottom-nav-height": "56px" } as React.CSSProperties}
      wrapperClassName="storefront-font min-h-screen font-sans theme-v3-wa-fix"
      skeleton={<StorefrontV3Skeleton />}
    >
      {({ store }) => (
        <>
          <ScrollProgressBar />
          <DesktopNavBar store={store} />
          <div className="md:hidden"><MobileAppHeader store={store} /></div>
          <main className="pb-24 md:pb-0">
            <Suspense fallback={<StorefrontContentSkeleton />}><Outlet context={store} /></Suspense>
          </main>
          <div className="pb-24 md:pb-0"><StorefrontFooter store={store} /></div>
          <BottomTabBar store={store} />
        </>
      )}
    </StorefrontShell>
  );
}
