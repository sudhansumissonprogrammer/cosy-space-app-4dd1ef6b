/**
 * Sticky "Proceed to Cart" bar — Zepto/Blinkit style.
 * Slides up from the bottom whenever the cart has items.
 * Hidden on /cart, /checkout, /thank-you, /account pages.
 * Mobile-only by default (sm:hidden) to avoid covering desktop footers.
 */
import { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { ShoppingBag, ArrowRight } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { storefrontPath } from "@/lib/subdomain";
import { formatPrice } from "@/lib/productUtils";

interface StickyCartBarProps {
  slug: string;
  currency?: string;
}

const HIDE_PATTERNS = ["/cart", "/checkout", "/thank-you", "/order-success", "/account", "/login", "/signup", "/wishlist"];

export default function StickyCartBar({ slug, currency = "INR" }: StickyCartBarProps) {
  const { cartCount, cartTotal, openCart } = useCart();
  const location = useLocation();
  const [displayCount, setDisplayCount] = useState(cartCount);
  const [displayTotal, setDisplayTotal] = useState(cartTotal);

  // Animate count + total tick-up
  useEffect(() => {
    if (cartCount === displayCount && cartTotal === displayTotal) return;
    const start = performance.now();
    const fromCount = displayCount;
    const fromTotal = displayTotal;
    const dCount = cartCount - fromCount;
    const dTotal = cartTotal - fromTotal;
    const dur = 380;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplayCount(Math.round(fromCount + dCount * eased));
      setDisplayTotal(fromTotal + dTotal * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartCount, cartTotal]);

  if (cartCount === 0) return null;
  if (HIDE_PATTERNS.some(p => location.pathname.includes(p))) return null;

  return (
    <div
      className="sticky-cart-bar fixed inset-x-0 bottom-16 z-40 px-3 sm:hidden"
      style={{ pointerEvents: "none" }}
    >
      <Link
        to={storefrontPath(slug, "cart")}
        onClick={(e) => {
          // Prefer opening side cart for instant feedback on themes that use it
          e.preventDefault();
          openCart();
        }}
        className="mx-auto flex max-w-md items-center gap-3 rounded-2xl px-4 py-3 shadow-2xl"
        style={{
          pointerEvents: "auto",
          backgroundColor: "var(--storefront-primary, hsl(var(--primary)))",
          color: "var(--storefront-btn-text, hsl(var(--primary-foreground)))",
          boxShadow: "0 12px 32px -8px rgba(0,0,0,0.35)",
        }}
        aria-label={`Proceed to cart — ${displayCount} items, ${formatPrice(displayTotal, currency)}`}
      >
        <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
          <ShoppingBag className="h-4 w-4" aria-hidden="true" />
          <span
            className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold"
            style={{
              backgroundColor: "var(--storefront-btn-text, hsl(var(--primary-foreground)))",
              color: "var(--storefront-primary, hsl(var(--primary)))",
            }}
          >
            {displayCount}
          </span>
        </div>

        <div className="flex-1 leading-tight">
          <div className="text-[11px] font-medium opacity-90">
            {displayCount} {displayCount === 1 ? "item" : "items"} in cart
          </div>
          <div className="text-sm font-bold tabular-nums">
            {formatPrice(displayTotal, currency)}
          </div>
        </div>

        <div className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider">
          <span>View Cart</span>
          <ArrowRight className="sticky-cart-arrow h-4 w-4" aria-hidden="true" />
        </div>
      </Link>
    </div>
  );
}
