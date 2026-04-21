/**
 * Theme 19 — Quick Commerce Grocery (Blinkit-style)
 * Fully responsive: mobile-first stays Blinkit, desktop expands to wide layout.
 */
import { Suspense, lazy, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import StorefrontShell from "@/layouts/StorefrontShell";
import V19Header from "@/components/storefront/v19/V19Header";
import PageTransition from "@/components/storefront/PageTransition";
import { prefetchStorefrontRoutes } from "@/lib/prefetchStorefrontRoutes";

const LazyV19BottomNav = lazy(() => import("@/components/storefront/v19/V19BottomNav"));
const LazyV19DesktopCartFab = lazy(() => import("@/components/storefront/v19/V19DesktopCartFab"));

const V19_STYLES = `
  .storefront-font, .storefront-font * {
    font-family: 'Okra', 'Mulish', 'Helvetica Neue', Helvetica, Arial, sans-serif !important;
    font-weight: 600;
  }
  .storefront-font { color: #0f0f0f; }
  body { background: #f6f7f9 !important; color: #0f0f0f; }
  .v19-section-title { display: flex; align-items: center; justify-content: space-between; padding: 0 4px; margin-bottom: 10px; }
  .v19-section-title h3 { font-size: 18px; font-weight: 900; color: #0a0a0a; letter-spacing: -0.01em; }
  @media (min-width: 1024px) { .v19-section-title h3 { font-size: 22px; } }
  .v19-section-title a { font-size: 13px; font-weight: 800; color: var(--storefront-primary, #036B52); display: inline-flex; align-items: center; gap: 2px; }
  .v19-cat-strip { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; margin-bottom: 12px; border-radius: 12px; background: linear-gradient(135deg, var(--storefront-primary, #036B52) 0%, color-mix(in srgb, var(--storefront-primary, #036B52) 75%, #000) 100%); color: #ffffff; box-shadow: 0 4px 14px -4px color-mix(in srgb, var(--storefront-primary, #036B52) 50%, transparent); transition: transform 0.15s ease, box-shadow 0.15s ease; text-decoration: none; border: 1px solid rgba(255,255,255,0.1); }
  .v19-cat-strip:hover { box-shadow: 0 6px 18px -4px color-mix(in srgb, var(--storefront-primary, #036B52) 60%, transparent); }
  .v19-cat-strip:active { transform: scale(0.99); }
  .v19-cat-strip-title { font-size: 16px; font-weight: 800; letter-spacing: -0.01em; color: #ffffff; line-height: 1.2; }
  @media (min-width: 1024px) { .v19-cat-strip { padding: 14px 20px; } .v19-cat-strip-title { font-size: 19px; } }
  .v19-cat-strip-cta { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 800; padding: 7px 14px; border-radius: 999px; background: #ffffff; color: var(--storefront-primary, #036B52); white-space: nowrap; transition: filter 0.15s ease, transform 0.15s ease; box-shadow: 0 2px 8px -2px rgba(0,0,0,0.2); }
  .v19-cat-strip:hover .v19-cat-strip-cta { filter: brightness(1.05); transform: translateX(2px); }
  .v19-view-all-card { display: block; text-decoration: none; }
  .v19-view-all-inner { aspect-ratio: 3 / 4; border-radius: 14px; background: linear-gradient(160deg, var(--storefront-primary, #036B52) 0%, color-mix(in srgb, var(--storefront-primary, #036B52) 70%, #000) 100%); color: #ffffff; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 14px; text-align: center; transition: transform 0.18s ease, box-shadow 0.18s ease; box-shadow: 0 4px 14px -4px color-mix(in srgb, var(--storefront-primary, #036B52) 50%, transparent); border: 1px solid rgba(255,255,255,0.1); }
  .v19-view-all-card:hover .v19-view-all-inner { transform: translateY(-3px); box-shadow: 0 8px 20px -4px color-mix(in srgb, var(--storefront-primary, #036B52) 60%, transparent); }
  .v19-view-all-arrow { width: 56px; height: 56px; border-radius: 999px; background: #ffffff; color: var(--storefront-primary, #036B52); display: inline-flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px -2px rgba(0,0,0,0.25); transition: transform 0.18s ease; }
  .v19-view-all-card:hover .v19-view-all-arrow { transform: scale(1.08); }
  .v19-view-all-text { font-size: 16px; font-weight: 900; letter-spacing: -0.01em; color: #ffffff; }
  .v19-view-all-sub { font-size: 12px; font-weight: 600; opacity: 0.85; color: #ffffff; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .v19-cat-circle { display: flex; flex-direction: column; align-items: center; gap: 6px; cursor: pointer; }
  .v19-cat-circle .circle { width: 100%; padding-top: 100%; border-radius: 14px; position: relative; overflow: hidden; transition: transform 0.18s ease, box-shadow 0.18s ease; }
  @media (hover: hover) { .v19-cat-circle:hover .circle { transform: translateY(-2px); box-shadow: 0 6px 16px -6px rgba(0,0,0,0.18); } }
  .v19-cat-circle .label { font-size: 12px; font-weight: 700; color: #0a0a0a; text-align: center; line-height: 1.25; max-width: 100%; }
  .v19-promo-card { flex-shrink: 0; border-radius: 16px; overflow: hidden; padding: 18px; color: #0a0a0a; min-height: 130px; display: flex; flex-direction: column; justify-content: space-between; scroll-snap-align: start; }
  .v19-promo-card h2 { font-size: 22px; font-weight: 900; line-height: 1.05; color: #0a0a0a; }
  .v19-promo-card p { font-size: 13px; font-weight: 600; opacity: 0.85; margin-top: 4px; color: #0a0a0a; }
  .v19-promo-card .cta { background: var(--storefront-primary, #036B52); color: #fff; font-weight: 800; font-size: 13px; padding: 6px 14px; border-radius: 999px; display: inline-block; align-self: flex-start; margin-top: 10px; }
  .v19-card { background: #fff; border-radius: 12px; padding: 8px; border: 1px solid #f0f0f0; transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease; }
  @media (hover: hover) and (min-width: 768px) {
    .v19-card:hover { transform: translateY(-3px); box-shadow: 0 10px 24px -10px rgba(0,0,0,0.18); border-color: #e2e2e2; }
  }
  .v19-add-btn-outline { background: #fff; color: var(--storefront-primary, #036B52); font-weight: 900; font-size: 13px; letter-spacing: 0.3px; padding: 6px 18px; border-radius: 8px; text-transform: uppercase; border: 1.5px solid var(--storefront-primary, #036B52); }
  .v19-add-btn-outline:disabled { background: #f3f4f6; color: #9ca3af; border-color: #e5e7eb; cursor: not-allowed; }
  .v19-stepper { background: var(--storefront-primary, #036B52); color: #fff; border-radius: 8px; display: inline-flex; align-items: center; font-weight: 800; font-size: 14px; overflow: hidden; }
  .v19-stepper button { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; }
  .v19-delivery-badge { position: absolute; left: 6px; top: 6px; z-index: 10; background: #fff; color: var(--storefront-primary, #036B52); font-size: 10px; font-weight: 900; padding: 2px 5px; border-radius: 4px; display: inline-flex; align-items: center; gap: 2px; box-shadow: 0 1px 2px rgba(0,0,0,0.08); letter-spacing: 0.3px; }
  .v19-stock-badge { position: absolute; right: 6px; top: 6px; z-index: 10; font-size: 10px; font-weight: 900; padding: 2px 6px; border-radius: 4px; letter-spacing: 0.3px; }
  .v19-stock-low { background: #FEF2E2; color: #B25C00; }
  .v19-stock-out { background: #FEE2E2; color: #B91C1C; }
  .v19-marquee-yellow { background: #FFD33D; color: var(--storefront-primary, #036B52); font-weight: 900; font-size: 12px; padding: 7px 0; overflow: hidden; white-space: nowrap; letter-spacing: 0.4px; }
  /* Add-to-cart micro-interactions */
  .v19-add-success { background: var(--storefront-primary, #036B52) !important; color: var(--storefront-btn-text, #fff) !important; border-color: var(--storefront-primary, #036B52) !important; transform: scale(1.05); }
  [data-cart-target] { position: relative; }
  [data-cart-target]::after {
    content: ""; position: absolute; inset: -4px; border-radius: 999px;
    border: 2px solid var(--storefront-primary, #036B52);
    opacity: 0; pointer-events: none; transform: scale(0.8);
  }
  [data-cart-target].cart-target-absorb { animation: v19-cart-pop 460ms cubic-bezier(.34,1.56,.64,1); }
  [data-cart-target].cart-target-absorb::after { animation: v19-cart-ping 600ms ease-out; }
  @keyframes v19-cart-pop {
    0% { transform: scale(1); }
    35% { transform: scale(1.18); }
    70% { transform: scale(0.95); }
    100% { transform: scale(1); }
  }
  @keyframes v19-cart-ping {
    0% { opacity: 0.85; transform: scale(0.85); }
    100% { opacity: 0; transform: scale(1.6); }
  }
  @media (prefers-reduced-motion: reduce) {
    [data-cart-target].cart-target-absorb,
    [data-cart-target].cart-target-absorb::after,
    .v19-add-success { animation: none !important; transform: none !important; }
  }
  .storefront-font main { padding-top: 0; padding-bottom: 80px; }
  @media (min-width: 768px) { .storefront-font main { padding-bottom: 24px; } }
  .scrollbar-hide::-webkit-scrollbar { display: none; }
  .scrollbar-hide { scrollbar-width: none; }
  /* Desktop carousel arrows */
  .v19-carousel-arrow {
    position: absolute; top: 50%; transform: translateY(-50%);
    width: 36px; height: 36px; border-radius: 999px;
    background: #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    display: none; align-items: center; justify-content: center;
    z-index: 5; color: var(--storefront-primary, #036B52);
  }
  @media (hover: hover) and (min-width: 1024px) {
    .v19-carousel-wrap:hover .v19-carousel-arrow { display: flex; }
  }
  .v19-carousel-arrow.left { left: 4px; }
  .v19-carousel-arrow.right { right: 4px; }
  /* Promo card responsive widths (lifted out of inline <style> to avoid re-mount churn) */
  .v19-promo-card { width: 78%; max-width: 320px; }
  @media (min-width: 640px) { .v19-promo-card { width: 45%; max-width: 360px; } }
  @media (min-width: 768px) { .v19-promo-card { width: 32%; max-width: 360px; } }
  @media (min-width: 1024px) { .v19-promo-card { width: 24%; max-width: 320px; min-height: 160px; } }
`;

if (typeof document !== "undefined" && !document.getElementById("v19-theme-styles")) {
  const styleEl = document.createElement("style");
  styleEl.id = "v19-theme-styles";
  styleEl.textContent = V19_STYLES;
  document.head.appendChild(styleEl);
  // Non-blocking font load (preconnect already handled by shell loadGoogleFonts in most cases)
  if (!document.getElementById("v19-mulish-font")) {
    const link = document.createElement("link");
    link.id = "v19-mulish-font";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Mulish:wght@400;500;600;700;800;900&display=swap";
    link.media = "print";
    link.onload = () => { link.media = "all"; };
    document.head.appendChild(link);
  }
}

/** Empty fallback — Shell already renders a skeleton, this prevents double-flash. */
function V19RouteSkeleton() {
  return <div className="min-h-[200px]" />;
}

function V19Inner({ store }: { store: any }) {
  const location = useLocation();
  const isProductDetail = /\/product\/[^/]+/.test(location.pathname);

  useEffect(() => {
    const t = setTimeout(() => prefetchStorefrontRoutes(), 1500);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      {!isProductDetail && <V19Header store={store} />}
      <main>
        <div
          className={
            isProductDetail
              ? ""
              : "max-w-3xl md:max-w-7xl mx-auto px-4 md:px-6 lg:px-8 pt-3"
          }
        >
          <Suspense fallback={<V19RouteSkeleton />}>
            <PageTransition><Outlet context={store} /></PageTransition>
          </Suspense>
        </div>
      </main>
      {!isProductDetail && (
        <Suspense fallback={null}>
          <LazyV19BottomNav store={store} />
          <LazyV19DesktopCartFab store={store} />
        </Suspense>
      )}
    </>
  );
}

export default function StorefrontLayoutV19({ slugOverride }: { slugOverride?: string } = {}) {
  return (
    <StorefrontShell
      slugOverride={slugOverride}
      showWhatsApp={false}
      defaultPrimary="#036B52"
      defaultButtonRadius="999px"
      wrapperClassName="storefront-font min-h-screen font-sans overflow-x-hidden"
      wrapperStyle={{
        // Only fallbacks — saved theme config (primary/bg/text) takes priority via themeStyle
        "--storefront-btn-text": "#ffffff",
      } as React.CSSProperties}
    >
      {({ store }) => <V19Inner store={store} />}
    </StorefrontShell>
  );
}
