/**
 * MobileBottomNavModern — Floating pill navigation with animated active indicator.
 * Active item: colored dot + label slide-in. Inactive: icon only.
 * Includes cart button as elevated circle.
 */
import { Link, useLocation } from "react-router-dom";
import { Home, Store, LayoutGrid, Heart, ClipboardList, ShoppingCart } from "lucide-react";
import { storefrontPath } from "@/lib/subdomain";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { useStorefrontAuth } from "@/contexts/StorefrontAuthContext";
import type { StoreData } from "@/layouts/StorefrontLayout";

const navItems = [
  { key: "home", label: "Home", icon: Home, path: "" },
  { key: "shop", label: "Shop", icon: Store, path: "shop" },
  { key: "categories", label: "Categories", icon: LayoutGrid, path: "categories" },
  { key: "wishlist", label: "Wishlist", icon: Heart, path: "wishlist" },
  { key: "orders", label: "Orders", icon: ClipboardList, path: "account" },
];

export default function MobileBottomNavModern({ store }: { store: StoreData }) {
  const location = useLocation();
  const { cartCount, openCart, cartBounce } = useCart();
  const { wishlistCount } = useWishlist();
  const { user } = useStorefrontAuth();
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

  const getTo = (path: string) => {
    if (path === "") return storePath;
    if (path === "account") return storefrontPath(store.slug, user ? "account" : "login");
    return storefrontPath(store.slug, path);
  };

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 sm:hidden pointer-events-none"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex items-end justify-center gap-2 px-3 pb-1.5 pointer-events-auto">
        {/* Main floating pill */}
        <div
          className="flex items-center justify-around rounded-[28px] px-1.5 py-1 flex-1 shadow-[0_4px_24px_rgba(0,0,0,0.12)]"
          style={{
            backgroundColor: "var(--storefront-bg, hsl(var(--card)))",
            border: "1px solid color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 10%, transparent)",
          }}
        >
          {navItems.map((item) => {
            const active = getActive(item.path);
            const count = item.key === "wishlist" ? wishlistCount : 0;
            return (
              <Link
                key={item.key}
                to={getTo(item.path)}
                className="relative flex items-center justify-center outline-none"
                aria-label={item.label}
              >
                <div
                  className={`relative flex items-center gap-1.5 rounded-full transition-all duration-[450ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                    active ? "px-3 py-1.5" : "px-2 py-1.5"
                  }`}
                  style={
                    active
                      ? {
                          backgroundColor: "var(--storefront-primary, hsl(var(--primary)))",
                        }
                      : undefined
                  }
                >
                  <item.icon
                    className={`shrink-0 transition-all duration-[400ms] ${
                      active ? "h-[15px] w-[15px]" : "h-[18px] w-[18px]"
                    }`}
                    strokeWidth={active ? 2.4 : 1.6}
                    style={{
                      color: active
                        ? "var(--storefront-btn-text, hsl(var(--primary-foreground)))"
                        : "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 60%, transparent)",
                    }}
                  />
                  {count > 0 && !active && (
                    <span className="absolute -right-0.5 -top-0.5 flex items-center justify-center rounded-full bg-destructive text-[8px] font-bold text-destructive-foreground min-w-[15px] h-[15px] px-0.5">
                      {count > 9 ? "9+" : count}
                    </span>
                  )}
                  <span
                    className={`text-[10px] font-semibold whitespace-nowrap overflow-hidden transition-all duration-[450ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                      active ? "max-w-[70px] opacity-100" : "max-w-0 opacity-0"
                    }`}
                    style={{
                      fontFamily: "var(--storefront-body-font, inherit)",
                      color: active
                        ? "var(--storefront-btn-text, hsl(var(--primary-foreground)))"
                        : undefined,
                    }}
                  >
                    {item.label}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Elevated cart circle */}
        <button
          onClick={openCart}
          className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full shadow-[0_4px_24px_rgba(0,0,0,0.12)] transition-transform duration-200 active:scale-90 ${cartBounce ? "cart-bounce" : ""}`}
          style={{
            backgroundColor: "var(--storefront-primary, hsl(var(--primary)))",
          }}
          aria-label={`Cart${cartCount > 0 ? `, ${cartCount} items` : ""}`}
        >
          <ShoppingCart
            className="h-[18px] w-[18px]"
            strokeWidth={1.8}
            style={{ color: "var(--storefront-btn-text, hsl(var(--primary-foreground)))" }}
          />
          {cartCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground min-w-[18px] h-[18px] px-1">
              {cartCount > 9 ? "9+" : cartCount}
            </span>
          )}
        </button>
      </div>
    </nav>
  );
}
