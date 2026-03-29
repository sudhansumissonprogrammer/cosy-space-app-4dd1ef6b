import { useState, Suspense } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Store, ShoppingCart, Heart, User, Search, Menu, Home, Grid3X3, X } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { useStorefrontAuth } from "@/contexts/StorefrontAuthContext";
import StorefrontFooter from "@/components/storefront/StorefrontFooter";
import StorefrontSearchOverlay from "@/components/storefront/StorefrontSearchOverlay";
import { StorefrontContentSkeleton } from "@/components/ContentSkeleton";
import { storefrontPath } from "@/lib/subdomain";
import { Skeleton } from "@/components/ui/skeleton";
import StorefrontShell from "@/layouts/StorefrontShell";
import type { StoreData } from "@/layouts/StorefrontLayout";

function AppHeader({ store }: { store: StoreData }) {
  const { cartCount, openCart } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const queryClient = useQueryClient();
  const categories = queryClient.getQueryData<any[]>(["storefront-categories", store.id]);
  const products = queryClient.getQueryData<any[]>(["storefront-products", store.id]);
  const customPages = queryClient.getQueryData<any[]>(["storefront-custom-pages", store.id]) ?? [];

  return (
    <>
    <header className="sticky top-0 z-30 border-b" style={{ backgroundColor: "var(--storefront-bg, hsl(var(--background)))", borderColor: "var(--storefront-text, hsl(var(--foreground)))10" }}>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <button className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors" style={{ backgroundColor: "var(--storefront-primary, hsl(var(--primary)))10" }} aria-label="Open menu">
              <Menu className="h-5 w-5" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }} aria-hidden="true" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="storefront-font w-[280px] p-0">
            <div className="flex flex-col">
              <div className="border-b bg-card p-4">
                {store.logo_url ? (
                  <img src={store.logo_url} alt={store.name} className="h-10 w-auto max-w-[160px] object-contain" />
                ) : (
                  <span className="text-lg font-bold text-foreground">{store.name}</span>
                )}
              </div>
              <nav className="flex flex-col gap-1 p-4">
                {[
                  { to: storefrontPath(store.slug), label: "Home" },
                  { to: storefrontPath(store.slug, "shop"), label: "Shop All" },
                  { to: storefrontPath(store.slug, "about"), label: "About Us" },
                  { to: storefrontPath(store.slug, "contact"), label: "Contact Us" },
                  { to: storefrontPath(store.slug, "wishlist"), label: "Wishlist" },
                  { to: storefrontPath(store.slug, "account"), label: "My Account" },
                ].map((link) => (
                  <Link key={link.to} to={link.to} onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent">
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>
          </SheetContent>
        </Sheet>

        {/* Store Logo / Name */}
        <Link to={storefrontPath(store.slug)} className="flex items-center gap-2 flex-1 min-w-0">
          {store.logo_url ? (
            <img src={store.logo_url} alt={store.name} className="h-8 w-auto max-w-[120px] object-contain" />
          ) : (
            <span className="text-base font-bold truncate" style={{ color: "var(--storefront-text, hsl(var(--foreground)))", fontFamily: "var(--storefront-heading-font, inherit)" }}>{store.name}</span>
          )}
        </Link>

        <button
          onClick={() => setSearchOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors"
          style={{ backgroundColor: "var(--storefront-primary, hsl(var(--primary)))10" }}
          aria-label="Search products"
        >
          <Search className="h-5 w-5" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }} aria-hidden="true" />
        </button>

        <button onClick={openCart} className="relative flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: "var(--storefront-primary, hsl(var(--primary)))10" }} aria-label={`Shopping cart${cartCount > 0 ? `, ${cartCount} items` : ''}`}>
          <ShoppingCart className="h-5 w-5" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }} aria-hidden="true" />
          {cartCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold" style={{ backgroundColor: "var(--storefront-primary, hsl(var(--foreground)))", color: "var(--storefront-btn-text, hsl(var(--background)))" }}>
              {cartCount > 99 ? "99+" : cartCount}
            </span>
          )}
        </button>
      </div>
    </header>
    <StorefrontSearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} products={products} slug={store.slug} initialFiltersOpen={false} />
    </>
  );
}

function BottomTabBar({ store }: { store: StoreData }) {
  const location = useLocation();
  const _ = useWishlist(); // keep provider active
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
              <span className="text-[10px] font-medium" style={{ color: isActive ? "var(--storefront-primary, hsl(var(--primary)))" : "var(--storefront-text, hsl(var(--foreground)))50" }}>{tab.label}</span>
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
          <AppHeader store={store} />
          <main className="pb-20 md:pb-0">
            <Suspense fallback={<StorefrontContentSkeleton />}><Outlet context={store} /></Suspense>
          </main>
          <div className="pb-20 md:pb-0"><StorefrontFooter store={store} /></div>
          <BottomTabBar store={store} />
        </>
      )}
    </StorefrontShell>
  );
}
