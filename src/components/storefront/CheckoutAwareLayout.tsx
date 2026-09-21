/**
 * Shared layout for themes with checkout-aware header (V1, V14, V15).
 * Renders: marquee (optional), desktop nav, mobile header with logo alignment variants,
 * mobile bottom nav, footer, search overlay, and checkout exit dialog.
 */
import { useState, useEffect, Suspense, lazy, useRef, type ReactNode } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import StoreTextLogo from "@/components/storefront/StoreTextLogo";
import { Button } from "@/components/ui/button";
import type { Tables } from "@/integrations/supabase/types";
import { WishlistBadge, AccountBadge, CartBadge } from "@/components/storefront/HeaderBadges";
import HeaderWhatsAppButton from "@/components/storefront/HeaderWhatsAppButton";

import PremiumHeaderBadge from "@/components/storefront/PremiumHeaderBadge";
import { useNavIcons } from "@/hooks/useNavIcons";

import { useSmartHeader } from "@/hooks/useSmartHeader";
import PageTransition from "@/components/storefront/PageTransition";
import ScrollProgressBar from "@/components/storefront/ScrollProgressBar";

const LazyShareStoreDialog = lazy(() => import("@/components/ShareStoreDialog"));
import { StorefrontContentSkeleton } from "@/components/ContentSkeleton";
import { storefrontPath } from "@/lib/subdomain";
import { useStorefrontThemeConfig } from "@/hooks/useStorefrontThemeConfig";
import { resolveHeaderColors } from "@/lib/headerTheme";


const LazySfDarkToggle = lazy(() => import("@/components/storefront/SfDarkToggle"));
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
  /** Custom header className override (e.g. for transparent-to-solid scroll) */
  headerClassName?: string;
  /** Replace account icon with search icon in mobile header */
  useSearchInHeader?: boolean;
  /** Custom cart icon JSX to replace default CartBadge */
  customCartIcon?: ReactNode;
  /** Override header background color (e.g. "#0a0a0a" for dark themes) */
  headerBgOverride?: string;
  /** Override header icon color (e.g. "#ffffff" for dark themes) */
  headerIconColor?: string;
  /** Show the golden "Premium Product · Guaranteed" trust medallion in the mobile header */
  showPremiumBadge?: boolean;
  /**
   * Theme-16 only: put the CART icon in the mobile header (where WhatsApp
   * normally sits) and move the WhatsApp button into the bottom nav.
   */
  swapCartWhatsApp?: boolean;
  /** Theme-16 only: show the Dark Streetwear night-mode toggle in the header */
  showDarkToggle?: boolean;
  /** Merchant-chosen night-mode switch animation (theme setting) */
  darkToggleEffect?: string | null;
  /** Keep mobile and desktop headers visible while the shopper scrolls. */
  fixedHeader?: boolean;
}

export default function CheckoutAwareLayout({
  store,
  marquee,
  headerLogoAlignment = "left",
  mobileNavEnabled = false,
  mobileNav,
  headerStyle = "normal",
  headerClassName,
  useSearchInHeader = false,
  customCartIcon,
  headerBgOverride,
  headerIconColor,
  showPremiumBadge = false,
  swapCartWhatsApp = false,
  showDarkToggle = false,
  darkToggleEffect,
  fixedHeader = false,
}: CheckoutAwareLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isCheckout = location.pathname.includes("/checkout");
  // Merchant-chosen header colour (Theme Settings → Header & Nav).
  // Theme-supplied overrides (e.g. dark themes) still win.
  const layoutThemeConfig = useStorefrontThemeConfig(store.id);
  const customHeader = resolveHeaderColors(layoutThemeConfig);
  const headerBg = headerBgOverride ?? customHeader.bg;
  const headerFg = headerIconColor ?? customHeader.fg;

  const [showExitDialog, setShowExitDialog] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [paymentInProgress, setPaymentInProgress] = useState(false);
  const paymentInProgressRef = useRef(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const queryClient = useQueryClient();
  const products = queryClient.getQueryData<any[]>(["storefront-products", store.id]);
  const headerVisible = useSmartHeader();
  const getHeaderIcon = useNavIcons(store.id);
  const SearchIcon = getHeaderIcon("search");
  // Every store now runs the single modern checkout, which renders its own header.
  const checkoutOwnsHeader = isCheckout;

  useEffect(() => {
    // v8: Defer route prefetching by 1.2s (was 3s). Internally uses
    // requestIdleCallback so it still won't block FCP/LCP, but is ready
    // before users typically tap their first category/product.
    const timer = setTimeout(() => {
      import("@/lib/prefetchStorefrontRoutes").then(m => m.prefetchStorefrontRoutes());
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handler = () => setOrderPlaced(true);
    const startHandler = () => { paymentInProgressRef.current = true; setPaymentInProgress(true); };
    const endHandler = () => { paymentInProgressRef.current = false; setPaymentInProgress(false); };
    window.addEventListener("order-placed", handler);
    window.addEventListener("payment-in-progress", startHandler);
    window.addEventListener("payment-ended", endHandler);
    return () => {
      window.removeEventListener("order-placed", handler);
      window.removeEventListener("payment-in-progress", startHandler);
      window.removeEventListener("payment-ended", endHandler);
    };
  }, []);

  useEffect(() => { if (!isCheckout) { setOrderPlaced(false); paymentInProgressRef.current = false; setPaymentInProgress(false); } }, [isCheckout]);

  // ShipRocket-style checkout lock: prevent refresh, back button, and tab close
  useEffect(() => {
    if (!isCheckout || orderPlaced || paymentInProgress) return;

    // 1. Warn on refresh / tab close
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (paymentInProgressRef.current) return;
      e.preventDefault();
      e.returnValue = "You have an active checkout. Are you sure you want to leave?";
      return e.returnValue;
    };

    // v8.61.0 BAN-FIX P1-6: removed double history.pushState + popstate
    // intercept. Meta's manual landing-page review classifies back-button
    // trapping as "manipulative navigation" — a documented prohibited
    // dark pattern and a strong negative signal in ad-account reviews.
    // The beforeunload warning above is standard browser behavior and
    // perfectly acceptable; exit-intent UI should live in a visible
    // dialog, not via browser-navigation hijacking.

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isCheckout, orderPlaced, paymentInProgress]);

  const handleBackClick = () => { if (orderPlaced) { navigate(storefrontPath(store.slug)); return; } setShowExitDialog(true); };
  const handleExitConfirm = () => { setShowExitDialog(false); navigate(storefrontPath(store.slug, "cart")); };

  const isCentered = headerLogoAlignment === "center";
  const isWithSearch = headerLogoAlignment === "left-with-search";

  // Verified tick only renders when the store has NO uploaded logo (text logo),
  // and the merchant enabled the "Verified badge" toggle in Theme Settings.
  const showVerifiedTick = showPremiumBadge && !store.logo_url;

  const LogoElement = (
    <Link to={storefrontPath(store.slug)} className="flex items-center gap-1 flex-shrink-0 min-w-0" aria-label={`${store.name} home`}>
      {store.logo_url ? (
        <img src={store.logo_url} alt={store.name} width={200} height={56} className="h-12 sm:h-14 w-auto max-w-[160px] sm:max-w-[200px] object-contain" loading="eager" decoding="sync" fetchPriority="high" />
      ) : (
        <>
          <StoreTextLogo storeName={store.name} size="text-lg" />
          {showVerifiedTick && <PremiumHeaderBadge />}
        </>
      )}
    </Link>
  );

  const hideWishlistAndShare = isCentered || isWithSearch;

  const iconStyle = headerFg ? ({ color: headerFg, "--storefront-text": headerFg } as any) : undefined;
  const iconSize = headerIconColor ? "h-6 w-6" : "h-5 w-5";

  const ActionButtons = !isCheckout ? (
    <div className="flex items-center gap-1 sm:gap-2" style={{ minHeight: 40, contain: "layout", ...(iconStyle || {}) }}>
      {showDarkToggle && (
        <Suspense fallback={<div className="h-8 w-8" aria-hidden />}>
          <LazySfDarkToggle effect={darkToggleEffect} />
        </Suspense>
      )}
      {useSearchInHeader ? (
        <button onClick={() => setSearchOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-md transition-opacity hover:opacity-70" aria-label="Search products" style={iconStyle}>
          <SearchIcon className={iconSize} />
        </button>
      ) : swapCartWhatsApp ? (
        <CartBadge storeId={store.id} />
      ) : (
        <HeaderWhatsAppButton
          storeName={store.name}
          whatsappNumber={(store as any).whatsapp_number}
          className="flex h-10 w-10 items-center justify-center rounded-md transition-opacity hover:opacity-70"
          iconClassName={iconSize}
        />

      )}
      {!hideWishlistAndShare && <WishlistBadge slug={store.slug} storeId={store.id} />}
      {!hideWishlistAndShare && <Suspense fallback={null}><LazyShareStoreDialog storeSlug={store.slug} storeName={store.name} customDomain={(store as any).custom_domain} iconOnly /></Suspense>}
    </div>
  ) : null;

  return (
    <>
      <ScrollProgressBar />
      {!isCheckout && marquee}

      {/* Desktop nav bar — hidden on mobile, hidden during checkout */}
      {!isCheckout && (
        <Suspense fallback={null}>
          <LazyDesktopNavBar store={store} onSearchOpen={() => setSearchOpen(true)} alwaysVisible={fixedHeader} extra={showDarkToggle ? <Suspense fallback={<div className="h-9 w-9" aria-hidden />}><LazySfDarkToggle size={30} effect={darkToggleEffect} /></Suspense> : undefined} style={headerBg ? ({ backgroundColor: headerBg, color: headerFg || undefined, "--storefront-text": headerFg || undefined, borderBottom: `1px solid ${headerFg || '#fff'}12` } as any) : undefined} />
        </Suspense>
      )}

      {/* Mobile header + legacy checkout header. Checkout V2 renders its own header. */}
      {!checkoutOwnsHeader && <nav className={`${isCheckout ? 'sticky top-0' : 'md:hidden'} ${fixedHeader ? 'sticky top-0' : mobileNavEnabled && headerStyle === 'normal' ? 'sm:sticky sm:top-0' : isCheckout ? '' : 'sticky top-0'} z-30 smart-header ${!isCheckout && !fixedHeader && !headerVisible ? 'smart-header-hidden' : ''} ${
        headerClassName ? headerClassName :
        headerBg ? '' :
        isCheckout ? '' :
        headerStyle === 'transparent' ? '' :
        headerStyle === 'glassmorphic' ? '' :
        ''
      }`}
        style={
          headerBg && !isCheckout ? ({ backgroundColor: headerBg, color: headerFg || undefined, "--storefront-text": headerFg || undefined } as any) :
          headerClassName ? {} :
          isCheckout ? { backgroundColor: "color-mix(in srgb, var(--storefront-bg, hsl(var(--card))) 85%, transparent)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" } :
          !isCheckout && headerStyle === 'glassmorphic' ? {
            background: 'rgba(255,255,255,0.12)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            borderRadius: '0 0 1rem 1rem',
            border: '1px solid rgba(255,255,255,0.18)',
            margin: '0 8px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
          } :
          headerStyle !== 'transparent' ? { backgroundColor: "color-mix(in srgb, var(--storefront-bg, hsl(var(--card))) 85%, transparent)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" } :
          undefined
        }
      >
        <div className={`mx-auto flex ${isCheckout ? 'h-11' : 'h-14'} max-w-7xl items-center gap-1.5 sm:gap-3 px-3 sm:px-4 lg:px-6`}>
          {isCheckout ? (
            <>
              <Button variant="ghost" size="icon" className="h-10 w-10 p-0" onClick={handleBackClick} aria-label="Go back">
                <ArrowLeft className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }} />
              </Button>
              {LogoElement}
              <span className="text-sm font-semibold" style={{ color: "var(--storefront-text, hsl(var(--foreground)))", fontFamily: "'Montserrat Alternates', sans-serif" }}>Checkout</span>
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
                className="flex-1 mx-2 flex items-center gap-2 rounded-full px-3 py-1.5 text-xs transition-colors" style={{ border: "1px solid color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 12%, transparent)", backgroundColor: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 5%, transparent)", color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 55%, transparent)" }}
                aria-label="Search products"
              >
                <SearchIcon className="h-3.5 w-3.5" />
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
      </nav>}

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

      <main className={mobileNavEnabled && !isCheckout ? "pb-16 sm:pb-0" : ""}><Suspense fallback={<StorefrontContentSkeleton />}><PageTransition><Outlet context={store} /></PageTransition></Suspense></main>
      {mobileNavEnabled && !isCheckout && mobileNav}
      {!isCheckout && (
        <Suspense fallback={<div aria-hidden className="mt-16" style={{ minHeight: "600px" }} />}>
          <LazyStorefrontFooter store={store} />
        </Suspense>
      )}

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
