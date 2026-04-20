/**
 * Theme 19 — Quick Commerce Grocery (Blinkit-style)
 */
import { Suspense, lazy, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import StorefrontShell from "@/layouts/StorefrontShell";
import V19Header from "@/components/storefront/v19/V19Header";
import { prefetchStorefrontRoutes } from "@/lib/prefetchStorefrontRoutes";

const LazyV19BottomNav = lazy(() => import("@/components/storefront/v19/V19BottomNav"));

const V19_STYLES = `
  /* Theme 19 — Okra font (Blinkit's typeface). Falls back to Mulish from
     Google Fonts which is the closest free match, then Helvetica/Arial. */
  @import url('https://fonts.googleapis.com/css2?family=Mulish:wght@400;500;600;700;800;900&display=swap');
  .storefront-font, .storefront-font * {
    font-family: 'Okra', 'Mulish', 'Helvetica Neue', Helvetica, Arial, sans-serif !important;
    font-weight: 600;
  }
  .storefront-font { color: #0f0f0f; }
  body { background: #f6f7f9 !important; color: #0f0f0f; }
  .v19-section-title { display: flex; align-items: center; justify-content: space-between; padding: 0 4px; margin-bottom: 10px; }
  .v19-section-title h3 { font-size: 20px; font-weight: 900; color: #0a0a0a; letter-spacing: -0.01em; }
  .v19-section-title a { font-size: 13px; font-weight: 800; color: #036B52; display: inline-flex; align-items: center; gap: 2px; }
  .v19-cat-circle { display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .v19-cat-circle .circle { width: 100%; padding-top: 100%; border-radius: 14px; position: relative; overflow: hidden; }
  .v19-cat-circle .label { font-size: 12px; font-weight: 700; color: #0a0a0a; text-align: center; line-height: 1.25; max-width: 100%; }
  .v19-promo-card { flex-shrink: 0; width: 78%; border-radius: 16px; overflow: hidden; padding: 18px; color: #0a0a0a; min-height: 130px; display: flex; flex-direction: column; justify-content: space-between; }
  .v19-promo-card h2 { font-size: 24px; font-weight: 900; line-height: 1.05; color: #0a0a0a; }
  .v19-promo-card p { font-size: 13px; font-weight: 600; opacity: 0.85; margin-top: 4px; color: #0a0a0a; }
  .v19-promo-card .cta { background: #036B52; color: #fff; font-weight: 800; font-size: 13px; padding: 6px 14px; border-radius: 999px; display: inline-block; align-self: flex-start; margin-top: 10px; }
  .v19-card { background: #fff; border-radius: 12px; padding: 8px; border: 1px solid #f0f0f0; }
  .v19-add-btn-outline { background: #fff; color: #036B52; font-weight: 900; font-size: 13px; letter-spacing: 0.3px; padding: 6px 18px; border-radius: 8px; text-transform: uppercase; border: 1.5px solid #036B52; }
  .v19-stepper { background: #036B52; color: #fff; border-radius: 8px; display: inline-flex; align-items: center; font-weight: 800; font-size: 14px; overflow: hidden; }
  .v19-stepper button { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; }
  .v19-delivery-badge { position: absolute; left: 6px; top: 6px; z-index: 10; background: #fff; color: #036B52; font-size: 10px; font-weight: 900; padding: 2px 5px; border-radius: 4px; display: inline-flex; align-items: center; gap: 2px; box-shadow: 0 1px 2px rgba(0,0,0,0.08); letter-spacing: 0.3px; }
  .v19-marquee-yellow { background: #FFD33D; color: #036B52; font-weight: 900; font-size: 12px; padding: 7px 0; overflow: hidden; white-space: nowrap; letter-spacing: 0.4px; }
  .storefront-font main { padding-top: 0; padding-bottom: 80px; }
  .scrollbar-hide::-webkit-scrollbar { display: none; }
  .scrollbar-hide { scrollbar-width: none; }
`;

// Inject styles once at module load — prevents FOUC / "blank flash" between route transitions
if (typeof document !== "undefined" && !document.getElementById("v19-theme-styles")) {
  const styleEl = document.createElement("style");
  styleEl.id = "v19-theme-styles";
  styleEl.textContent = V19_STYLES;
  document.head.appendChild(styleEl);
}

/** Lightweight skeleton shown while the next route's lazy chunk is fetching. */
function V19RouteSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-40 rounded bg-gray-200 mb-4" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="v19-card">
            <div className="aspect-square rounded-lg bg-gray-200" />
            <div className="mt-2 h-3 w-3/4 rounded bg-gray-200" />
            <div className="mt-1.5 h-3 w-1/2 rounded bg-gray-200" />
          </div>
        ))}
      </div>
    </div>
  );
}

function V19Inner({ store }: { store: any }) {
  const location = useLocation();
  // Product detail page renders its own header + sticky add-to-cart bar,
  // so we hide the layout's V19Header and V19BottomNav there.
  const isProductDetail = /\/product\/[^/]+/.test(location.pathname);

  // Prefetch all storefront page chunks during idle time so navigation feels instant.
  useEffect(() => {
    const t = setTimeout(() => prefetchStorefrontRoutes(), 1500);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      {!isProductDetail && <V19Header store={store} />}
      <main>
        <div className={isProductDetail ? "" : "max-w-3xl mx-auto px-3 pt-3"}>
          <Suspense fallback={<V19RouteSkeleton />}>
            <Outlet context={store} />
          </Suspense>
        </div>
      </main>
      {!isProductDetail && (
        <Suspense fallback={null}>
          <LazyV19BottomNav store={store} />
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
        backgroundColor: "#f6f7f9",
        color: "#1a1a1a",
        "--storefront-text": "#1a1a1a",
        "--storefront-bg": "#ffffff",
        "--storefront-primary": "#036B52",
        "--storefront-btn-text": "#ffffff",
        "--background": "0 0% 96%",
        "--foreground": "0 0% 10%",
        "--card": "0 0% 100%",
        "--card-foreground": "0 0% 10%",
        "--primary": "163 95% 21%",
        "--primary-foreground": "0 0% 100%",
      } as React.CSSProperties}
    >
      {({ store }) => <V19Inner store={store} />}
    </StorefrontShell>
  );
}
