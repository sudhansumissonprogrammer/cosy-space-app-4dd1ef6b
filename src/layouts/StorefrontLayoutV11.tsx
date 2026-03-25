import { useState, Suspense } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Store, ShoppingCart, Heart, Search, Menu, Home, Bell } from "lucide-react";
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
                {store.logo_url ? <img src={store.logo_url} alt={store.name} className="h-10 w-auto max-w-[160px] object-contain" /> : <span className="text-lg font-bold text-foreground">{store.name}</span>}
              </div>
              <nav className="flex flex-col gap-1 p-4">
                {[{ to: storefrontPath(store.slug), label: "Home" }, { to: storefrontPath(store.slug, "account"), label: "My Account" }, { to: storefrontPath(store.slug, "wishlist"), label: "Wishlist" }, { to: storefrontPath(store.slug, "contact"), label: "Contact Us" }, { to: storefrontPath(store.slug, "return-policy"), label: "Return Policy" }].map((link) => (
                  <Link key={link.to} to={link.to} onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent">{link.label}</Link>
                ))}
                {categories && categories.length > 0 && (
                  <>
                    <div className="mt-3 mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Categories</div>
                    {categories.map((cat: any) => (<Link key={cat.id} to={storefrontPath(store.slug, `category/${cat.slug}`)} onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent">{cat.name}</Link>))}
                  </>
                )}
              </nav>
            </div>
          </SheetContent>
        </Sheet>

        <Link to={storefrontPath(store.slug)} className="flex items-center shrink-0">
          {store.logo_url ? <img src={store.logo_url} alt={store.name} className="h-8 w-auto max-w-[120px] object-contain" /> : <span className="text-base font-bold" style={{ color: "var(--storefront-text, hsl(var(--foreground)))", fontFamily: "var(--storefront-heading-font, inherit)" }}>{store.name}</span>}
        </Link>

        <button onClick={() => setSearchOpen(true)} className="flex flex-1 items-center gap-2 rounded-full px-3.5 py-2 text-sm transition-all active:scale-[0.98]" style={{ backgroundColor: "var(--storefront-text, hsl(var(--foreground)))08", border: "1px solid var(--storefront-text, hsl(var(--foreground)))12" }} aria-label="Search products">
          <Search className="h-4 w-4 shrink-0" style={{ color: "var(--storefront-text, hsl(var(--foreground)))50" }} aria-hidden="true" />
          <span style={{ color: "var(--storefront-text, hsl(var(--foreground)))40" }}>Search products...</span>
        </button>
      </div>
    </header>
    <StorefrontSearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} products={products} slug={store.slug} initialFiltersOpen={false} />
    </>
  );
}

function ShoppingAppBottomNav({ store }: { store: StoreData }) {
  const location = useLocation();
  const { wishlistCount } = useWishlist();
  const { cartCount, openCart } = useCart();
  const { user } = useStorefrontAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const queryClient = useQueryClient();
  const products = queryClient.getQueryData<any[]>(["storefront-products", store.id]);
  const basePath = storefrontPath(store.slug);
  const isHome = location.pathname === basePath || location.pathname === basePath + "/";
  const isWishlist = location.pathname.includes("wishlist");
  const isAccount = location.pathname.includes("account");

  const navItems = [
    { icon: Home, label: "Home", isActive: isHome && !searchOpen, type: "link" as const, to: basePath },
    { icon: Search, label: "Search", isActive: searchOpen, type: "search" as const, to: "" },
    { icon: Heart, label: "Wishlist", isActive: isWishlist && !searchOpen, type: "link" as const, to: storefrontPath(store.slug, "wishlist"), badge: wishlistCount },
    { icon: Bell, label: "Alerts", isActive: isAccount && !searchOpen, type: "link" as const, to: storefrontPath(store.slug, user ? "account" : "login") },
  ];

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-30 md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="mx-3 mb-2 flex items-center gap-2">
          <div className="flex flex-1 items-center justify-around rounded-[28px] px-1.5 py-2" style={{ backgroundColor: "var(--storefront-bg, hsl(var(--background)))", boxShadow: "0 2px 20px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)" }}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const handleClick = item.type === "search" ? () => setSearchOpen((prev) => !prev) : undefined;
              const content = (
                <>
                  <div className="absolute inset-0 rounded-full transition-all duration-300 ease-out" style={{ backgroundColor: item.isActive ? "var(--storefront-text, hsl(var(--foreground)))" : "transparent", transform: item.isActive ? "scale(1)" : "scale(0.8)", opacity: item.isActive ? 1 : 0 }} />
                  <Icon className="relative z-10 h-[22px] w-[22px] transition-all duration-300" style={{ color: item.isActive ? "var(--storefront-bg, hsl(var(--background)))" : "var(--storefront-text, hsl(var(--foreground)))45" }} strokeWidth={1.8} fill={item.isActive ? "var(--storefront-bg, hsl(var(--background)))" : "none"} />
                  <span className="relative z-10 text-xs font-semibold overflow-hidden transition-all duration-300 ease-out" style={{ color: item.isActive ? "var(--storefront-bg, hsl(var(--background)))" : "transparent", maxWidth: item.isActive ? "80px" : "0px", opacity: item.isActive ? 1 : 0, marginLeft: item.isActive ? "6px" : "0px" }}>{item.label}</span>
                  {!item.isActive && item.badge && item.badge > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold z-20" style={{ backgroundColor: "#EF4444", color: "#fff" }}>{item.badge > 9 ? "9+" : item.badge}</span>}
                </>
              );
              if (item.type === "search") return <button key={item.label} onClick={handleClick} className="relative flex items-center justify-center rounded-full px-3 py-2.5 transition-all duration-300 active:scale-95">{content}</button>;
              return <Link key={item.label} to={item.to} onClick={() => setSearchOpen(false)} className="relative flex items-center justify-center rounded-full px-3 py-2.5 transition-all duration-300 active:scale-95">{content}</Link>;
            })}
          </div>
          <button onClick={openCart} className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95" style={{ backgroundColor: "var(--storefront-bg, hsl(var(--background)))", boxShadow: "0 2px 20px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)" }}>
            <ShoppingCart className="h-[22px] w-[22px]" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }} strokeWidth={1.8} />
            {cartCount > 0 && <span className="absolute -right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold" style={{ backgroundColor: "#EF4444", color: "#fff" }}>{cartCount > 9 ? "9+" : cartCount}</span>}
          </button>
        </div>
      </nav>
      <StorefrontSearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} products={products} slug={store.slug} initialFiltersOpen={false} />
    </>
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
          <AppHeader store={store} />
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
