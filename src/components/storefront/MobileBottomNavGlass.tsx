/**
 * MobileBottomNavGlass — Glassmorphic floating pill.
 * Frosted blur + soft inner border + glowing halo behind active icon.
 * Premium Apple/iOS feel. Works on any theme background.
 */
import { Link, useLocation } from "react-router-dom";
import { storefrontPath } from "@/lib/subdomain";
import { useCart } from "@/contexts/CartContext";
import { useStorefrontAuth } from "@/contexts/StorefrontAuthContext";
import { navTap } from "@/lib/navHaptic";
import { useNavIcons } from "@/hooks/useNavIcons";
import type { StoreData } from "@/layouts/StorefrontLayout";

export default function MobileBottomNavGlass({ store }: { store: StoreData }) {
  const location = useLocation();
  const { cartCount, openCart, cartBounce } = useCart();
  const { user } = useStorefrontAuth();
  const getIcon = useNavIcons(store.id);

  const isCheckout = location.pathname.includes("/checkout");
  const isProductDetail = location.pathname.includes("/product/");
  if (isCheckout || isProductDetail) return null;

  const navItems = [
    { key: "home", label: "Home", icon: getIcon("home"), path: "" },
    { key: "shop", label: "Shop", icon: getIcon("shop"), path: "shop" },
    { key: "categories", label: "Categories", icon: getIcon("categories"), path: "categories" },
    { key: "cart", label: "Cart", icon: getIcon("cart"), path: "cart" },
    { key: "orders", label: "Orders", icon: getIcon("orders"), path: "account" },
  ];

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
      <div className="px-3 pb-2 pointer-events-auto">
        <div
          className="flex items-center justify-around rounded-[26px] px-1 py-1.5 backdrop-blur-2xl backdrop-saturate-150 shadow-[0_8px_32px_rgba(0,0,0,0.18)]"
          style={{
            backgroundColor: "color-mix(in srgb, var(--storefront-bg, hsl(var(--card))) 65%, transparent)",
            border: "1px solid color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 12%, transparent)",
            boxShadow:
              "0 8px 32px rgba(0,0,0,0.18), inset 0 1px 0 color-mix(in srgb, white 25%, transparent)",
          }}
        >
          {navItems.map((item) => {
            const active = getActive(item.path);
            const isCart = item.key === "cart";
            const count = isCart ? cartCount : 0;
            const handleClick = (e: React.MouseEvent) => {
              navTap();
              if (isCart) { e.preventDefault(); openCart(); }
            };
            return (
              <Link
                key={item.key}
                to={getTo(item.path)}
                onClick={handleClick}
                aria-label={item.label}
                className="relative flex flex-col items-center justify-center flex-1 py-1.5 outline-none transition-transform active:scale-[0.92]"
              >
                {/* Glow halo behind active icon */}
                {active && (
                  <span
                    aria-hidden
                    className="absolute top-1 h-9 w-9 rounded-full blur-md opacity-70 animate-scale-in"
                    style={{ backgroundColor: "var(--storefront-primary, hsl(var(--primary)))" }}
                  />
                )}
                <div
                  {...(isCart ? { "data-cart-target": "" } : {})}
                  className={`relative flex items-center justify-center h-9 w-9 rounded-full transition-all duration-300 ${
                    isCart && cartBounce ? "cart-bounce" : ""
                  }`}
                  style={
                    active
                      ? {
                          background:
                            "linear-gradient(135deg, var(--storefront-primary, hsl(var(--primary))), color-mix(in srgb, var(--storefront-primary, hsl(var(--primary))) 70%, white))",
                          boxShadow:
                            "0 4px 14px color-mix(in srgb, var(--storefront-primary, hsl(var(--primary))) 45%, transparent)",
                        }
                      : undefined
                  }
                >
                  <item.icon
                    className="h-[20px] w-[20px] transition-all"
                    strokeWidth={active ? 2.4 : 2}
                    style={{
                      color: active
                        ? "var(--storefront-btn-text, hsl(var(--primary-foreground)))"
                        : "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 70%, transparent)",
                    }}
                  />
                  {count > 0 && (
                    <span className="absolute -right-1 -top-1 flex items-center justify-center rounded-full bg-destructive text-[8px] font-bold text-destructive-foreground min-w-[15px] h-[15px] px-0.5">
                      {count > 9 ? "9+" : count}
                    </span>
                  )}
                </div>
                <span
                  className={`mt-0.5 text-[9px] font-semibold leading-none transition-all ${
                    active ? "opacity-100" : "opacity-60"
                  }`}
                  style={{
                    fontFamily: "var(--storefront-body-font, inherit)",
                    color: active
                      ? "var(--storefront-primary, hsl(var(--primary)))"
                      : "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 70%, transparent)",
                  }}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
