import { useState, Suspense } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ShoppingCart, Heart, User, Search, Menu, Home, LayoutGrid, X, ChevronRight } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { useStorefrontAuth } from "@/contexts/StorefrontAuthContext";
import StorefrontSearchOverlay from "@/components/storefront/StorefrontSearchOverlay";
import { StorefrontContentSkeleton } from "@/components/ContentSkeleton";
import { storefrontPath } from "@/lib/subdomain";
import { Skeleton } from "@/components/ui/skeleton";
import StorefrontShell from "@/layouts/StorefrontShell";
import type { StoreData } from "@/layouts/StorefrontLayout";

function V12Header({ store }: { store: StoreData }) {
  const { cartCount, openCart } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const queryClient = useQueryClient();
  const categories = queryClient.getQueryData<any[]>(["storefront-categories", store.id]);
  const products = queryClient.getQueryData<any[]>(["storefront-products", store.id]);
  const { user } = useStorefrontAuth();

  return (
    <>
      <header className="sticky top-0 z-40 flex items-center justify-between px-4 py-3" style={{ backgroundColor: "var(--storefront-bg, #ffffff)", borderBottom: "1px solid var(--storefront-text, #1a1a1a)12" }}>
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <button className="flex h-10 w-10 items-center justify-center rounded-md transition-all active:scale-90" aria-label="Open menu">
              <Menu className="h-5 w-5" style={{ color: "var(--storefront-text, #1a1a1a)" }} aria-hidden="true" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[300px] p-0 border-0" style={{ backgroundColor: "var(--storefront-bg, #ffffff)" }}>
            <StorefrontSidebarMenu slug={store.slug} storeName={store.name} logoUrl={store.logo_url} categories={categories} onClose={() => setMenuOpen(false)} />
          </SheetContent>
        </Sheet>

        <Link to={storefrontPath(store.slug)} className="absolute left-1/2 -translate-x-1/2">
          {store.logo_url ? <img src={store.logo_url} alt={store.name} className="h-8 w-auto max-w-[130px] object-contain" /> : <span className="text-xl font-bold" style={{ color: "var(--storefront-text, #1a1a1a)", fontFamily: "var(--storefront-heading-font, 'Poppins'), sans-serif" }}>{store.name}</span>}
        </Link>

        <div className="flex items-center gap-0.5">
          <button onClick={() => setSearchOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-md transition-all active:scale-90" aria-label="Search products"><Search className="h-5 w-5" style={{ color: "var(--storefront-text, #1a1a1a)" }} aria-hidden="true" /></button>
          <button onClick={openCart} className="relative flex h-10 w-10 items-center justify-center rounded-md transition-all active:scale-90" aria-label={`Shopping cart${cartCount > 0 ? `, ${cartCount} items` : ''}`}>
            <ShoppingCart className="h-5 w-5" style={{ color: "var(--storefront-text, #1a1a1a)" }} aria-hidden="true" />
            {cartCount > 0 && <span className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ backgroundColor: "var(--storefront-primary, #FF3F6C)" }}>{cartCount > 9 ? "9+" : cartCount}</span>}
          </button>
        </div>
      </header>
      <StorefrontSearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} products={products} slug={store.slug} initialFiltersOpen={false} />
    </>
  );
}

function V12TabBar({ store }: { store: StoreData }) {
  const location = useLocation();
  const { wishlistCount } = useWishlist();
  const { cartCount, openCart } = useCart();
  const { user } = useStorefrontAuth();
  const basePath = storefrontPath(store.slug);
  const tabs = [
    { icon: Home, label: "Home", to: basePath, matchExact: true },
    { icon: LayoutGrid, label: "Shop", to: storefrontPath(store.slug, "shop"), match: "shop" },
    { icon: Heart, label: "Wishlist", to: storefrontPath(store.slug, "wishlist"), match: "wishlist", badge: wishlistCount },
    { icon: User, label: "Account", to: storefrontPath(store.slug, user ? "account" : "login"), match: "account" },
    { icon: ShoppingCart, label: "Cart", to: "__cart__", match: "__cart__", badge: cartCount, isCart: true },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="flex items-center justify-around py-1.5 border-t" style={{ backgroundColor: "var(--storefront-bg, #ffffff)", borderColor: "var(--storefront-text, #1a1a1a)10" }}>
        {tabs.map((tab) => {
          const isActive = tab.matchExact ? location.pathname === basePath || location.pathname === basePath + "/" : location.pathname.includes(tab.match!);
          const TabIcon = tab.icon;
          const content = (
            <div className="flex flex-col items-center justify-center gap-0.5 py-1 px-2" style={{ minWidth: "52px" }}>
              <div className="relative flex items-center justify-center" style={{ width: "24px", height: "24px" }}>
                <TabIcon className="h-[22px] w-[22px] transition-colors" style={{ color: isActive ? "var(--storefront-primary, #FF3F6C)" : "var(--storefront-text, #1a1a1a)60" }} />
                {tab.badge != null && tab.badge > 0 && <span className="absolute -right-2 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold text-white" style={{ backgroundColor: "var(--storefront-primary, #FF3F6C)" }}>{tab.badge > 9 ? "9+" : tab.badge}</span>}
              </div>
              <span className="text-[10px] font-medium" style={{ color: isActive ? "var(--storefront-primary, #FF3F6C)" : "var(--storefront-text, #1a1a1a)60" }}>{tab.label}</span>
            </div>
          );
          if (tab.isCart) return <button key={tab.label} onClick={openCart} className="transition-all active:scale-90">{content}</button>;
          return <Link key={tab.label} to={tab.to} className="transition-all active:scale-90">{content}</Link>;
        })}
      </div>
    </nav>
  );
}

function V12Footer({ store }: { store: StoreData }) {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-8" style={{ backgroundColor: "var(--storefront-accent, #111111)", color: "#fff" }}>
      <div className="px-5 py-10 space-y-8 max-w-6xl mx-auto">
        <div className="text-center space-y-3">
          {store.logo_url ? <img src={store.logo_url} alt={store.name} className="h-10 w-auto mx-auto object-contain brightness-0 invert" /> : <h3 className="text-2xl font-bold" style={{ fontFamily: "var(--storefront-heading-font, 'Poppins'), sans-serif" }}>{store.name}</h3>}
          {store.description && <p className="text-sm opacity-60 max-w-md mx-auto leading-relaxed">{store.description}</p>}
        </div>
        <div className="grid grid-cols-2 gap-6 text-sm">
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-widest opacity-50" style={{ color: "var(--storefront-primary, #FF3F6C)" }}>Quick Links</h4>
            {[{ to: storefrontPath(store.slug), label: "Home" }, { to: storefrontPath(store.slug, "shop"), label: "Shop All" }, { to: storefrontPath(store.slug, "about"), label: "About Us" }, { to: storefrontPath(store.slug, "contact"), label: "Contact Us" }].map((link) => (<Link key={link.label} to={link.to} className="block opacity-60 hover:opacity-100 transition-opacity text-[13px]">{link.label}</Link>))}
          </div>
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-widest opacity-50" style={{ color: "var(--storefront-primary, #FF3F6C)" }}>Policies</h4>
            {[{ to: storefrontPath(store.slug, "return-policy"), label: "Return & Refund" }, { to: storefrontPath(store.slug, "shipping-policy"), label: "Shipping Policy" }, { to: storefrontPath(store.slug, "terms"), label: "Terms & Conditions" }, { to: storefrontPath(store.slug, "privacy-policy"), label: "Privacy Policy" }].map((link) => (<Link key={link.label} to={link.to} className="block opacity-60 hover:opacity-100 transition-opacity text-[13px]">{link.label}</Link>))}
          </div>
        </div>
        <div className="pt-6 border-t border-white/10 text-center"><p className="text-[11px] opacity-40">© {year} {store.name}. All rights reserved.</p></div>
      </div>
    </footer>
  );
}

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
      wrapperClassName="storefront-font min-h-screen"
      wrapperStyle={{ "--storefront-bottom-nav-height": "64px", fontFamily: "var(--storefront-body-font, 'Inter'), sans-serif", backgroundColor: "var(--storefront-bg, #ffffff)", color: "var(--storefront-text, #1a1a1a)" } as React.CSSProperties}
      skeleton={<StorefrontV12Skeleton />}
    >
      {({ store }) => (
        <>
          <V12Header store={store} />
          <main className="pb-16 md:pb-0">
            <Suspense fallback={<StorefrontContentSkeleton />}><Outlet context={store} /></Suspense>
          </main>
          <V12Footer store={store} />
          <V12TabBar store={store} />
        </>
      )}
    </StorefrontShell>
  );
}
