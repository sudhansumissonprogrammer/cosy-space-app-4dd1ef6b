import { Suspense } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Store, ShoppingCart, Heart, User, Home } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
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

function ShoppingAppBottomNav({ store }: { store: StoreData }) {
  const location = useLocation();
  const { cartCount, openCart } = useCart();
  const { user } = useStorefrontAuth();
  const basePath = storefrontPath(store.slug);
  const isHome = location.pathname === basePath || location.pathname === basePath + "/";
  const isShop = location.pathname.includes("shop");
  const isWishlist = location.pathname.includes("wishlist");
  const isAccount = location.pathname.includes("account");

  const navItems = [
    { icon: Home, label: "Home", isActive: isHome, to: basePath },
    { icon: Store, label: "Shop", isActive: isShop, to: storefrontPath(store.slug, "shop") },
    { icon: Heart, label: "Wishlist", isActive: isWishlist, to: storefrontPath(store.slug, "wishlist") },
    { icon: User, label: "Account", isActive: isAccount, to: storefrontPath(store.slug, user ? "account" : "login") },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="mx-3 mb-2 flex items-center gap-2">
        <div className="flex flex-1 items-center justify-around rounded-[28px] px-1.5 py-2" style={{ backgroundColor: "var(--storefront-bg, hsl(var(--background)))", boxShadow: "0 2px 20px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)" }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.label} to={item.to} className="relative flex items-center justify-center rounded-full px-3 py-2.5 transition-all duration-500 ease-in-out active:scale-95">
                <div className="absolute inset-0 rounded-full transition-all duration-500 ease-in-out" style={{ backgroundColor: item.isActive ? "var(--storefront-text, hsl(var(--foreground)))" : "transparent", opacity: item.isActive ? 1 : 0 }} />
                <Icon className="relative z-10 h-[22px] w-[22px] transition-colors duration-500 ease-in-out" style={{ color: item.isActive ? "var(--storefront-bg, hsl(var(--background)))" : "var(--storefront-text, hsl(var(--foreground)))45" }} strokeWidth={1.8} fill={item.isActive ? "var(--storefront-bg, hsl(var(--background)))" : "none"} />
                <span className="relative z-10 text-xs font-semibold overflow-hidden transition-all duration-500 ease-in-out" style={{ color: item.isActive ? "var(--storefront-bg, hsl(var(--background)))" : "transparent", maxWidth: item.isActive ? "80px" : "0px", opacity: item.isActive ? 1 : 0, marginLeft: item.isActive ? "6px" : "0px" }}>{item.label}</span>
              </Link>
            );
          })}
        </div>
        <button onClick={openCart} className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95" style={{ backgroundColor: "var(--storefront-bg, hsl(var(--background)))", boxShadow: "0 2px 20px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)" }}>
          <ShoppingCart className="h-[22px] w-[22px]" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }} strokeWidth={1.8} />
          {cartCount > 0 && <span className="absolute -right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold" style={{ backgroundColor: "#EF4444", color: "#fff" }}>{cartCount > 9 ? "9+" : cartCount}</span>}
        </button>
      </div>
    </nav>
  );
}

function StorefrontV11Skeleton() {
  return (
    <div className="min-h-screen bg-background font-sans">
      <div className="sticky top-0 z-30 border-b bg-card px-3 py-2.5"><div className="flex items-center gap-2"><Skeleton className="h-9 w-9 rounded-xl" /><Skeleton className="h-9 flex-1 rounded-full" /><Skeleton className="h-9 w-9 rounded-xl" /></div></div>
      <div className="px-3 py-3"><Skeleton className="h-40 w-full rounded-2xl" /></div>
      <div className="px-3"><div className="grid grid-cols-2 gap-3">{Array.from({ length: 6 }).map((_, i) => (<Skeleton key={i} className="h-56 rounded-2xl" />))}</div></div>
    </div>
  );
}

export default function StorefrontLayoutV11({ slugOverride }: { slugOverride?: string } = {}) {
  return (
    <StorefrontShell
      slugOverride={slugOverride}
      defaultPrimary="#3B82F6"
      defaultButtonRadius="0.75rem"
      wrapperStyle={{ "--storefront-bottom-nav-height": "80px" } as React.CSSProperties}
      skeleton={<StorefrontV11Skeleton />}
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
          <ShoppingAppBottomNav store={store} />
        </>
      )}
    </StorefrontShell>
  );
}
