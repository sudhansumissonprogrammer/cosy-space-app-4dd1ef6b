import { useState, Suspense } from "react";
import { Link, Outlet } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ShoppingCart, Heart, User, Menu } from "lucide-react";
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

function CartBadgeV7() {
  const { cartCount, openCart } = useCart();
  return (
    <button onClick={openCart} className="relative" aria-label={`Shopping cart${cartCount > 0 ? `, ${cartCount} items` : ''}`}>
      <ShoppingCart className="h-[18px] w-[18px]" style={{ color: "var(--storefront-text, #1a1a1a)" }} aria-hidden="true" />
      {cartCount > 0 && (
        <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold" style={{ backgroundColor: "var(--storefront-primary, #1a1a1a)", color: "var(--storefront-btn-text, #fff)" }}>{cartCount}</span>
      )}
    </button>
  );
}

function WishlistBadgeV7({ slug }: { slug: string }) {
  const { wishlistCount } = useWishlist();
  return (
    <Link to={storefrontPath(slug, "wishlist")} className="relative" aria-label={`Wishlist${wishlistCount > 0 ? `, ${wishlistCount} items` : ''}`}>
      <Heart className="h-[18px] w-[18px]" style={{ color: "var(--storefront-text, #1a1a1a)" }} aria-hidden="true" />
      {wishlistCount > 0 && <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">{wishlistCount}</span>}
    </Link>
  );
}

function AccountBadgeV7({ slug }: { slug: string }) {
  const { user, loading } = useStorefrontAuth();
  if (loading) return null;
  return (
    <Link to={storefrontPath(slug, user ? "account" : "login")} aria-label={user ? "My account" : "Login"}>
      <User className="h-[18px] w-[18px]" style={{ color: "var(--storefront-text, #1a1a1a)" }} aria-hidden="true" />
    </Link>
  );
}

function CategoryTicker({ store }: { store: StoreData }) {
  const queryClient = useQueryClient();
  const categories = queryClient.getQueryData<any[]>(["storefront-categories", store.id]);
  if (!categories || categories.length === 0) return null;
  const items = categories.map((c) => c.name.toUpperCase());
  const repeated = [...items, ...items];
  return (
    <div className="w-full overflow-hidden border-b py-2" style={{ backgroundColor: "var(--storefront-bg, #ffffff)", borderColor: "var(--storefront-text, #1a1a1a)08" }}>
      <div className="flex w-max animate-marquee items-center gap-8">
        {repeated.map((name, i) => (
          <Link key={`${name}-${i}`} to={storefrontPath(store.slug, `category/${categories[i % categories.length]?.slug || ""}`)} className="whitespace-nowrap text-[10px] font-semibold tracking-[0.2em] transition-opacity hover:opacity-60" style={{ color: "var(--storefront-text, #1a1a1a)", opacity: 0.5 }}>{name}</Link>
        ))}
      </div>
    </div>
  );
}

function EditorialHeader({ store }: { store: StoreData }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const queryClient = useQueryClient();
  const categories = queryClient.getQueryData<any[]>(["storefront-categories", store.id]);

  return (
    <>
      <header className="sticky top-0 z-30 border-b" style={{ height: "56px", backgroundColor: "var(--storefront-bg, #ffffff)", borderColor: "var(--storefront-text, #1a1a1a)10" }}>
        <div className="mx-auto flex h-full max-w-7xl items-center px-4 lg:px-8">
          <div className="lg:hidden mr-4">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild><button className="p-1" aria-label="Open menu"><Menu className="h-5 w-5" style={{ color: "var(--storefront-text, #1a1a1a)" }} aria-hidden="true" /></button></SheetTrigger>
              <SheetContent side="left" className="storefront-font w-[280px] p-0 border-r-0">
                <div className="flex flex-col h-full" style={{ backgroundColor: "var(--storefront-bg, #fff)", color: "var(--storefront-text, #1a1a1a)" }}>
                  <div className="border-b p-6" style={{ borderColor: "var(--storefront-text, #1a1a1a)08" }}>
                    <span className="text-lg font-bold tracking-tight uppercase" style={{ fontFamily: "var(--storefront-heading-font, 'Playfair Display')" }}>{store.name}</span>
                  </div>
                  <nav className="flex flex-col p-4">
                    {[{ to: storefrontPath(store.slug), label: "Home" }, { to: storefrontPath(store.slug, "shop"), label: "Collection" }, { to: storefrontPath(store.slug, "contact"), label: "Contact" }, { to: storefrontPath(store.slug, "wishlist"), label: "Wishlist" }, { to: storefrontPath(store.slug, "account"), label: "Account" }].map((link) => (
                      <Link key={link.label} to={link.to} onClick={() => setMenuOpen(false)} className="py-3 text-sm font-medium tracking-wide uppercase opacity-70 transition-opacity hover:opacity-100">{link.label}</Link>
                    ))}
                    {categories && categories.length > 0 && (
                      <>
                        <div className="mt-4 mb-2 text-[9px] font-bold tracking-[0.25em] uppercase opacity-30">Categories</div>
                        {categories.map((cat: any) => (<Link key={cat.id} to={storefrontPath(store.slug, `category/${cat.slug}`)} onClick={() => setMenuOpen(false)} className="py-2.5 text-sm opacity-60 transition-opacity hover:opacity-100">{cat.name}</Link>))}
                      </>
                    )}
                  </nav>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <nav className="hidden lg:flex items-center gap-8 mr-auto">
            {[{ to: storefrontPath(store.slug, "shop"), label: "Collection" }, { to: storefrontPath(store.slug, "contact"), label: "About" }].map((link) => (
              <Link key={link.label} to={link.to} className="text-[11px] font-semibold tracking-[0.15em] uppercase transition-opacity hover:opacity-60" style={{ color: "var(--storefront-text, #1a1a1a)", opacity: 0.6 }}>{link.label}</Link>
            ))}
          </nav>

          <Link to={storefrontPath(store.slug)} className="absolute left-1/2 -translate-x-1/2 lg:static lg:translate-x-0 lg:mx-auto">
            {store.logo_url ? <img src={store.logo_url} alt={store.name} className="h-7 w-auto max-w-[130px] object-contain" /> : <span className="text-xl font-bold tracking-[0.05em] uppercase" style={{ fontFamily: "var(--storefront-heading-font, 'Playfair Display')", color: "var(--storefront-text, #1a1a1a)" }}>{store.name}</span>}
          </Link>

          <div className="flex items-center gap-4 ml-auto">
            <AccountBadgeV7 slug={store.slug} />
            <WishlistBadgeV7 slug={store.slug} />
            <CartBadgeV7 />
            <ShareStoreDialog storeSlug={store.slug} storeName={store.name} iconOnly />
          </div>
        </div>
      </header>
      <CategoryTicker store={store} />
    </>
  );
}

function EditorialFooter({ store }: { store: StoreData }) {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t mt-0" style={{ backgroundColor: "var(--storefront-accent, #1a1a1a)", color: "var(--storefront-bg, #ffffff)", borderColor: "transparent" }}>
      <div className="mx-auto max-w-7xl px-4 py-12 sm:py-16 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
          <div>
            <h3 className="text-2xl font-bold tracking-[0.05em] uppercase mb-4" style={{ fontFamily: "var(--storefront-heading-font, 'Playfair Display')" }}>{store.name}</h3>
            <p className="text-sm leading-relaxed opacity-50 max-w-md">{store.description || "Curated products with editorial excellence. Every piece tells a story."}</p>
          </div>
          <div className="grid grid-cols-2 gap-8">
            <div>
              <h4 className="text-[10px] font-bold tracking-[0.25em] uppercase opacity-40 mb-4">Navigate</h4>
              <div className="flex flex-col gap-2.5">
                {[{ to: storefrontPath(store.slug), label: "Home" }, { to: storefrontPath(store.slug, "shop"), label: "Collection" }, { to: storefrontPath(store.slug, "contact"), label: "Contact" }].map((l) => (<Link key={l.label} to={l.to} className="text-sm opacity-50 hover:opacity-80 transition-opacity">{l.label}</Link>))}
              </div>
            </div>
            <div>
              <h4 className="text-[10px] font-bold tracking-[0.25em] uppercase opacity-40 mb-4">Legal</h4>
              <div className="flex flex-col gap-2.5">
                {[{ to: storefrontPath(store.slug, "return-policy"), label: "Returns" }, { to: storefrontPath(store.slug, "shipping-policy"), label: "Shipping" }, { to: storefrontPath(store.slug, "terms"), label: "Terms" }, { to: storefrontPath(store.slug, "privacy-policy"), label: "Privacy" }].map((l) => (<Link key={l.label} to={l.to} className="text-sm opacity-50 hover:opacity-80 transition-opacity">{l.label}</Link>))}
              </div>
            </div>
          </div>
        </div>
        <div className="mt-12 border-t pt-8 text-center" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <p className="text-xs opacity-30">© {year} {store.name}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

export default function StorefrontLayoutV7({ slugOverride }: { slugOverride?: string } = {}) {
  return (
    <StorefrontShell
      slugOverride={slugOverride}
      defaultPrimary="#1a1a1a"
      wrapperClassName="storefront-font min-h-screen"
      wrapperStyle={{ fontFamily: "var(--storefront-body-font, 'Inter')", backgroundColor: "var(--storefront-bg, #ffffff)", color: "var(--storefront-text, #1a1a1a)" }}
      skeleton={<div className="min-h-screen bg-background"><Skeleton className="h-[56px] w-full" /><Skeleton className="h-[32px] w-full" /><Skeleton className="h-[500px] w-full mt-1" /></div>}
    >
      {({ store }) => (
        <>
          <EditorialHeader store={store} />
          <main><Suspense fallback={<StorefrontContentSkeleton />}><Outlet context={store} /></Suspense></main>
          <EditorialFooter store={store} />
        </>
      )}
    </StorefrontShell>
  );
}
