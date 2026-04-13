import { Suspense } from "react";
import { Link, Outlet, useSearchParams } from "react-router-dom";
import { Store, MapPin } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { StorefrontContentSkeleton } from "@/components/ContentSkeleton";
import { storefrontPath } from "@/lib/subdomain";
import { Skeleton } from "@/components/ui/skeleton";
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
            {store.description && <span className="text-xs leading-tight opacity-60" style={{ color: "var(--storefront-text, #1a1a1a)" }}>{store.description.slice(0, 50)}</span>}
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

function WhatsAppOrderBar({ store, tableNumber }: { store: StoreData; tableNumber: string | null }) {
  const { items, cartTotal, cartCount } = useCart();
  if (cartCount === 0) return null;
  const currency = (store as any)?.currency === "USD" ? "$" : "₹";

  const composeWhatsAppMessage = () => {
    let msg = `🍽️ *New Order from ${store.name}*\n`;
    if (tableNumber) msg += `📋 *Table: ${tableNumber}*\n`;
    msg += `\n`;
    items.forEach((item) => {
      const variant = item.variantName ? ` (${item.variantName})` : "";
      msg += `${item.quantity}x ${item.name}${variant} — ${currency}${(item.price * item.quantity).toLocaleString()}\n`;
    });
    msg += `\n💰 *Total: ${currency}${cartTotal.toLocaleString()}*`;
    return msg;
  };

  const handleSendOrder = () => {
    const phone = (store as any)?.whatsapp_number?.replace(/[^0-9+]/g, "") || "";
    if (!phone) { alert("This restaurant hasn't set up WhatsApp ordering yet."); return; }
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(composeWhatsAppMessage())}`, "_blank");
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="mx-3 mb-3">
        <button onClick={handleSendOrder} className="flex w-full items-center justify-between gap-3 rounded-2xl px-5 py-4 shadow-xl transition-all active:scale-[0.98]" style={{ backgroundColor: "#25D366", color: "#ffffff", boxShadow: "0 8px 32px rgba(37, 211, 102, 0.35)" }}>
          <div className="flex items-center gap-3">
            <svg viewBox="0 0 32 32" fill="white" className="h-6 w-6 shrink-0">
              <path d="M16.004 3.2C9.056 3.2 3.406 8.848 3.404 15.8c-.001 2.222.58 4.392 1.683 6.303L3.2 28.8l6.867-1.802A12.56 12.56 0 0 0 16 28.398h.005C22.95 28.398 28.6 22.75 28.6 15.8 28.6 8.85 22.95 3.2 16.004 3.2Zm0 22.997h-.004a10.44 10.44 0 0 1-5.318-1.457l-.382-.226-3.955 1.038 1.055-3.858-.249-.395A10.42 10.42 0 0 1 5.54 15.8c.002-5.77 4.697-10.463 10.466-10.463 5.77 0 10.463 4.695 10.463 10.464 0 5.77-4.695 10.465-10.465 10.465v-.069Zm5.74-7.835c-.315-.158-1.863-.92-2.152-1.025-.289-.105-.499-.158-.71.158-.21.315-.815 1.025-.999 1.236-.184.21-.368.236-.683.079-.315-.158-1.33-.49-2.533-1.562-.937-.835-1.568-1.867-1.752-2.182-.184-.315-.02-.486.138-.643.142-.141.315-.368.473-.552.158-.184.21-.315.315-.526.106-.21.053-.394-.026-.552-.079-.158-.71-1.71-.973-2.341-.256-.615-.517-.532-.71-.542-.184-.008-.394-.01-.604-.01s-.552.079-.841.394c-.29.315-1.104 1.078-1.104 2.63 0 1.552 1.13 3.052 1.288 3.262.158.21 2.224 3.396 5.388 4.762.753.326 1.341.52 1.8.665.756.24 1.444.206 1.988.125.607-.09 1.863-.762 2.126-1.498.263-.736.263-1.367.184-1.498-.079-.132-.289-.21-.604-.369Z" />
            </svg>
            <div className="flex flex-col items-start text-left">
              <span className="text-sm font-bold">Send Order on WhatsApp</span>
              <span className="text-xs opacity-80">{cartCount} item{cartCount > 1 ? "s" : ""}</span>
            </div>
          </div>
          <span className="text-lg font-bold">{currency}{cartTotal.toLocaleString()}</span>
        </button>
      </div>
    </div>
  );
}

function RestaurantSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-30 border-b bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="flex flex-col gap-1"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-20" /></div>
        </div>
      </div>
      <div className="px-4 py-4"><Skeleton className="h-10 w-full rounded-xl" /></div>
      <div className="px-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => (<Skeleton key={i} className="h-24 rounded-xl" />))}</div>
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
      showSideCart={false}
      defaultPrimary="#25D366"
      defaultButtonRadius="0.75rem"
      notFoundLabel="Restaurant"
      skeleton={<RestaurantSkeleton />}
    >
      {({ store }) => (
        <>
          <RestaurantHeader store={store} tableNumber={tableNumber} />
          <main className="pb-28">
            <Suspense fallback={<StorefrontContentSkeleton />}><Outlet context={{ ...store, tableNumber }} /></Suspense>
          </main>
          <WhatsAppOrderBar store={store} tableNumber={tableNumber} />
        </>
      )}
    </StorefrontShell>
  );
}
