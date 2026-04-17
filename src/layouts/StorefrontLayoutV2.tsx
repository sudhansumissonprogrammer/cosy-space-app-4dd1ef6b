import { useState, Suspense } from "react";
import { Link, Outlet } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Store, ShoppingCart, Heart, User, Menu } from "lucide-react";
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
import MobileBottomNav from "@/components/storefront/MobileBottomNav";
import DesktopNavBar from "@/components/storefront/DesktopNavBar";
import type { StoreData } from "@/layouts/StorefrontLayout";

function CartBadgeV2() {
  const { cartCount, openCart } = useCart();
  return (
    <button onClick={openCart} className="relative" aria-label={`Shopping cart${cartCount > 0 ? `, ${cartCount} items` : ''}`}>
      <div className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-accent">
        <ShoppingCart className="h-5 w-5" aria-hidden="true" />
      </div>
      {cartCount > 0 && (
        <span
          className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
          style={{ backgroundColor: "var(--storefront-primary, hsl(var(--foreground)))", color: "var(--storefront-btn-text, hsl(var(--background)))" }}
        >
          {cartCount > 99 ? "99+" : cartCount}
        </span>
      )}
    </button>
  );
}

function WishlistBadgeV2({ slug }: { slug: string }) {
  const { wishlistCount } = useWishlist();
  return (
    <Link to={storefrontPath(slug, "wishlist")} className="relative" aria-label={`Wishlist${wishlistCount > 0 ? `, ${wishlistCount} items` : ''}`}>
      <div className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-accent">
        <Heart className="h-5 w-5" aria-hidden="true" />
      </div>
      {wishlistCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
          {wishlistCount > 99 ? "99+" : wishlistCount}
        </span>
      )}
    </Link>
  );
}

function AccountBadgeV2({ slug }: { slug: string }) {
  const { user, loading } = useStorefrontAuth();
  if (loading) return null;
  return (
    <Link to={storefrontPath(slug, user ? "account" : "login")} aria-label={user ? "My account" : "Login"}>
      <div className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-accent">
        <User className="h-5 w-5" aria-hidden="true" />
      </div>
    </Link>
  );
}

function TransparentNav({ store, scrolled }: { store: StoreData; scrolled: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const queryClient = useQueryClient();
  const categories = queryClient.getQueryData<any[]>(["storefront-categories", store.id]);
  const customPages = queryClient.getQueryData<any[]>(["storefront-custom-pages", store.id]) ?? [];

  return (
    <nav
      className="relative z-30 transition-all duration-300"
      style={{
        backgroundColor: "var(--storefront-bg, hsl(var(--background)))",
        color: "var(--storefront-text, hsl(var(--foreground)))",
        borderBottom: "1px solid var(--storefront-text, hsl(var(--foreground)))10",
      }}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <button className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full transition-colors hover:bg-accent">
              <Menu className="h-6 w-6 sm:h-7 sm:w-7" />
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
                  ...customPages.map((cp: any) => ({ to: storefrontPath(store.slug, `page/${cp.slug}`), label: cp.title })),
                  { to: storefrontPath(store.slug, "wishlist"), label: "Wishlist" },
                  { to: storefrontPath(store.slug, "account"), label: "My Account" },
                ].map((link) => (
                  <Link key={link.to} to={link.to} onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent">
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>
          </SheetContent>
        </Sheet>

        <Link to={storefrontPath(store.slug)} className="flex-shrink-0" aria-label={`${store.name} home`}>
          {store.logo_url ? (
            <img src={store.logo_url} alt={store.name} className="h-10 w-auto max-w-[140px] object-contain" />
          ) : (
            <span className="text-xl font-bold tracking-tight" style={{ fontFamily: "var(--storefront-heading-font, inherit)" }}>{store.name}</span>
          )}
        </Link>

        <div className="flex-1" />

        <div className="flex items-center gap-1.5">
          <AccountBadgeV2 slug={store.slug} />
          <WishlistBadgeV2 slug={store.slug} />
          <CartBadgeV2 />
          <ShareStoreDialog storeSlug={store.slug} storeName={store.name} customDomain={(store as any).custom_domain} iconOnly />
        </div>
      </div>
    </nav>
  );
}

export default function StorefrontLayoutV2({ slugOverride }: { slugOverride?: string } = {}) {
  return (
    <StorefrontShell slugOverride={slugOverride} defaultPrimary="#004643">
      {({ store }) => (
        <>
          <DesktopNavBar store={store} />
          <div className="md:hidden"><TransparentNav store={store} scrolled={false} /></div>
          <main className="pb-20 md:pb-0"><Suspense fallback={<StorefrontContentSkeleton />}><Outlet context={store} /></Suspense></main>
          <StorefrontFooter store={store} />
          <div className="md:hidden">
            <MobileBottomNav store={store} />
          </div>
        </>
      )}
    </StorefrontShell>
  );
}
