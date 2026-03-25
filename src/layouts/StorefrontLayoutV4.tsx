import { useState, useEffect, Suspense } from "react";
import { Link, Outlet } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ShoppingCart, Heart, User } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { useStorefrontAuth } from "@/contexts/StorefrontAuthContext";
import StorefrontFooter from "@/components/storefront/StorefrontFooter";
import ShareStoreDialog from "@/components/ShareStoreDialog";
import { StorefrontContentSkeleton } from "@/components/ContentSkeleton";
import { storefrontPath } from "@/lib/subdomain";
import { Skeleton } from "@/components/ui/skeleton";
import StorefrontShell from "@/layouts/StorefrontShell";
import type { StoreData } from "@/layouts/StorefrontLayout";

function CartBadgeV4() {
  const { cartCount, openCart } = useCart();
  return (
    <button onClick={openCart} className="relative group" aria-label={`Shopping cart${cartCount > 0 ? `, ${cartCount} items` : ''}`}>
      <ShoppingCart className="h-[18px] w-[18px] transition-opacity group-hover:opacity-70" aria-hidden="true" />
      {cartCount > 0 && (
        <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-medium" style={{ backgroundColor: "var(--storefront-primary, #C8A96A)", color: "var(--storefront-btn-text, #fff)" }}>
          {cartCount > 99 ? "99+" : cartCount}
        </span>
      )}
    </button>
  );
}

function WishlistBadgeV4({ slug }: { slug: string }) {
  const { wishlistCount } = useWishlist();
  return (
    <Link to={storefrontPath(slug, "wishlist")} className="relative group" aria-label={`Wishlist${wishlistCount > 0 ? `, ${wishlistCount} items` : ''}`}>
      <Heart className="h-[18px] w-[18px] transition-opacity group-hover:opacity-70" aria-hidden="true" />
      {wishlistCount > 0 && (
        <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-medium text-destructive-foreground">{wishlistCount > 99 ? "99+" : wishlistCount}</span>
      )}
    </Link>
  );
}

function AccountBadgeV4({ slug }: { slug: string }) {
  const { user, loading } = useStorefrontAuth();
  if (loading) return null;
  return (
    <Link to={storefrontPath(slug, user ? "account" : "login")} className="group" aria-label={user ? "My account" : "Login"}>
      <User className="h-[18px] w-[18px] transition-opacity group-hover:opacity-70" aria-hidden="true" />
    </Link>
  );
}

function LuxuryNav({ store, scrolled }: { store: StoreData; scrolled: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const queryClient = useQueryClient();
  const categories = queryClient.getQueryData<any[]>(["storefront-categories", store.id]);

  return (
    <nav className="fixed top-0 left-0 right-0 z-30 transition-all duration-500" style={{ backgroundColor: scrolled ? "var(--storefront-bg, #F8F5F0)" : "transparent", color: scrolled ? "var(--storefront-text, #1C1C1C)" : "#ffffff", borderBottom: scrolled ? "1px solid var(--storefront-text, #1C1C1C)15" : "none" }}>
      <div className="h-[2px] w-full" style={{ backgroundColor: "var(--storefront-primary, #C8A96A)" }} />
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-12">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <button className="tracking-[0.2em] text-[11px] font-light uppercase transition-opacity hover:opacity-60">Menu</button>
          </SheetTrigger>
          <SheetContent side="left" className="storefront-font w-[320px] p-0 border-r-0">
            <div className="flex flex-col h-full" style={{ backgroundColor: "var(--storefront-bg, #F8F5F0)" }}>
              <div className="border-b px-8 py-6" style={{ borderColor: "var(--storefront-text, #1C1C1C)10" }}>
                <span className="text-lg tracking-[0.15em] uppercase" style={{ fontFamily: "var(--storefront-heading-font, 'Playfair Display')", color: "var(--storefront-text, #1C1C1C)" }}>{store.name}</span>
              </div>
              <nav className="flex flex-col gap-0 px-8 py-6">
                {[
                  { to: storefrontPath(store.slug), label: "Home" },
                  { to: storefrontPath(store.slug, "shop"), label: "Best Sellers" },
                  { to: storefrontPath(store.slug, "account"), label: "Account" },
                  { to: storefrontPath(store.slug, "wishlist"), label: "Wishlist" },
                  { to: storefrontPath(store.slug, "contact"), label: "Contact" },
                  { to: storefrontPath(store.slug, "return-policy"), label: "Returns" },
                ].map((link) => (
                  <Link key={link.to} to={link.to} onClick={() => setMenuOpen(false)} className="border-b py-3.5 text-[13px] font-light tracking-[0.1em] uppercase transition-opacity hover:opacity-60" style={{ borderColor: "var(--storefront-text, #1C1C1C)08", color: "var(--storefront-text, #1C1C1C)" }}>{link.label}</Link>
                ))}
                {categories && categories.length > 0 && (
                  <>
                    <div className="mt-6 mb-3 text-[10px] font-medium tracking-[0.25em] uppercase" style={{ color: "var(--storefront-primary, #C8A96A)" }}>Collections</div>
                    {categories.map((cat: any) => (
                      <Link key={cat.id} to={storefrontPath(store.slug, `category/${cat.slug}`)} onClick={() => setMenuOpen(false)} className="border-b py-3 text-[13px] font-light tracking-[0.1em] uppercase transition-opacity hover:opacity-60" style={{ borderColor: "var(--storefront-text, #1C1C1C)08", color: "var(--storefront-text, #1C1C1C)" }}>{cat.name}</Link>
                    ))}
                  </>
                )}
              </nav>
            </div>
          </SheetContent>
        </Sheet>

        <Link to={storefrontPath(store.slug)} className="absolute left-1/2 -translate-x-1/2">
          {store.logo_url ? (
            <img src={store.logo_url} alt={store.name} className="h-8 w-auto max-w-[160px] object-contain" style={{ filter: scrolled ? "none" : "brightness(0) invert(1)" }} />
          ) : (
            <span className="text-xl tracking-[0.15em] uppercase" style={{ fontFamily: "var(--storefront-heading-font, 'Playfair Display')" }}>{store.name}</span>
          )}
        </Link>

        <div className="flex items-center gap-5">
          <AccountBadgeV4 slug={store.slug} />
          <WishlistBadgeV4 slug={store.slug} />
          <CartBadgeV4 />
          <ShareStoreDialog storeSlug={store.slug} storeName={store.name} iconOnly />
        </div>
      </div>
    </nav>
  );
}

export default function StorefrontLayoutV4({ slugOverride }: { slugOverride?: string } = {}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <StorefrontShell
      slugOverride={slugOverride}
      defaultPrimary="#C8A96A"
      wrapperClassName="storefront-font min-h-screen"
      wrapperStyle={{ fontFamily: "var(--storefront-body-font, 'Inter')", backgroundColor: "var(--storefront-bg, #F8F5F0)", color: "var(--storefront-text, #1C1C1C)" }}
      skeleton={<div className="min-h-screen bg-background"><Skeleton className="h-screen w-full" /></div>}
    >
      {({ store }) => (
        <>
          <LuxuryNav store={store} scrolled={scrolled} />
          <main><Suspense fallback={<StorefrontContentSkeleton />}><Outlet context={store} /></Suspense></main>
          <StorefrontFooter store={store} />
        </>
      )}
    </StorefrontShell>
  );
}
