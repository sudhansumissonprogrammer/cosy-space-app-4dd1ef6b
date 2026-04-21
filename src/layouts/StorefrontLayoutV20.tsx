/**
 * Theme 20 — Multi Purpose. Duplicated from Theme 19 (Quick Commerce Grocery)
 * with the `v20-` CSS prefix so styling can evolve independently.
 */
import { Suspense, lazy, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import StorefrontShell from "@/layouts/StorefrontShell";
import V20Header from "@/components/storefront/v20/V20Header";
import { prefetchStorefrontRoutes } from "@/lib/prefetchStorefrontRoutes";

const LazyV20BottomNav = lazy(() => import("@/components/storefront/v20/V20BottomNav"));
const LazyV20DesktopCartFab = lazy(() => import("@/components/storefront/v20/V20DesktopCartFab"));

const V20_STYLES = `
  .storefront-font, .storefront-font * {
    font-family: 'Okra', 'Mulish', 'Helvetica Neue', Helvetica, Arial, sans-serif !important;
    font-weight: 600;
  }
  .storefront-font { color: #0f0f0f; }
  body { background: #f6f7f9 !important; color: #0f0f0f; }
  .v20-section-title { display: flex; align-items: center; justify-content: space-between; padding: 0 4px; margin-bottom: 10px; }
  .v20-section-title h3 { font-size: 18px; font-weight: 900; color: #0a0a0a; letter-spacing: -0.01em; }
  @media (min-width: 1024px) { .v20-section-title h3 { font-size: 22px; } }
  .v20-section-title a { font-size: 13px; font-weight: 800; color: var(--storefront-primary, #036B52); display: inline-flex; align-items: center; gap: 2px; }
  .v20-cat-strip { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; margin-bottom: 12px; border-radius: 12px; background: linear-gradient(135deg, #0a0a0a 0%, #1f1f1f 100%); color: #ffffff; box-shadow: 0 4px 14px -4px rgba(0,0,0,0.35); transition: transform 0.15s ease, box-shadow 0.15s ease; text-decoration: none; border: 1px solid rgba(255,255,255,0.06); }
  .v20-cat-strip:hover { box-shadow: 0 6px 18px -4px rgba(0,0,0,0.45); }
  .v20-cat-strip:active { transform: scale(0.99); }
  .v20-cat-strip-title { font-size: 16px; font-weight: 800; letter-spacing: -0.01em; color: #ffffff; line-height: 1.2; }
  @media (min-width: 1024px) { .v20-cat-strip { padding: 14px 20px; } .v20-cat-strip-title { font-size: 19px; } }
  .v20-cat-strip-cta { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 800; padding: 7px 14px; border-radius: 999px; background: var(--storefront-primary, #036B52); color: var(--storefront-btn-text, #ffffff); white-space: nowrap; transition: filter 0.15s ease, transform 0.15s ease; box-shadow: 0 2px 8px -2px color-mix(in srgb, var(--storefront-primary, #036B52) 60%, transparent); }
  .v20-cat-strip:hover .v20-cat-strip-cta { filter: brightness(1.1); transform: translateX(2px); }
  .v20-view-all-card { display: block; text-decoration: none; }
  .v20-view-all-inner { aspect-ratio: 3 / 4; border-radius: 14px; background: linear-gradient(160deg, #0a0a0a 0%, #1f1f1f 100%); color: #ffffff; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 14px; text-align: center; transition: transform 0.18s ease, box-shadow 0.18s ease; box-shadow: 0 4px 14px -4px rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.06); }
  .v20-view-all-card:hover .v20-view-all-inner { transform: translateY(-3px); box-shadow: 0 8px 20px -4px rgba(0,0,0,0.45); }
  .v20-view-all-arrow { width: 56px; height: 56px; border-radius: 999px; background: var(--storefront-primary, #036B52); color: var(--storefront-btn-text, #ffffff); display: inline-flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px -2px color-mix(in srgb, var(--storefront-primary, #036B52) 65%, transparent); transition: transform 0.18s ease; }
  .v20-view-all-card:hover .v20-view-all-arrow { transform: scale(1.08); }
  .v20-view-all-text { font-size: 16px; font-weight: 900; letter-spacing: -0.01em; color: #ffffff; }
  .v20-view-all-sub { font-size: 12px; font-weight: 600; opacity: 0.75; color: #ffffff; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .v20-cat-circle { display: flex; flex-direction: column; align-items: center; gap: 6px; cursor: pointer; }
  .v20-cat-circle .circle { width: 100%; padding-top: 100%; border-radius: 14px; position: relative; overflow: hidden; transition: transform 0.18s ease, box-shadow 0.18s ease; }
  @media (hover: hover) { .v20-cat-circle:hover .circle { transform: translateY(-2px); box-shadow: 0 6px 16px -6px rgba(0,0,0,0.18); } }
  .v20-cat-circle .label { font-size: 12px; font-weight: 700; color: #0a0a0a; text-align: center; line-height: 1.25; max-width: 100%; }
  .v20-promo-card { flex-shrink: 0; border-radius: 16px; overflow: hidden; padding: 18px; color: #0a0a0a; min-height: 130px; display: flex; flex-direction: column; justify-content: space-between; scroll-snap-align: start; }
  .v20-promo-card h2 { font-size: 22px; font-weight: 900; line-height: 1.05; color: #0a0a0a; }
  .v20-promo-card p { font-size: 13px; font-weight: 600; opacity: 0.85; margin-top: 4px; color: #0a0a0a; }
  .v20-promo-card .cta { background: var(--storefront-primary, #036B52); color: #fff; font-weight: 800; font-size: 13px; padding: 6px 14px; border-radius: 999px; display: inline-block; align-self: flex-start; margin-top: 10px; }
  .v20-card { background: #fff; border-radius: 12px; padding: 8px; border: 1px solid #f0f0f0; transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease; }
  @media (hover: hover) and (min-width: 768px) {
    .v20-card:hover { transform: translateY(-3px); box-shadow: 0 10px 24px -10px rgba(0,0,0,0.18); border-color: #e2e2e2; }
  }
  .v20-add-btn-outline { background: #fff; color: var(--storefront-primary, #036B52); font-weight: 900; font-size: 13px; letter-spacing: 0.3px; padding: 6px 18px; border-radius: 8px; text-transform: uppercase; border: 1.5px solid var(--storefront-primary, #036B52); }
  .v20-add-btn-outline:disabled { background: #f3f4f6; color: #9ca3af; border-color: #e5e7eb; cursor: not-allowed; }
  .v20-stepper { background: var(--storefront-primary, #036B52); color: #fff; border-radius: 8px; display: inline-flex; align-items: center; font-weight: 800; font-size: 14px; overflow: hidden; }
  .v20-stepper button { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; }
  .v20-delivery-badge { position: absolute; left: 6px; top: 6px; z-index: 10; background: #fff; color: var(--storefront-primary, #036B52); font-size: 10px; font-weight: 900; padding: 2px 5px; border-radius: 4px; display: inline-flex; align-items: center; gap: 2px; box-shadow: 0 1px 2px rgba(0,0,0,0.08); letter-spacing: 0.3px; }
  .v20-stock-badge { position: absolute; right: 6px; top: 6px; z-index: 10; font-size: 10px; font-weight: 900; padding: 2px 6px; border-radius: 4px; letter-spacing: 0.3px; }
  .v20-stock-low { background: #FEF2E2; color: #B25C00; }
  .v20-stock-out { background: #FEE2E2; color: #B91C1C; }
  .v20-marquee-yellow { background: #FFD33D; color: var(--storefront-primary, #036B52); font-weight: 900; font-size: 12px; padding: 7px 0; overflow: hidden; white-space: nowrap; letter-spacing: 0.4px; }
  .storefront-font main { padding-top: 0; padding-bottom: 80px; }
  @media (min-width: 768px) { .storefront-font main { padding-bottom: 24px; } }
  .scrollbar-hide::-webkit-scrollbar { display: none; }
  .scrollbar-hide { scrollbar-width: none; }
  .v20-carousel-arrow {
    position: absolute; top: 50%; transform: translateY(-50%);
    width: 36px; height: 36px; border-radius: 999px;
    background: #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    display: none; align-items: center; justify-content: center;
    z-index: 5; color: var(--storefront-primary, #036B52);
  }
  @media (hover: hover) and (min-width: 1024px) {
    .v20-carousel-wrap:hover .v20-carousel-arrow { display: flex; }
  }
  .v20-carousel-arrow.left { left: 4px; }
  .v20-carousel-arrow.right { right: 4px; }
  .v20-promo-card { width: 78%; max-width: 320px; }
  @media (min-width: 640px) { .v20-promo-card { width: 45%; max-width: 360px; } }
  @media (min-width: 768px) { .v20-promo-card { width: 32%; max-width: 360px; } }
  @media (min-width: 1024px) { .v20-promo-card { width: 24%; max-width: 320px; min-height: 160px; } }
`;

if (typeof document !== "undefined" && !document.getElementById("v20-theme-styles")) {
  const styleEl = document.createElement("style");
  styleEl.id = "v20-theme-styles";
  styleEl.textContent = V20_STYLES;
  document.head.appendChild(styleEl);
  if (!document.getElementById("v20-mulish-font")) {
    const link = document.createElement("link");
    link.id = "v20-mulish-font";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Mulish:wght@400;500;600;700;800;900&display=swap";
    link.media = "print";
    link.onload = () => { link.media = "all"; };
    document.head.appendChild(link);
  }
}

function V20RouteSkeleton() {
  return <div className="min-h-[200px]" />;
}

function V20Inner({ store }: { store: any }) {
  const location = useLocation();
  const isProductDetail = /\/product\/[^/]+/.test(location.pathname);

  useEffect(() => {
    const t = setTimeout(() => prefetchStorefrontRoutes(), 1500);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      {!isProductDetail && <V20Header store={store} />}
      <main>
        <div
          className={
            isProductDetail
              ? ""
              : "max-w-3xl md:max-w-5xl lg:max-w-6xl xl:max-w-7xl mx-auto px-3 md:px-6 lg:px-8 pt-3 md:pt-5"
          }
        >
          <Suspense fallback={<V20RouteSkeleton />}>
            <Outlet context={store} />
          </Suspense>
        </div>
      </main>
      {!isProductDetail && (
        <Suspense fallback={null}>
          <LazyV20BottomNav store={store} />
          <LazyV20DesktopCartFab store={store} />
        </Suspense>
      )}
    </>
  );
}

export default function StorefrontLayoutV20({ slugOverride }: { slugOverride?: string } = {}) {
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
      {({ store }) => <V20Inner store={store} />}
    </StorefrontShell>
  );
}
