/**
 * V19 Bottom Nav — 4-tab grocery nav + floating "View Cart" FAB above nav.
 * Active tab uses an animated sliding pill indicator.
 */
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, LayoutGrid, ShoppingCart, User, ArrowRight } from "lucide-react";
import { storefrontPath } from "@/lib/subdomain";
import { useCart } from "@/contexts/CartContext";
import { useStorefrontAuth } from "@/contexts/StorefrontAuthContext";

const GREEN = "var(--storefront-primary, #036B52)";

export default function V19BottomNav({ store }: { store: any }) {
  const location = useLocation();
  const { cartCount, cartTotal } = useCart();
  const { user } = useStorefrontAuth();
  const isCheckout = location.pathname.includes("/checkout") || location.pathname.endsWith("/cart");
  const isProductDetail = /\/product\/[^/]+/.test(location.pathname);

  const slug = store?.slug || "";
  const storePath = storefrontPath(slug);

  const items = [
    { key: "home", label: "Home", icon: Home, to: storePath, match: (p: string) => p === storePath || p === storePath + "/" },
    { key: "categories", label: "Categories", icon: LayoutGrid, to: storefrontPath(slug, "categories"), match: (p: string) => p.includes("/categories") || p.includes("/category/") },
    { key: "cart", label: "Cart", icon: ShoppingCart, to: storefrontPath(slug, "cart"), match: (p: string) => p.includes("/cart"), badge: cartCount },
    { key: "account", label: "Account", icon: User, to: storefrontPath(slug, user ? "account" : "login"), match: (p: string) => p.includes("/account") || p.includes("/login") },
  ];

  const navRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);

  useEffect(() => {
    const idx = items.findIndex((it) => it.match(location.pathname));
    const el = itemRefs.current[idx];
    const wrap = navRef.current;
    if (el && wrap) {
      const elRect = el.getBoundingClientRect();
      const wrapRect = wrap.getBoundingClientRect();
      const w = Math.min(28, elRect.width * 0.5);
      setPill({ left: elRect.left - wrapRect.left + (elRect.width - w) / 2, width: w });
    } else {
      setPill(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, cartCount]);

  if (isCheckout || isProductDetail) return null;
  const showCartFab = cartCount > 0;

  return (
    <>
      {showCartFab && (
        <Link
          to={storefrontPath(slug, "cart")}
          className="cta-shimmer fixed inset-x-3 z-40 md:hidden flex items-center justify-between rounded-xl px-4 shadow-2xl active:scale-[0.98] transition-transform"
          style={{
            background: GREEN,
            color: "#fff",
            height: 52,
            bottom: "calc(60px + env(safe-area-inset-bottom, 0px) + 8px)",
          }}
        >
          <div className="flex items-center gap-2.5">
            <div className="relative h-8 w-8 rounded-md bg-white/15 flex items-center justify-center">
              <ShoppingCart className="h-4 w-4 text-white" strokeWidth={2.5} />
              <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-white text-[10px] font-black flex items-center justify-center" style={{ color: GREEN }}>
                {cartCount}
              </span>
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-[13px] font-bold">{cartCount} {cartCount === 1 ? "item" : "items"}</span>
              <span className="text-[11px] opacity-90">₹{cartTotal.toFixed(0)}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[13px] font-bold">
            View Cart
            <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
          </div>
        </Link>
      )}

      <nav
        className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-white border-t"
        style={{ borderColor: "#e5e7eb", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div ref={navRef} className="relative flex items-stretch justify-around h-[60px]">
          {pill && (
            <span
              className="nav-pill-indicator"
              style={{ left: pill.left, width: pill.width }}
              aria-hidden="true"
            />
          )}
          {items.map((item, idx) => {
            const active = item.match(location.pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                ref={(el) => (itemRefs.current[idx] = el)}
                to={item.to}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 relative"
                style={{ color: active ? GREEN : "#6b7280" }}
              >
                <div className="relative" {...(item.key === "cart" ? { "data-cart-target": "" } : {})}>
                  <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.4 : 1.8} />
                  {item.badge && item.badge > 0 ? (
                    <span
                      className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] rounded-full text-white text-[9px] font-bold flex items-center justify-center px-1"
                      style={{ background: GREEN }}
                    >
                      {item.badge > 9 ? "9+" : item.badge}
                    </span>
                  ) : null}
                </div>
                <span className="text-[10px] font-semibold">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
