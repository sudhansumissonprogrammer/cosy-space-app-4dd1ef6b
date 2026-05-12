/**
 * MobileBottomNavV15 — Modern pill-indicator mobile navigation
 * Active item shows dark pill with dot + label; inactive = icon only.
 * Cart is a separate elevated circle on the right.
 */
import { Link, useLocation } from "react-router-dom";
import { Home, Store, Heart, User, ShoppingCart } from "lucide-react";
import { storefrontPath } from "@/lib/subdomain";
import { useCart } from "@/contexts/CartContext";
import type { Tables } from "@/integrations/supabase/types";

type StoreData = Tables<"stores">;

const navItems = [
  { key: "home", label: "Home", icon: Home, path: "" },
  { key: "shop", label: "Shop", icon: Store, path: "shop" },
  { key: "wishlist", label: "Wishlist", icon: Heart, path: "wishlist" },
  { key: "account", label: "Account", icon: User, path: "account" },
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
        <div className="flex items-center justify-around rounded-full shadow-[0_2px_20px_rgba(0,0,0,0.10)] px-2 py-1.5 flex-1" style={{ backgroundColor: "var(--storefront-bg, hsl(var(--card)))", border: "1px solid color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 10%, transparent)" }}>
          {navItems.map((item) => {
            const active = getActive(item.path);
            return (
              <Link
                key={item.key}
                to={item.path === "" ? storePath : storefrontPath(store.slug, item.path)}
                className="relative flex items-center justify-center outline-none"
                aria-label={item.label}
              >
                <div
                  className={`flex items-center gap-1.5 rounded-full transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                    active
                      ? "pl-2.5 pr-3.5 py-1.5"
                      : "p-2"
                  }`}
                  style={active ? { backgroundColor: "var(--storefront-text, hsl(var(--foreground)))" } : undefined}
                >
                  <item.icon
                    className="shrink-0 transition-all duration-400"
                    style={{
                      width: active ? 18 : 20,
                      height: active ? 18 : 20,
                      color: active ? "var(--storefront-bg, hsl(var(--background)))" : "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 70%, transparent)",
                    }}
                    strokeWidth={active ? 2.2 : 1.6}
                  />
                  <span
                    className={`text-[11px] font-semibold whitespace-nowrap overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
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

        {/* Cart — separate elevated circle */}
        <button
          onClick={openCart}
          className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full shadow-[0_2px_20px_rgba(0,0,0,0.10)] transition-transform duration-200 active:scale-95"
          style={{ backgroundColor: "var(--storefront-bg, hsl(var(--card)))", border: "1px solid color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 10%, transparent)" }}
          aria-label={`Cart${cartCount > 0 ? `, ${cartCount} items` : ""}`}
        >
          <ShoppingCart className="h-5 w-5" strokeWidth={1.6} style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 80%, transparent)" }} />
          {cartCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground min-w-[18px] h-[18px]">
              {cartCount > 9 ? "9+" : cartCount}
            </span>
          )}
        </button>
      </div>
    </nav>
  );
}
