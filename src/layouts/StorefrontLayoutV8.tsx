import { useState, Suspense } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ShoppingCart, Heart, User, Search, Menu, Home, LayoutGrid } from "lucide-react";
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

function MobileAppHeader({ store }: { store: StoreData }) {
  const { cartCount, openCart } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const queryClient = useQueryClient();
  const categories = queryClient.getQueryData<any[]>(["storefront-categories", store.id]);
  const products = queryClient.getQueryData<any[]>(["storefront-products", store.id]);
  const slug = store.slug;

  return (
    <>
      <header className="sticky top-0 z-40 border-b backdrop-blur-md" style={{ backgroundColor: "var(--storefront-bg, hsl(var(--background)))ee", borderColor: "var(--storefront-text, hsl(var(--foreground)))08" }}>
        <div className="flex items-center gap-2 px-3 py-2">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <button className="flex h-9 w-9 items-center justify-center rounded-2xl transition-all active:scale-95" style={{ backgroundColor: "var(--storefront-primary, hsl(var(--primary)))10" }} aria-label="Open menu">
                <Menu className="h-5 w-5" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }} aria-hidden="true" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="storefront-font w-[280px] p-0">
              <div className="flex flex-col">
                <div className="border-b bg-card p-4">
                  {store.logo_url ? <img src={store.logo_url} alt={store.name} className="h-10 w-auto max-w-[160px] object-contain" /> : <span className="text-lg font-bold text-foreground">{store.name}</span>}
                </div>
                <nav className="flex flex-col gap-1 p-4">
                  {[{ to: storefrontPath(slug), label: "Home" }, { to: storefrontPath(slug, "account"), label: "My Account" }, { to: storefrontPath(slug, "wishlist"), label: "Wishlist" }, { to: storefrontPath(slug, "contact"), label: "Contact Us" }, { to: storefrontPath(slug, "return-policy"), label: "Return Policy" }].map((link) => (
                    <Link key={link.to} to={link.to} onClick={() => setMenuOpen(false)} className="rounded-2xl px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent">{link.label}</Link>
                  ))}
                  {categories && categories.length > 0 && (
                    <>
                      <div className="mt-3 mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Categories</div>
                      {categories.map((cat: any) => (<Link key={cat.id} to={storefrontPath(slug, `category/${cat.slug}`)} onClick={() => setMenuOpen(false)} className="rounded-2xl px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent">{cat.name}</Link>))}
                    </>
                  )}
                </nav>
              </div>
            </SheetContent>
          </Sheet>

          <button onClick={() => setSearchOpen(true)} className="flex flex-1 items-center gap-2 rounded-full px-4 py-2 text-sm transition-all active:scale-[0.98]" style={{ backgroundColor: "var(--storefront-text, hsl(var(--foreground)))06", border: "1.5px solid var(--storefront-text, hsl(var(--foreground)))10" }} aria-label="Search products">
            <Search className="h-4 w-4 shrink-0" style={{ color: "var(--storefront-text, hsl(var(--foreground)))40" }} aria-hidden="true" />
            <span style={{ color: "var(--storefront-text, hsl(var(--foreground)))35" }}>Search products...</span>
          </button>

          <button onClick={openCart} className="relative flex h-9 w-9 items-center justify-center rounded-2xl transition-all active:scale-95" style={{ backgroundColor: "var(--storefront-primary, hsl(var(--primary)))10" }} aria-label={`Shopping cart${cartCount > 0 ? `, ${cartCount} items` : ''}`}>
            <ShoppingCart className="h-5 w-5" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }} aria-hidden="true" />
            {cartCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold" style={{ backgroundColor: "var(--storefront-primary, hsl(var(--foreground)))", color: "var(--storefront-btn-text, hsl(var(--background)))" }}>{cartCount > 99 ? "99+" : cartCount}</span>
            )}
          </button>
        </div>
      </header>
      <StorefrontSearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} products={products} slug={slug} initialFiltersOpen={false} />
    </>
  );
}

function BottomTabBar({ store }: { store: StoreData }) {
  const location = useLocation();
  const { wishlistCount } = useWishlist();
  const { user } = useStorefrontAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const queryClient = useQueryClient();
  const products = queryClient.getQueryData<any[]>(["storefront-products", store.id]);

  const basePath = storefrontPath(store.slug);
  const tabs = [
    { icon: Home, label: "Home", to: basePath, matchExact: true },
    { icon: LayoutGrid, label: "Categories", to: storefrontPath(store.slug, "shop"), match: "shop" },
    { icon: Search, label: "Search", to: "__search__", match: "__never__" },
    { icon: Heart, label: "Wishlist", to: storefrontPath(store.slug, "wishlist"), match: "wishlist", badge: wishlistCount },
    { icon: User, label: "Profile", to: storefrontPath(store.slug, user ? "account" : "login"), match: "account" },
  ];

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t md:hidden" style={{ backgroundColor: "var(--storefront-bg, hsl(var(--background)))f8", borderColor: "var(--storefront-text, hsl(var(--foreground)))08", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
        <div className="flex items-center justify-around px-2" style={{ paddingBottom: "env(safe-area-inset-bottom)", minHeight: "60px" }}>
          {tabs.map((tab) => {
            const isActive = tab.matchExact ? location.pathname === basePath || location.pathname === basePath + "/" : location.pathname.includes(tab.match!);
            const TabIcon = tab.icon;
            const isSearch = tab.to === "__search__";
            return isSearch ? (
              <button key={tab.label} onClick={() => setSearchOpen(true)} className="flex flex-col items-center justify-center gap-0.5 py-1.5 px-3 transition-all relative" style={{ minWidth: "48px" }}>
                <div className="relative"><div className="flex items-center justify-center rounded-2xl transition-all" style={{ width: "36px", height: "28px" }}><TabIcon className="h-[18px] w-[18px] transition-colors" style={{ color: "var(--storefront-text, hsl(var(--foreground)))50" }} /></div></div>
                <span className="text-[10px] font-semibold" style={{ color: "var(--storefront-text, hsl(var(--foreground)))45" }}>{tab.label}</span>
              </button>
            ) : (
              <Link key={tab.label} to={tab.to} className="flex flex-col items-center justify-center gap-0.5 py-1.5 px-3 transition-all relative" style={{ minWidth: "48px" }}>
                {isActive && <div className="absolute -top-0 left-1/2 -translate-x-1/2 h-[3px] w-8 rounded-full" style={{ backgroundColor: "var(--storefront-primary, hsl(var(--primary)))" }} />}
                <div className="relative">
                  <div className="flex items-center justify-center rounded-2xl transition-all" style={{ width: "36px", height: "28px", backgroundColor: isActive ? "var(--storefront-primary, hsl(var(--primary)))15" : "transparent" }}>
                    <TabIcon className="h-[18px] w-[18px] transition-colors" style={{ color: isActive ? "var(--storefront-primary, hsl(var(--primary)))" : "var(--storefront-text, hsl(var(--foreground)))50" }} />
                  </div>
                  {tab.badge && tab.badge > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold" style={{ backgroundColor: "var(--storefront-primary, hsl(var(--primary)))", color: "var(--storefront-btn-text, #fff)" }}>{tab.badge > 9 ? "9+" : tab.badge}</span>
                  )}
                </div>
                <span className="text-[10px] font-semibold" style={{ color: isActive ? "var(--storefront-primary, hsl(var(--primary)))" : "var(--storefront-text, hsl(var(--foreground)))45" }}>{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
      <StorefrontSearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} products={products} slug={store.slug} initialFiltersOpen={false} />
    </>
  );
}

function StorefrontV8Skeleton() {
  return (
    <div className="min-h-screen bg-background font-sans">
      <div className="sticky top-0 z-30 border-b bg-card px-3 py-2"><div className="flex items-center gap-2"><Skeleton className="h-9 w-9 rounded-2xl" /><Skeleton className="h-9 flex-1 rounded-full" /><Skeleton className="h-9 w-9 rounded-2xl" /></div></div>
      <div className="p-4"><Skeleton className="h-44 w-full rounded-2xl" /></div>
      <div className="px-4 flex gap-4">{Array.from({ length: 5 }).map((_, i) => (<div key={i} className="flex flex-col items-center gap-1.5"><Skeleton className="h-14 w-14 rounded-full" /><Skeleton className="h-2 w-10" /></div>))}</div>
      <div className="px-4 pt-4"><div className="grid grid-cols-2 gap-3">{Array.from({ length: 4 }).map((_, i) => (<Skeleton key={i} className="h-60 rounded-2xl" />))}</div></div>
    </div>
  );
}

export default function StorefrontLayoutV8({ slugOverride }: { slugOverride?: string } = {}) {
  return (
    <StorefrontShell
      slugOverride={slugOverride}
      defaultPrimary="#6C5CE7"
      defaultButtonRadius="1rem"
      wrapperStyle={{ "--storefront-bottom-nav-height": "72px" } as React.CSSProperties}
      skeleton={<StorefrontV8Skeleton />}
    >
      {({ store }) => (
        <>
          <MobileAppHeader store={store} />
          <main className="pb-20 md:pb-0">
            <Suspense fallback={<StorefrontContentSkeleton />}><Outlet context={store} /></Suspense>
          </main>
          <div className="hidden md:block"><StorefrontFooter store={store} /></div>
          <BottomTabBar store={store} />
        </>
      )}
    </StorefrontShell>
  );
}
