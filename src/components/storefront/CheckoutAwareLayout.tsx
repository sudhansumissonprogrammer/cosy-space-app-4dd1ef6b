/**
 * Shared layout for themes with checkout-aware header (V1, V14, V15).
 * Renders: marquee (optional), desktop nav, mobile header with logo alignment variants,
 * mobile bottom nav, footer, search overlay, and checkout exit dialog.
 */
import { useState, useEffect, Suspense, lazy, type ReactNode } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Search } from "lucide-react";
import StoreTextLogo from "@/components/storefront/StoreTextLogo";
import { Button } from "@/components/ui/button";
import type { Tables } from "@/integrations/supabase/types";
import { CartBadge, WishlistBadge, AccountBadge } from "@/components/storefront/HeaderBadges";
import { useSmartHeader } from "@/hooks/useSmartHeader";
import PageTransition from "@/components/storefront/PageTransition";

const LazyShareStoreDialog = lazy(() => import("@/components/ShareStoreDialog"));
import { StorefrontContentSkeleton } from "@/components/ContentSkeleton";
import { storefrontPath } from "@/lib/subdomain";

const LazySearchOverlay = lazy(() => import("@/components/storefront/StorefrontSearchOverlay"));
const LazyDesktopNavBar = lazy(() => import("@/components/storefront/DesktopNavBar"));
const LazyHamburgerMenu = lazy(() => import("@/components/storefront/HamburgerMenu"));
const LazyCheckoutExitDialog = lazy(() => import("@/components/storefront/CheckoutExitDialog"));
const LazyStorefrontFooter = lazy(() => import("@/components/storefront/StorefrontFooter"));

type StoreData = Tables<"stores">;

interface CheckoutAwareLayoutProps {
  store: StoreData;
  /** Optional marquee element to render above the header */
  marquee?: ReactNode;
  headerLogoAlignment?: string;
  mobileNavEnabled?: boolean;
  /** Component to render as mobile bottom nav */
  mobileNav?: ReactNode;
  headerStyle?: string;
}

export default function CheckoutAwareLayout({
  store,
  marquee,
  headerLogoAlignment = "left",
  mobileNavEnabled = false,
  mobileNav,
  headerStyle = "normal",
}: CheckoutAwareLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isCheckout = location.pathname.includes("/checkout");
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const queryClient = useQueryClient();
  const products = queryClient.getQueryData<any[]>(["storefront-products", store.id]);
  const headerVisible = useSmartHeader();

  useEffect(() => {
    // Defer route prefetching by 3s to keep critical path fast
    const timer = setTimeout(() => {
      import("@/lib/prefetchStorefrontRoutes").then(m => m.prefetchStorefrontRoutes());
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handler = () => setOrderPlaced(true);
    window.addEventListener("order-placed", handler);
    return () => window.removeEventListener("order-placed", handler);
  }, []);

  useEffect(() => { if (!isCheckout) setOrderPlaced(false); }, [isCheckout]);

  // ShipRocket-style checkout lock: prevent refresh, back button, and tab close
  useEffect(() => {
    if (!isCheckout || orderPlaced) return;

    // 1. Warn on refresh / tab close
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "You have an active checkout. Are you sure you want to leave?";
      return e.returnValue;
    };

    // 2. Push fake history entries to intercept browser back button
    window.history.pushState({ checkoutLock: true }, "");
    window.history.pushState({ checkoutLock: true }, "");

    const handlePopState = (e: PopStateEvent) => {
      // Re-push state to keep user on page and show exit dialog
      window.history.pushState({ checkoutLock: true }, "");
      setShowExitDialog(true);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isCheckout, orderPlaced]);

  const handleBackClick = () => { if (orderPlaced) { navigate(storefrontPath(store.slug)); return; } setShowExitDialog(true); };
  const handleExitConfirm = () => { setShowExitDialog(false); navigate(storefrontPath(store.slug, "cart")); };

  const isCentered = headerLogoAlignment === "center";
  const isWithSearch = headerLogoAlignment === "left-with-search";

  const LogoElement = (
    <Link to={storefrontPath(store.slug)} className="flex-shrink-0 min-w-0" aria-label={`${store.name} home`}>
      {store.logo_url ? (
        <img src={store.logo_url} alt={store.name} width={200} height={56} className="h-12 sm:h-14 w-auto max-w-[160px] sm:max-w-[200px] object-contain" loading="eager" decoding="sync" fetchPriority="high" />
      ) : (
        <StoreTextLogo storeName={store.name} size="text-lg" />
      )}
    </Link>
  );

  const hideWishlistAndShare = isCentered || isWithSearch;

  const ActionButtons = !isCheckout ? (
    <div className="flex items-center gap-0 sm:gap-1" style={{ minHeight: 40, contain: "layout" }}>
      <AccountBadge slug={store.slug} />
      {!hideWishlistAndShare && <WishlistBadge slug={store.slug} />}
      <CartBadge />
      {!hideWishlistAndShare && <Suspense fallback={null}><LazyShareStoreDialog storeSlug={store.slug} storeName={store.name} customDomain={(store as any).custom_domain} iconOnly /></Suspense>}
    </div>
  ) : null;

  return (
    <>
      {!isCheckout && marquee}

      {/* Desktop nav bar — hidden on mobile, hidden during checkout */}
      {!isCheckout && (
        <Suspense fallback={null}>
          <LazyDesktopNavBar store={store} onSearchOpen={() => setSearchOpen(true)} />
        </Suspense>
      )}

      {/* Mobile header + checkout header */}
      <nav className={`${isCheckout ? 'sticky top-0' : 'md:hidden'} ${mobileNavEnabled && headerStyle === 'normal' ? 'sm:sticky sm:top-0' : isCheckout ? '' : 'sticky top-0'} z-30 smart-header ${!isCheckout && !headerVisible ? 'smart-header-hidden' : ''} ${
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
        <div className={`mx-auto flex ${isCheckout ? 'h-11' : 'h-14'} max-w-6xl items-center gap-1.5 sm:gap-3 px-2 sm:px-4`}>
          {isCheckout ? (
            <>
              <Button variant="ghost" size="icon" className="h-10 w-10 p-0" onClick={handleBackClick} aria-label="Go back">
                <ArrowLeft className="h-5 w-5 text-foreground" strokeWidth={2.5} aria-hidden="true" />
              </Button>
              {LogoElement}
              <span className="text-sm font-semibold text-foreground" style={{ fontFamily: "'Montserrat', sans-serif" }}>{store.theme === "theme-16" ? "Checkout / चेकआउट" : "Checkout"}</span>
              <div className="flex-1" />
            </>
          ) : isCentered ? (
            <>
              <Suspense fallback={null}><LazyHamburgerMenu store={store} /></Suspense>
              <div className="flex-1" />
              <div className="absolute left-1/2 -translate-x-1/2">{LogoElement}</div>
              <div className="flex-1" />
              {ActionButtons}
            </>
          ) : isWithSearch ? (
            <>
              <Suspense fallback={null}><LazyHamburgerMenu store={store} /></Suspense>
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
              <Suspense fallback={null}><LazyHamburgerMenu store={store} /></Suspense>
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

      <main className={mobileNavEnabled ? "pb-14 sm:pb-0" : ""}><Suspense fallback={<StorefrontContentSkeleton />}><PageTransition><Outlet context={store} /></PageTransition></Suspense></main>
      {mobileNavEnabled && mobileNav}
      <Suspense fallback={null}><LazyStorefrontFooter store={store} /></Suspense>

      <Suspense fallback={null}>
        <LazyCheckoutExitDialog
          open={showExitDialog}
          onOpenChange={setShowExitDialog}
          onConfirmExit={handleExitConfirm}
        />
      </Suspense>
    </>
  );
}
