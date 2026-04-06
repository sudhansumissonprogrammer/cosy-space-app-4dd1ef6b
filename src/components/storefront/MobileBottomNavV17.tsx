/**
 * MobileBottomNavV17 — Floating glassmorphism pill nav for Theme 17.
 * Centered pill with 4 items + accent dot indicator for active state.
 */
import { Link, useLocation } from "react-router-dom";
import { Home, Store, Heart, ShoppingBag } from "lucide-react";
import { storefrontPath } from "@/lib/subdomain";
import { useCart } from "@/contexts/CartContext";
import type { Tables } from "@/integrations/supabase/types";

type StoreData = Tables<"stores">;

const navItems = [
  { key: "home", label: "Home", icon: Home, path: "" },
  { key: "shop", label: "Shop", icon: Store, path: "shop" },
  { key: "wishlist", label: "Wishlist", icon: Heart, path: "wishlist" },
];

export default function MobileBottomNavV17({ store }: { store: StoreData }) {
  const location = useLocation();
  const { cartCount, openCart } = useCart();
  const isCheckout = location.pathname.includes("/checkout");

  if (isCheckout) return null;

  const currentPath = location.pathname;
  const storePath = storefrontPath(store.slug);

  const getActive = (path: string) => {
    if (path === "") return currentPath === storePath || currentPath === storePath + "/";
    const full = storefrontPath(store.slug, path);
    return currentPath === full || currentPath.startsWith(full + "/");
  };

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 sm:hidden flex justify-center pb-3"
      style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
    >
      <div
        className="flex items-center gap-1 rounded-full px-3 py-2 shadow-xl"
        style={{
          background: "rgba(255,255,255,0.65)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          border: "1px solid rgba(255,255,255,0.4)",
        }}
      >
        {navItems.map((item) => {
          const active = getActive(item.path);
          return (
            <Link
              key={item.key}
              to={item.path === "" ? storePath : storefrontPath(store.slug, item.path)}
              className="relative flex flex-col items-center justify-center px-4 py-1.5 outline-none"
              aria-label={item.label}
            >
              <item.icon
                className={`h-5 w-5 transition-colors duration-300 ${active ? "text-[var(--storefront-primary)]" : "text-gray-500"}`}
                strokeWidth={active ? 2.2 : 1.6}
                fill={active && item.key === "wishlist" ? "var(--storefront-primary)" : "none"}
              />
              {/* Active dot indicator */}
              <span
                className={`mt-1 h-1 w-1 rounded-full transition-all duration-300 ${
                  active ? "scale-100 opacity-100" : "scale-0 opacity-0"
                }`}
                style={{ background: "var(--storefront-accent, #F56E0F)" }}
              />
            </Link>
          );
        })}

        {/* Cart button */}
        <button
          onClick={openCart}
          className="relative flex flex-col items-center justify-center px-4 py-1.5 outline-none"
          aria-label={`Cart${cartCount > 0 ? `, ${cartCount} items` : ""}`}
        >
          <ShoppingBag className="h-5 w-5 text-gray-500" strokeWidth={1.6} />
          {cartCount > 0 && (
            <span
              className="absolute -right-0.5 top-0 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold text-white"
              style={{ background: "var(--storefront-accent, #F56E0F)" }}
            >
              {cartCount > 9 ? "9+" : cartCount}
            </span>
          )}
          <span className="mt-1 h-1 w-1 rounded-full scale-0 opacity-0" />
        </button>
      </div>
    </nav>
  );
}
