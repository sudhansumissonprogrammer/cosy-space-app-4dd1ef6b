/**
 * Theme 19 — Quick Commerce Grocery (Blinkit/Zepto/While style)
 * Green sticky header with location + search, yellow promo banner,
 * yellow category tiles, green section bands with "View All",
 * Blinkit-style ADD → quantity stepper, 4-tab bottom nav.
 */
import { Suspense, lazy } from "react";
import StorefrontShell from "@/layouts/StorefrontShell";
import V19Header from "@/components/storefront/v19/V19Header";

const LazyMobileBottomNav = lazy(() => import("@/components/storefront/v19/V19BottomNav"));

function V19Inner({ store }: { store: any }) {
  return (
    <>
      <style>{`
        .v19-root { background: #f6f7f9; }
        .v19-section-header {
          background: linear-gradient(90deg, #036B52 0%, #048061 100%);
          color: #ffffff;
          border-radius: 14px;
          padding: 14px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-weight: 800;
          font-size: 18px;
          letter-spacing: 0.2px;
        }
        .v19-section-header a {
          font-size: 13px;
          font-weight: 600;
          color: #fff;
          opacity: 0.95;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .v19-promo {
          background: linear-gradient(135deg, #FFD33D 0%, #FFC107 100%);
          border-radius: 16px;
          overflow: hidden;
          position: relative;
          padding: 18px 18px 18px 18px;
          color: #1a1a1a;
        }
        .v19-promo h2 { font-size: 24px; font-weight: 900; line-height: 1.1; margin-bottom: 6px; }
        .v19-promo p { font-size: 13px; font-weight: 500; opacity: 0.85; margin-bottom: 14px; }
        .v19-promo .cta {
          background: #036B52; color: #fff; font-weight: 700; font-size: 13px;
          padding: 8px 18px; border-radius: 999px; display: inline-block;
        }
        .v19-cat-tile {
          background: #FFD33D;
          border-radius: 12px;
          aspect-ratio: 1/1;
          position: relative;
          overflow: hidden;
        }
        .v19-cat-tile-label {
          position: absolute; left: 0; right: 0; bottom: 0;
          background: #036B52; color: #fff;
          font-size: 11px; font-weight: 700;
          text-align: center; padding: 4px 4px;
          line-height: 1.1;
        }
        .v19-card {
          background: #fff;
          border-radius: 14px;
          padding: 10px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        .v19-add-btn {
          background: #036B52;
          color: #fff;
          font-weight: 800;
          font-size: 11px;
          letter-spacing: 0.5px;
          padding: 7px 16px;
          border-radius: 999px;
          text-transform: uppercase;
        }
        .v19-stepper {
          background: #036B52;
          color: #fff;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          gap: 0;
          font-weight: 700;
          font-size: 13px;
          overflow: hidden;
        }
        .v19-stepper button {
          width: 28px; height: 28px;
          display: flex; align-items: center; justify-content: center;
        }
        .v19-marquee-yellow {
          background: #FFD33D;
          color: #036B52;
          font-weight: 700;
          font-size: 12px;
          padding: 6px 0;
        }
        body, .storefront-font { background: #f6f7f9; }
        .storefront-font main { padding-top: 0; }
        @media (max-width: 767px) {
          .storefront-font main { padding-bottom: 70px; }
        }
      `}</style>
      <V19Header store={store} />
      <main className="v19-root">
        <div className="max-w-3xl mx-auto px-3 pt-3 pb-8">
          {/* Outlet content rendered here via shell */}
          <V19MainOutlet />
        </div>
      </main>
      <Suspense fallback={null}>
        <LazyMobileBottomNav store={store} />
      </Suspense>
    </>
  );
}

import { Outlet } from "react-router-dom";
function V19MainOutlet() {
  return <Outlet context={undefined} />;
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
      {({ store }) => <V19InnerWithOutlet store={store} />}
    </StorefrontShell>
  );
}

function V19InnerWithOutlet({ store }: { store: any }) {
  return (
    <>
      <style>{`
        .v19-section-header { background: linear-gradient(90deg, #036B52 0%, #048061 100%); color: #fff; border-radius: 14px; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; font-weight: 800; font-size: 18px; }
        .v19-section-header a { font-size: 13px; font-weight: 600; color: #fff; display: inline-flex; align-items: center; gap: 4px; opacity: 0.95; }
        .v19-promo { background: linear-gradient(135deg, #FFD33D 0%, #FFC107 100%); border-radius: 16px; overflow: hidden; position: relative; padding: 18px; color: #1a1a1a; }
        .v19-promo h2 { font-size: 24px; font-weight: 900; line-height: 1.1; margin-bottom: 6px; }
        .v19-promo p { font-size: 13px; font-weight: 500; opacity: 0.85; margin-bottom: 14px; }
        .v19-promo .cta { background: #036B52; color: #fff; font-weight: 700; font-size: 13px; padding: 8px 18px; border-radius: 999px; display: inline-block; }
        .v19-cat-tile { background: #FFD33D; border-radius: 12px; aspect-ratio: 1/1; position: relative; overflow: hidden; }
        .v19-cat-tile-label { position: absolute; left: 0; right: 0; bottom: 0; background: #036B52; color: #fff; font-size: 11px; font-weight: 700; text-align: center; padding: 4px; line-height: 1.1; }
        .v19-card { background: #fff; border-radius: 14px; padding: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        .v19-add-btn { background: transparent; color: #036B52; border: 1.5px solid #036B52; font-weight: 800; font-size: 12px; letter-spacing: 0.5px; padding: 6px 18px; border-radius: 8px; text-transform: uppercase; }
        .v19-add-btn-solid { background: #036B52; color: #fff; font-weight: 800; font-size: 11px; letter-spacing: 0.5px; padding: 7px 16px; border-radius: 999px; text-transform: uppercase; }
        .v19-stepper { background: #036B52; color: #fff; border-radius: 8px; display: inline-flex; align-items: center; gap: 0; font-weight: 700; font-size: 13px; overflow: hidden; border: 1.5px solid #036B52; }
        .v19-stepper button { width: 30px; height: 28px; display: flex; align-items: center; justify-content: center; }
        .v19-marquee-yellow { background: #FFD33D; color: #036B52; font-weight: 700; font-size: 12px; padding: 6px 0; overflow: hidden; white-space: nowrap; }
        body { background: #f6f7f9 !important; }
        .storefront-font main { padding-top: 0; padding-bottom: 80px; }
      `}</style>
      <V19Header store={store} />
      <main>
        <div className="max-w-3xl mx-auto px-3 pt-3">
          <V19MainOutlet />
        </div>
      </main>
      <Suspense fallback={null}>
        <LazyMobileBottomNav store={store} />
      </Suspense>
    </>
  );
}
