/**
 * MobileBottomNavV15 — Modern pill-indicator mobile navigation
 * Active item gets a dark pill with icon + label; inactive items show icon only.
 * Smooth spring-like transitions between menu items.
 */
import { Link, useLocation } from "react-router-dom";
import { Home, Store, Heart, User, ShoppingCart } from "lucide-react";
import { storefrontPath } from "@/lib/subdomain";
import { useCart } from "@/contexts/CartContext";
import type { Tables } from "@/integrations/supabase/types";

type StoreData = Tables<"stores">;

interface Props {
  store: StoreData;
}

const navItems = [
  { key: "home", label: "Home", icon: Home, path: "" },
  { key: "shop", label: "Shop", icon: Store, path: "shop" },
  { key: "wishlist", label: "Wishlist", icon: Heart, path: "wishlist" },
  { key: "account", label: "Account", icon: User, path: "account" },
  { key: "cart", label: "Cart", icon: ShoppingCart, path: "cart" },
];

export default function MobileBottomNavV15({ store }: Props) {
  const location = useLocation();
  const { cartCount, openCart } = useCart();
  const isCheckout = location.pathname.includes("/checkout");

  if (isCheckout) return null;

  const currentPath = location.pathname;
  const storePath = storefrontPath(store.slug);

  const getActive = (path: string) => {
    if (path === "") {
      return currentPath === storePath || currentPath === storePath + "/";
    }
    const full = storefrontPath(store.slug, path);
    return currentPath === full || currentPath.startsWith(full + "/");
  };

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 sm:hidden safe-bottom" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <div className="mx-3 mb-2 rounded-2xl border border-border/30 bg-card/95 backdrop-blur-xl shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-around px-1 py-2">
          {navItems.map((item) => {
            const active = getActive(item.path);
            const isCart = item.key === "cart";

            const content = (
              <div
                className={`relative flex items-center justify-center gap-1.5 rounded-full transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                  active
                    ? "bg-foreground px-4 py-2 shadow-lg"
                    : "px-2 py-2"
                }`}
              >
                {/* Cart badge */}
                {isCart && cartCount > 0 && (
                  <span
                    className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[8px] font-bold text-destructive-foreground z-10 transition-transform duration-300"
                    style={{ transform: active ? "scale(0.9)" : "scale(1)" }}
                  >
                    {cartCount > 9 ? "9+" : cartCount}
                  </span>
                )}

                <item.icon
                  className={`transition-all duration-400 ease-out ${
                    active ? "h-4 w-4 text-background" : "h-5 w-5 text-muted-foreground"
                  }`}
                  strokeWidth={active ? 2.5 : 1.8}
                />

                {/* Label — only visible when active, animates width */}
                <span
                  className={`text-[11px] font-semibold whitespace-nowrap overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                    active
                      ? "max-w-[60px] opacity-100 text-background"
                      : "max-w-0 opacity-0"
                  }`}
                >
                  {item.label}
                </span>
              </div>
            );

            if (isCart) {
              return (
                <button
                  key={item.key}
                  onClick={openCart}
                  className="relative flex items-center justify-center outline-none"
                  aria-label={`Cart${cartCount > 0 ? `, ${cartCount} items` : ""}`}
                >
                  {content}
                </button>
              );
            }

            return (
              <Link
                key={item.key}
                to={item.path === "" ? storePath : storefrontPath(store.slug, item.path)}
                className="relative flex items-center justify-center"
                aria-label={item.label}
              >
                {content}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
