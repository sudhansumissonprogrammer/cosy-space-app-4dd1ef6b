import { Suspense } from "react";
import { Link, Outlet, useNavigate, useSearchParams } from "react-router-dom";
import { Store, MapPin, ShoppingBag } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { StorefrontContentSkeleton } from "@/components/ContentSkeleton";
import { storefrontPath } from "@/lib/subdomain";
import StorefrontShell from "@/layouts/StorefrontShell";
import type { StoreData } from "@/layouts/StorefrontLayout";

function RestaurantHeader({ store, tableNumber }: { store: StoreData; tableNumber: string | null }) {
  return (
    <header className="sticky top-0 z-30 border-b backdrop-blur-md" style={{ backgroundColor: "var(--storefront-bg, #ffffff)ee", borderColor: "var(--storefront-text, #1a1a1a)12" }}>
      <div className="flex items-center gap-3 px-4 py-3">
        <Link to={storefrontPath(store.slug)} className="flex items-center gap-3">
          {store.logo_url ? (
            <img src={store.logo_url} alt={store.name} className="h-10 w-10 rounded-xl object-contain" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: "#25D366" }}>
              <Store className="h-5 w-5 text-white" />
            </div>
          )}
          <div className="flex flex-col">
            <span className="text-base font-bold leading-tight" style={{ color: "var(--storefront-text, #1a1a1a)", fontFamily: "var(--storefront-heading-font, inherit)" }}>{store.name}</span>
            {store.description && <span className="text-xs leading-tight opacity-60 truncate max-w-[180px] block" style={{ color: "var(--storefront-text, #1a1a1a)" }}>{store.description.slice(0, 50)}{store.description.length > 50 ? "…" : ""}</span>}
          </div>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          {tableNumber && (
            <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold" style={{ backgroundColor: "#25D36618", color: "#25D366" }}>
              <MapPin className="h-3 w-3" />
              Table {tableNumber}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function CheckoutOrderBar({ store, tableNumber }: { store: StoreData; tableNumber: string | null }) {
  const { cartTotal, cartCount } = useCart();
  const navigate = useNavigate();
  if (cartCount === 0) return null;
  const currency = (store as any)?.currency === "USD" ? "$" : "₹";

  const handleCheckout = () => {
    navigate(storefrontPath(store.slug, `checkout${tableNumber ? `?table=${tableNumber}` : ""}`));
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="mx-3 mb-3">
        <button onClick={handleCheckout} className="flex w-full items-center justify-between gap-3 rounded-2xl px-5 py-4 shadow-xl transition-[transform,opacity,colors,box-shadow] active:scale-[0.98]" style={{ backgroundColor: "var(--storefront-primary, #25D366)", color: "#ffffff", boxShadow: "0 8px 32px rgba(0, 0, 0, 0.15)" }}>
          <div className="flex items-center gap-3">
            <ShoppingBag className="h-6 w-6 shrink-0" />
            <div className="flex flex-col items-start text-left">
              <span className="text-sm font-bold">View Cart & Checkout</span>
              <span className="text-xs opacity-80">{cartCount} item{cartCount > 1 ? "s" : ""}</span>
            </div>
          </div>
          <span className="text-lg font-bold">{currency}{cartTotal.toLocaleString("en-IN", { useGrouping: false })}</span>
        </button>
      </div>
    </div>
  );
}

export default function StorefrontLayoutV13({ slugOverride }: { slugOverride?: string } = {}) {
  const [searchParams] = useSearchParams();
  const tableNumber = searchParams.get("table");

  return (
    <StorefrontShell
      slugOverride={slugOverride}
      showWishlist={false}
      showSideCart={true}
      defaultPrimary="#25D366"
      defaultButtonRadius="0.75rem"
      notFoundLabel="Restaurant"
    >
      {({ store }) => (
        <>
          <RestaurantHeader store={store} tableNumber={tableNumber} />
          <main className="pb-28">
            <Suspense fallback={null}><Outlet context={{ ...store, tableNumber }} /></Suspense>
          </main>
          <CheckoutOrderBar store={store} tableNumber={tableNumber} />
        </>
      )}
    </StorefrontShell>
  );
}
