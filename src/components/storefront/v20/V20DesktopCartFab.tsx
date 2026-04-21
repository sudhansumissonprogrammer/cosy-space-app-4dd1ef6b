/**
 * V20 Desktop floating cart bar — Theme 20 (Multi Purpose). Duplicated from V19DesktopCartFab.
 */
import { Link, useLocation } from "react-router-dom";
import { ShoppingCart, ArrowRight } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { storefrontPath } from "@/lib/subdomain";

const PRIMARY = "var(--storefront-primary, #036B52)";

export default function V20DesktopCartFab({ store }: { store: any }) {
  const { cartCount, cartTotal } = useCart();
  const location = useLocation();
  const isCheckout = location.pathname.includes("/checkout") || location.pathname.endsWith("/cart");
  const isProductDetail = /\/product\/[^/]+/.test(location.pathname);
  if (isCheckout || isProductDetail || cartCount === 0) return null;

  const slug = store?.slug || "";

  return (
    <Link
      to={storefrontPath(slug, "cart")}
      className="hidden md:flex fixed bottom-6 right-6 z-40 items-center gap-3 rounded-2xl px-5 py-3 shadow-2xl active:scale-[0.98] hover:scale-[1.02] transition-transform"
      style={{ background: PRIMARY, color: "#fff" }}
      aria-label="View cart"
    >
      <div className="relative h-10 w-10 rounded-lg bg-white/15 flex items-center justify-center" data-cart-target>
        <ShoppingCart className="h-5 w-5 text-white" strokeWidth={2.5} />
        <span
          className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-yellow-400 text-[11px] font-black flex items-center justify-center"
          style={{ color: PRIMARY }}
        >
          {cartCount}
        </span>
      </div>
      <div className="flex flex-col leading-tight">
        <span className="text-[14px] font-bold">{cartCount} {cartCount === 1 ? "item" : "items"}</span>
        <span className="text-[12px] opacity-90">₹{cartTotal.toFixed(0)}</span>
      </div>
      <div className="flex items-center gap-1.5 text-[14px] font-bold pl-2 border-l border-white/25">
        View Cart
        <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
      </div>
    </Link>
  );
}
