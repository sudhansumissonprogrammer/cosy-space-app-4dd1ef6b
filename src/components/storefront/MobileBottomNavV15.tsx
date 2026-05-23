/**
 * MobileBottomNavV15 — Modern pill-indicator mobile navigation
 * Active item shows dark pill with dot + label; inactive = icon only.
 * Cart is a separate elevated circle on the right.
 */
import { Link, useLocation } from "react-router-dom";
import { Home, Store, ShoppingCart, ClipboardList } from "lucide-react";
import { storefrontPath } from "@/lib/subdomain";
import { useCart } from "@/contexts/CartContext";
import type { Tables } from "@/integrations/supabase/types";

type StoreData = Tables<"stores">;

const navItems = [
  { key: "home", label: "Home", icon: Home, path: "" },
  { key: "shop", label: "Shop", icon: Store, path: "shop" },
  { key: "cart", label: "Cart", icon: ShoppingCart, path: "cart" },
  { key: "orders", label: "Orders", icon: ClipboardList, path: "account" },
];

export default function MobileBottomNavV15({ store }: { store: StoreData }) {
  const location = useLocation();
  const { cartCount, openCart } = useCart();
  const isCheckout = location.pathname.includes("/checkout");
  const isProductDetail = location.pathname.includes("/product/");

  if (isCheckout || isProductDetail) return null;

  const currentPath = location.pathname;
  const storePath = storefrontPath(store.slug);

  const getActive = (path: string) => {
    if (path === "") return currentPath === storePath || currentPath === storePath + "/";
    const full = storefrontPath(store.slug, path);
    return currentPath === full || currentPath.startsWith(full + "/");
  };

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex items-end justify-center gap-2.5 px-3 pb-2.5">
        {/* Main nav pill */}
        <div className="flex items-center justify-around rounded-full shadow-[0_2px_20px_rgba(0,0,0,0.10)] px-2 py-1 flex-1" style={{ backgroundColor: "var(--storefront-bg, hsl(var(--card)))", border: "1px solid color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 10%, transparent)" }}>
          {navItems.map((item) => {
            const active = getActive(item.path);
            const isCart = item.key === "cart";
            const handleClick = isCart ? (e: React.MouseEvent) => { e.preventDefault(); openCart(); } : undefined;
            const badge = isCart ? cartCount : 0;
            return (
              <Link
                key={item.key}
                to={item.path === "" ? storePath : storefrontPath(store.slug, item.path)}
                onClick={handleClick}
                className="relative flex items-center justify-center outline-none"
                aria-label={item.label}
              >
                <div
                  {...(isCart ? { "data-cart-target": "" } : {})}
                  className={`relative flex items-center gap-1.5 rounded-full transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                    active
                      ? "pl-2.5 pr-3.5 py-1.5"
                      : "p-2"
                  }`}
                  style={active ? { backgroundColor: "var(--storefront-text, hsl(var(--foreground)))" } : undefined}
                >
                  <item.icon
                    className="shrink-0 transition-all duration-400"
                    style={{
                      width: active ? 16 : 18,
                      height: active ? 16 : 18,
                      color: active ? "var(--storefront-bg, hsl(var(--background)))" : "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 70%, transparent)",
                    }}
                    strokeWidth={active ? 2.2 : 1.6}
                  />
                  {badge > 0 && !active && (
                    <span className="absolute -right-0.5 -top-0.5 flex items-center justify-center rounded-full bg-destructive text-[8px] font-bold text-destructive-foreground min-w-[15px] h-[15px] px-0.5">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                  <span
                    className={`text-[10px] font-semibold whitespace-nowrap overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                      active
                        ? "max-w-[56px] opacity-100"
                        : "max-w-0 opacity-0"
                    }`}
                    style={{
                      fontFamily: "var(--storefront-body-font, inherit)",
                      color: active ? "var(--storefront-bg, hsl(var(--background)))" : undefined,
                    }}
                  >
                    {item.label}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
