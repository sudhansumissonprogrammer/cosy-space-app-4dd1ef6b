import { useState, useEffect, Suspense } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Store, ShoppingCart, Home, Tag, Mail, Heart, RotateCcw, User, ArrowLeft, X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { Tables } from "@/integrations/supabase/types";
import ShareStoreDialog from "@/components/ShareStoreDialog";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { useStorefrontAuth } from "@/contexts/StorefrontAuthContext";
import StorefrontMarquee from "@/components/storefront/StorefrontMarquee";
import StorefrontFooter from "@/components/storefront/StorefrontFooter";
import { StorefrontContentSkeleton } from "@/components/ContentSkeleton";
import { storefrontPath } from "@/lib/subdomain";
import { Skeleton } from "@/components/ui/skeleton";
import { prefetchStorefrontRoutes } from "@/lib/prefetchStorefrontRoutes";
import StorefrontShell from "@/layouts/StorefrontShell";
import { lazy } from "react";

const LazySearchOverlay = lazy(() => import("@/components/storefront/StorefrontSearchOverlay"));
const LazyMobileBottomNav = lazy(() => import("@/components/storefront/MobileBottomNav"));
const LazyMobileBottomNavModern = lazy(() => import("@/components/storefront/MobileBottomNavModern"));
const LazyDesktopNavBar = lazy(() => import("@/components/storefront/DesktopNavBar"));

// Re-export for backward compatibility — other layouts import these
export type { Tables };
export type StoreData = Tables<"stores">;

// Re-export useStorefront so other layouts can import from here
export { useStorefront } from "@/layouts/StorefrontLayout.logic";

function CartBadge() {
  const { cartCount, openCart } = useCart();
  return (
    <button onClick={openCart} className="relative" aria-label={`Shopping cart${cartCount > 0 ? `, ${cartCount} items` : ''}`}>
      <div className="flex h-9 w-9 items-center justify-center rounded-md text-foreground hover:bg-accent transition-colors">
        <ShoppingCart className="h-5 w-5" aria-hidden="true" />
      </div>
      {cartCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold" style={{ backgroundColor: "var(--storefront-primary, hsl(var(--foreground)))", color: "var(--storefront-btn-text, hsl(var(--background)))" }} aria-hidden="true">
          {cartCount > 99 ? "99+" : cartCount}
        </span>
      )}
    </button>
  );
}

function WishlistBadge({ slug }: { slug: string }) {
  const { wishlistCount } = useWishlist();
  return (
    <Link to={storefrontPath(slug, "wishlist")} className="relative" aria-label={`Wishlist${wishlistCount > 0 ? `, ${wishlistCount} items` : ''}`}>
      <Button variant="ghost" size="icon" className="h-9 w-9" aria-hidden="true" tabIndex={-1}><Heart className="h-5 w-5" /></Button>
      {wishlistCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground" aria-hidden="true">{wishlistCount > 99 ? "99+" : wishlistCount}</span>
      )}
    </Link>
  );
}

function AccountBadge({ slug }: { slug: string }) {
  const { user, loading } = useStorefrontAuth();
  if (loading) return null;
  return (
    <Link to={storefrontPath(slug, user ? "account" : "login")} aria-label={user ? "My account" : "Login"}>
      <Button variant="ghost" size="icon" className="h-9 w-9" aria-hidden="true" tabIndex={-1}><User className="h-5 w-5" /></Button>
    </Link>
  );
}

function HamburgerMenu({ store }: { store: StoreData }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const categories = queryClient.getQueryData<any[]>(["storefront-categories", store.id]);
  const customPages = queryClient.getQueryData<any[]>(["storefront-custom-pages", store.id]) ?? [];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-10 w-10 p-0" aria-label="Open menu">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--foreground))" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <line x1="6" y1="7" x2="18" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="6" y1="17" x2="18" y2="17" />
          </svg>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="storefront-font w-[280px] p-0">
        <div className="flex flex-col">
          <div className="border-b bg-card p-4">
            {store.logo_url ? (
              <img src={store.logo_url} alt={store.name} width={160} height={40} className="h-10 w-auto max-w-[160px] object-contain" loading="eager" />
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary"><Store className="h-4 w-4 text-primary-foreground" /></div>
                <span className="text-lg font-bold text-foreground">{store.name}</span>
              </div>
            )}
          </div>
          <nav className="flex flex-col gap-1 p-4">
            <Link to={storefrontPath(store.slug)} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"><Home className="h-4 w-4" />Home</Link>
            <Link to={storefrontPath(store.slug, "shop")} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"><Store className="h-4 w-4" />Shop All</Link>
            <Link to={storefrontPath(store.slug, "about")} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"><Store className="h-4 w-4" />About Us</Link>
            <Link to={storefrontPath(store.slug, "contact")} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"><Mail className="h-4 w-4" />Contact Us</Link>
            {customPages.map((cp: any) => (
              <Link key={cp.id} to={storefrontPath(store.slug, `page/${cp.slug}`)} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"><Tag className="h-4 w-4" />{cp.title}</Link>
            ))}
            <Link to={storefrontPath(store.slug, "wishlist")} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"><Heart className="h-4 w-4" />Wishlist</Link>
            <Link to={storefrontPath(store.slug, "account")} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"><User className="h-4 w-4" />My Account</Link>
          </nav>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function StorefrontSkeleton() {
  return (
    <div className="min-h-screen bg-background font-sans">
      <div className="h-8 bg-muted/50" />
      <nav className="sticky top-0 z-30 border-b bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Skeleton className="h-10 w-10 rounded-lg" /><Skeleton className="h-10 w-24 rounded-lg" /><div className="flex-1" />
          <Skeleton className="h-9 w-9 rounded-full" /><Skeleton className="h-9 w-9 rounded-full" /><Skeleton className="h-9 w-9 rounded-full" />
        </div>
      </nav>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <Skeleton className="mb-5 h-7 w-40" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card">
              <Skeleton className="w-full" style={{ aspectRatio: "4/5" }} />
              <div className="px-2.5 pb-2.5 pt-2 space-y-2"><Skeleton className="h-3 w-16" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-20" /><Skeleton className="h-9 w-full rounded-lg" /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CheckoutAwareLayout({ store, marqueeText, marqueeEnabled, headerLogoAlignment = "left", mobileNavEnabled = false, mobileNavStyle = "classic", headerStyle = "normal" }: { store: StoreData; marqueeText?: string; marqueeEnabled?: boolean; headerLogoAlignment?: string; mobileNavEnabled?: boolean; mobileNavStyle?: string; headerStyle?: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isCheckout = location.pathname.includes("/checkout");
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const queryClient = useQueryClient();
  const products = queryClient.getQueryData<any[]>(["storefront-products", store.id]);

  useEffect(() => { prefetchStorefrontRoutes(); }, []);

  useEffect(() => {
    const handler = () => setOrderPlaced(true);
    window.addEventListener("order-placed", handler);
    return () => window.removeEventListener("order-placed", handler);
  }, []);

  useEffect(() => { if (!isCheckout) setOrderPlaced(false); }, [isCheckout]);

  const handleBackClick = () => { if (orderPlaced) { navigate(storefrontPath(store.slug)); return; } setShowExitDialog(true); };
  const handleExitConfirm = () => { setShowExitDialog(false); navigate(storefrontPath(store.slug, "cart")); };

  const isCentered = headerLogoAlignment === "center";
  const isWithSearch = headerLogoAlignment === "left-with-search";

  const LogoElement = (
    <Link to={storefrontPath(store.slug)} className="flex-shrink-0 min-w-0" aria-label={`${store.name} home`}>
      {store.logo_url ? (
        <img src={store.logo_url} alt={store.name} width={160} height={48} className="h-10 sm:h-12 w-auto max-w-[120px] sm:max-w-[160px] object-contain" loading="eager" decoding="sync" fetchPriority="high" />
      ) : (
        <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary"><Store className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" aria-hidden="true" /></div>
      )}
    </Link>
  );

  const hideWishlistAndShare = isCentered || isWithSearch;

  const ActionButtons = !isCheckout ? (
    <div className="flex items-center gap-0 sm:gap-1" style={{ minHeight: 40, contain: "layout" }}>
      <AccountBadge slug={store.slug} />
      {!hideWishlistAndShare && <WishlistBadge slug={store.slug} />}
      <CartBadge />
      {!hideWishlistAndShare && <ShareStoreDialog storeSlug={store.slug} storeName={store.name} customDomain={(store as any).custom_domain} iconOnly />}
    </div>
  ) : null;

  return (
    <>
      {marqueeEnabled !== false && <StorefrontMarquee text={marqueeText} />}

      {/* Desktop nav bar — hidden on mobile, hidden during checkout */}
      {!isCheckout && (
        <Suspense fallback={null}>
          <LazyDesktopNavBar store={store} onSearchOpen={() => setSearchOpen(true)} />
        </Suspense>
      )}

      {/* Mobile header + checkout header */}
      <nav className={`${isCheckout ? 'sticky top-0' : 'md:hidden'} ${mobileNavEnabled && headerStyle === 'normal' ? 'sm:sticky sm:top-0' : isCheckout ? '' : 'sticky top-0'} z-30 ${
        isCheckout ? 'bg-card/80 backdrop-blur-md' :
        headerStyle === 'transparent' ? '' :
        headerStyle === 'glassmorphic' ? '' :
        'bg-card/80 backdrop-blur-md'
      }`}
        style={!isCheckout && headerStyle === 'glassmorphic' ? {
          background: 'rgba(255,255,255,0.12)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderRadius: '0 0 1rem 1rem',
          border: '1px solid rgba(255,255,255,0.18)',
          margin: '0 8px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
        } : undefined}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-1.5 sm:gap-3 px-2 sm:px-4">
          {isCheckout ? (
            <>
              <Button variant="ghost" size="icon" className="h-10 w-10 p-0" onClick={handleBackClick} aria-label="Go back">
                <ArrowLeft className="h-5 w-5 text-foreground" strokeWidth={2.5} aria-hidden="true" />
              </Button>
              {LogoElement}
              <span className="text-sm font-semibold text-foreground" style={{ fontFamily: "'Montserrat', sans-serif" }}>Checkout</span>
              <div className="flex-1" />
            </>
          ) : isCentered ? (
            <>
              <HamburgerMenu store={store} />
              <div className="flex-1" />
              <div className="absolute left-1/2 -translate-x-1/2">{LogoElement}</div>
              <div className="flex-1" />
              {ActionButtons}
            </>
          ) : isWithSearch ? (
            <>
              <HamburgerMenu store={store} />
              {LogoElement}
              <button
                onClick={() => setSearchOpen(true)}
                className="flex-1 mx-2 flex items-center gap-2 rounded-full border border-border bg-accent/50 px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent transition-colors"
                aria-label="Search products"
              >
                <Search className="h-3.5 w-3.5" />
                <span className="truncate">Search products...</span>
              </button>
              {ActionButtons}
            </>
          ) : (
            <>
              <HamburgerMenu store={store} />
              {LogoElement}
              <div className="flex-1" />
              {ActionButtons}
            </>
          )}
        </div>
      </nav>

      {/* Lazy search overlay */}
      {searchOpen && (
        <Suspense fallback={null}>
          <LazySearchOverlay
            open={searchOpen}
            onClose={() => setSearchOpen(false)}
            products={products}
            slug={store.slug}
            storeId={store.id}
          />
        </Suspense>
      )}

      <main className={mobileNavEnabled ? "pb-14 sm:pb-0" : ""}><Suspense fallback={<StorefrontContentSkeleton />}><Outlet context={store} /></Suspense></main>
      {mobileNavEnabled && (
        <Suspense fallback={null}>
          {mobileNavStyle === "modern" ? <LazyMobileBottomNavModern store={store} /> : <LazyMobileBottomNav store={store} />}
        </Suspense>
      )}
      <StorefrontFooter store={store} />

      <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <DialogContent className="max-w-[320px] rounded-2xl p-0 overflow-hidden">
          <button onClick={() => setShowExitDialog(false)} className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-accent/80 text-muted-foreground hover:text-foreground hover:scale-110 active:scale-95 transition-all" aria-label="Close dialog"><X className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" /></button>
          <div className="p-6 pt-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-warning/10"><ArrowLeft className="h-5 w-5 text-warning" /></div>
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-base font-bold text-foreground">Exit checkout?</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">Are you sure you want to leave? Your order details won't be saved.</DialogDescription>
            </DialogHeader>
            <div className="mt-5 flex flex-col gap-2">
              <Button variant="outline" className="w-full border-destructive/30 text-destructive hover:bg-destructive/5 font-semibold text-xs" onClick={handleExitConfirm}>Yes, exit checkout</Button>
              <Button className="w-full font-semibold text-xs" onClick={() => setShowExitDialog(false)}>No, continue checkout</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function StorefrontLayout({ slugOverride }: { slugOverride?: string } = {}) {
  return (
    <StorefrontShell
      slugOverride={slugOverride}
      showExitIntent
      skeleton={<StorefrontSkeleton />}
    >
      {({ store, themeConfig }) => (
        <CheckoutAwareLayout
          store={store}
          marqueeText={themeConfig?.marquee_text}
          marqueeEnabled={themeConfig?.marquee_enabled ?? true}
          headerLogoAlignment={themeConfig?.header_logo_alignment || "left"}
          mobileNavEnabled={themeConfig?.mobile_nav_enabled ?? false}
          headerStyle={themeConfig?.header_style || "normal"}
        />
      )}
    </StorefrontShell>
  );
}
