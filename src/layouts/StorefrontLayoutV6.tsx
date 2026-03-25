import { useState, useEffect, Suspense } from "react";
import { Link, Outlet } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ShoppingCart, Heart, User, Search, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { useStorefrontAuth } from "@/contexts/StorefrontAuthContext";
import ShareStoreDialog from "@/components/ShareStoreDialog";
import { StorefrontContentSkeleton } from "@/components/ContentSkeleton";
import { storefrontPath } from "@/lib/subdomain";
import { Skeleton } from "@/components/ui/skeleton";
import StorefrontShell from "@/layouts/StorefrontShell";
import type { StoreData } from "@/layouts/StorefrontLayout";

function CartBadgeV6() {
  const { cartCount, openCart } = useCart();
  return (
    <button onClick={openCart} className="relative group" aria-label={`Shopping cart${cartCount > 0 ? `, ${cartCount} items` : ''}`}>
      <ShoppingCart className="h-5 w-5 transition-colors" style={{ color: "var(--storefront-text, #1e293b)" }} aria-hidden="true" />
      {cartCount > 0 && (
        <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold" style={{ backgroundColor: "var(--storefront-primary, #2563EB)", color: "#fff" }}>
          {cartCount > 99 ? "99+" : cartCount}
        </span>
      )}
    </button>
  );
}

function WishlistBadgeV6({ slug }: { slug: string }) {
  const { wishlistCount } = useWishlist();
  return (
    <Link to={storefrontPath(slug, "wishlist")} className="relative group" aria-label={`Wishlist${wishlistCount > 0 ? `, ${wishlistCount} items` : ''}`}>
      <Heart className="h-5 w-5 transition-colors" style={{ color: "var(--storefront-text, #1e293b)" }} aria-hidden="true" />
      {wishlistCount > 0 && (
        <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">{wishlistCount > 99 ? "99+" : wishlistCount}</span>
      )}
    </Link>
  );
}

function AccountBadgeV6({ slug }: { slug: string }) {
  const { user, loading } = useStorefrontAuth();
  if (loading) return null;
  return (
    <Link to={storefrontPath(slug, user ? "account" : "login")} className="group" aria-label={user ? "My account" : "Login"}>
      <User className="h-5 w-5 transition-colors" style={{ color: "var(--storefront-text, #1e293b)" }} aria-hidden="true" />
    </Link>
  );
}

function CleanHeader({ store }: { store: StoreData }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const queryClient = useQueryClient();
  const categories = queryClient.getQueryData<any[]>(["storefront-categories", store.id]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { to: storefrontPath(store.slug), label: "Home" },
    { to: storefrontPath(store.slug, "shop"), label: "Shop" },
    { to: storefrontPath(store.slug, "contact"), label: "About" },
  ];

  return (
    <header className="sticky top-0 z-30 transition-shadow duration-300" style={{ height: "72px", backgroundColor: "var(--storefront-bg, #F8FAFC)", borderBottom: "1px solid", borderColor: scrolled ? "var(--storefront-text, #1e293b)10" : "var(--storefront-text, #1e293b)08", boxShadow: scrolled ? "0 1px 3px rgba(0,0,0,0.04)" : "none" }}>
      <div className="mx-auto flex h-full max-w-7xl items-center px-4 lg:px-8">
        <div className="lg:hidden mr-3">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild><button className="p-1"><Menu className="h-5 w-5" style={{ color: "var(--storefront-text, #1e293b)" }} /></button></SheetTrigger>
            <SheetContent side="left" className="storefront-font w-[300px] p-0 border-r-0">
              <div className="flex flex-col h-full" style={{ backgroundColor: "var(--storefront-bg, #F8FAFC)", color: "var(--storefront-text, #1e293b)" }}>
                <div className="border-b p-6" style={{ borderColor: "var(--storefront-text, #1e293b)10" }}>
                  {store.logo_url ? <img src={store.logo_url} alt={store.name} className="h-8 w-auto max-w-[160px] object-contain" /> : <span className="text-lg font-bold" style={{ fontFamily: "var(--storefront-heading-font, 'Poppins')" }}>{store.name}</span>}
                </div>
                <nav className="flex flex-col gap-0.5 p-4">
                  {[...navLinks, { to: storefrontPath(store.slug, "wishlist"), label: "Wishlist" }, { to: storefrontPath(store.slug, "account"), label: "Account" }, { to: storefrontPath(store.slug, "return-policy"), label: "Returns" }, { to: storefrontPath(store.slug, "contact"), label: "Contact" }].map((link) => (
                    <Link key={link.to + link.label} to={link.to} onClick={() => setMenuOpen(false)} className="rounded-xl px-4 py-3 text-sm font-medium transition-colors" style={{ color: "var(--storefront-text, #1e293b)" }}>{link.label}</Link>
                  ))}
                  {categories && categories.length > 0 && (
                    <>
                      <div className="mt-4 mb-2 px-4 text-[10px] font-semibold tracking-[0.2em] uppercase opacity-40">Categories</div>
                      {categories.map((cat: any) => (
                        <Link key={cat.id} to={storefrontPath(store.slug, `category/${cat.slug}`)} onClick={() => setMenuOpen(false)} className="rounded-xl px-4 py-3 text-sm font-medium transition-colors" style={{ color: "var(--storefront-text, #1e293b)" }}>{cat.name}</Link>
                      ))}
                    </>
                  )}
                </nav>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <Link to={storefrontPath(store.slug)} className="flex-shrink-0" aria-label={`${store.name} home`}>
          {store.logo_url ? <img src={store.logo_url} alt={store.name} className="h-8 w-auto max-w-[140px] object-contain" /> : <span className="text-xl font-bold tracking-tight" style={{ fontFamily: "var(--storefront-heading-font, 'Poppins')", color: "var(--storefront-text, #1e293b)" }}>{store.name}</span>}
        </Link>

        <nav className="hidden lg:flex items-center gap-8 mx-auto">
          {navLinks.map((link) => (<Link key={link.to} to={link.to} className="text-sm font-medium transition-opacity hover:opacity-70" style={{ color: "var(--storefront-text, #1e293b)" }}>{link.label}</Link>))}
          {categories && categories.length > 0 && (
            <div className="relative group">
              <span className="text-sm font-medium cursor-pointer transition-opacity hover:opacity-70" style={{ color: "var(--storefront-text, #1e293b)" }}>Categories</span>
              <div className="absolute top-full left-0 mt-2 min-w-[180px] rounded-xl border p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 shadow-lg" style={{ backgroundColor: "var(--storefront-bg, #F8FAFC)", borderColor: "var(--storefront-text, #1e293b)10" }}>
                {categories.map((cat: any) => (<Link key={cat.id} to={storefrontPath(store.slug, `category/${cat.slug}`)} className="block rounded-lg px-3 py-2 text-sm transition-colors hover:opacity-70" style={{ color: "var(--storefront-text, #1e293b)" }}>{cat.name}</Link>))}
              </div>
            </div>
          )}
        </nav>

        <div className="flex-1 lg:hidden" />

        <div className="flex items-center gap-3 sm:gap-5">
          <AccountBadgeV6 slug={store.slug} />
          <WishlistBadgeV6 slug={store.slug} />
          <CartBadgeV6 />
          <ShareStoreDialog storeSlug={store.slug} storeName={store.name} iconOnly />
        </div>
      </div>
    </header>
  );
}

function CleanFooter({ store }: { store: StoreData }) {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t mt-20" style={{ backgroundColor: "var(--storefront-accent, #1e293b)", color: "var(--storefront-bg, #F8FAFC)", borderColor: "transparent" }}>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <h3 className="text-base font-bold mb-3" style={{ fontFamily: "var(--storefront-heading-font, 'Poppins')" }}>{store.name}</h3>
            <p className="text-sm opacity-60 leading-relaxed">{store.description || "Premium quality products for modern living."}</p>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-4 uppercase tracking-wider opacity-70">Shop</h4>
            <div className="flex flex-col gap-2.5">
              {[{ to: storefrontPath(store.slug), label: "Home" }, { to: storefrontPath(store.slug, "shop"), label: "Best Sellers" }].map((l) => (<Link key={l.label} to={l.to} className="text-sm opacity-50 hover:opacity-80 transition-opacity">{l.label}</Link>))}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-4 uppercase tracking-wider opacity-70">Support</h4>
            <div className="flex flex-col gap-2.5">
              {[{ to: storefrontPath(store.slug, "contact"), label: "Contact Us" }, { to: storefrontPath(store.slug, "return-policy"), label: "Returns" }, { to: storefrontPath(store.slug, "shipping-policy"), label: "Shipping" }].map((l) => (<Link key={l.label} to={l.to} className="text-sm opacity-50 hover:opacity-80 transition-opacity">{l.label}</Link>))}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-4 uppercase tracking-wider opacity-70">Legal</h4>
            <div className="flex flex-col gap-2.5">
              {[{ to: storefrontPath(store.slug, "terms"), label: "Terms" }, { to: storefrontPath(store.slug, "privacy-policy"), label: "Privacy" }].map((l) => (<Link key={l.label} to={l.to} className="text-sm opacity-50 hover:opacity-80 transition-opacity">{l.label}</Link>))}
            </div>
          </div>
        </div>
        <div className="mt-12 border-t pt-8 text-center" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <p className="text-xs opacity-40">© {year} {store.name}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

export default function StorefrontLayoutV6({ slugOverride }: { slugOverride?: string } = {}) {
  return (
    <StorefrontShell
      slugOverride={slugOverride}
      defaultPrimary="#2563EB"
      defaultButtonRadius="0.75rem"
      wrapperClassName="storefront-font min-h-screen"
      wrapperStyle={{ fontFamily: "var(--storefront-body-font, 'Inter')", backgroundColor: "var(--storefront-bg, #F8FAFC)", color: "var(--storefront-text, #1e293b)" }}
      skeleton={<div className="min-h-screen bg-background"><Skeleton className="h-[72px] w-full" /><Skeleton className="h-[500px] w-full mt-1" /></div>}
    >
      {({ store }) => (
        <>
          <CleanHeader store={store} />
          <main><Suspense fallback={<StorefrontContentSkeleton />}><Outlet context={store} /></Suspense></main>
          <CleanFooter store={store} />
        </>
      )}
    </StorefrontShell>
  );
}
