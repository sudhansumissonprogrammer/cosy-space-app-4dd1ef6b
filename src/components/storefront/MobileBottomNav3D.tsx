/**
 * MobileBottomNav3D — Skeuomorphic 3D tab bar. Each tab is a physical button
 * with depth shadow. Active button "lifts up" with stronger shadow + slight
 * translate-Y. Retro-premium feel.
 */
import { Link, useLocation } from "react-router-dom";
import { storefrontPath } from "@/lib/subdomain";
import { useCart } from "@/contexts/CartContext";
import { useStorefrontAuth } from "@/contexts/StorefrontAuthContext";
import { navTap } from "@/lib/navHaptic";
import { useNavIcons } from "@/hooks/useNavIcons";
import type { StoreData } from "@/layouts/StorefrontLayout";

export default function MobileBottomNav3D({ store }: { store: StoreData }) {
  const location = useLocation();
  const { cartCount, openCart, cartBounce } = useCart();
  const { user } = useStorefrontAuth();
  const getIcon = useNavIcons(store.id);

  if (location.pathname.includes("/checkout") || location.pathname.includes("/product/")) return null;

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
      className="fixed bottom-0 inset-x-0 z-40 sm:hidden"
      style={{
        background:
          "linear-gradient(180deg, color-mix(in srgb, var(--storefront-bg, hsl(var(--card))) 100%, transparent) 0%, color-mix(in srgb, var(--storefront-bg, hsl(var(--card))) 92%, #000 8%) 100%)",
        borderTop: "1px solid color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 10%, transparent)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4), 0 -4px 12px rgba(0,0,0,0.06)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div className="flex items-end justify-around px-2 pt-3 pb-2 gap-1.5">
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
              className="relative flex-1 flex flex-col items-center justify-center gap-1 rounded-2xl outline-none transition-all duration-200 ease-out active:translate-y-[2px] active:shadow-inner"
              style={{
                padding: "8px 4px 7px",
                transform: active ? "translateY(-3px)" : "translateY(0)",
                background: active
                  ? "linear-gradient(180deg, color-mix(in srgb, var(--storefront-primary, hsl(var(--primary))) 22%, var(--storefront-bg, #fff)) 0%, color-mix(in srgb, var(--storefront-primary, hsl(var(--primary))) 8%, var(--storefront-bg, #fff)) 100%)"
                  : "linear-gradient(180deg, color-mix(in srgb, var(--storefront-bg, #fff) 100%, transparent) 0%, color-mix(in srgb, var(--storefront-bg, #fff) 90%, #000 10%) 100%)",
                boxShadow: active
                  ? "0 6px 14px -4px color-mix(in srgb, var(--storefront-primary, hsl(var(--primary))) 50%, transparent), 0 2px 4px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(0,0,0,0.08)"
                  : "0 2px 4px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.06)",
                border: "1px solid color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 8%, transparent)",
              }}
            >
              <div
                {...(isCart ? { "data-cart-target": "" } : {})}
                className={`relative flex items-center justify-center ${isCart && cartBounce ? "cart-bounce" : ""}`}
              >
                <item.icon
                  className="h-[22px] w-[22px] transition-colors shrink-0"
                  strokeWidth={active ? 2.4 : 2}
                  style={{
                    color: active
                      ? "var(--storefront-primary, hsl(var(--primary)))"
                      : "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 70%, transparent)",
                    filter: active
                      ? "drop-shadow(0 1px 1px rgba(255,255,255,0.6))"
                      : "drop-shadow(0 1px 0 rgba(255,255,255,0.4))",
                  }}
                />
                {count > 0 && (
                  <span
                    className="absolute -right-2 -top-2 flex items-center justify-center rounded-full text-[9px] font-bold min-w-[16px] h-[16px] px-1"
                    style={{
                      background: "linear-gradient(180deg, hsl(var(--destructive)) 0%, color-mix(in srgb, hsl(var(--destructive)) 80%, #000) 100%)",
                      color: "hsl(var(--destructive-foreground))",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.3)",
                    }}
                  >
                    {count > 9 ? "9+" : count}
                  </span>
                )}
              </div>
              <span
                className="text-[10px] font-bold leading-none transition-colors"
                style={{
                  fontFamily: "var(--storefront-body-font, inherit)",
                  color: active
                    ? "var(--storefront-primary, hsl(var(--primary)))"
                    : "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 65%, transparent)",
                  textShadow: active
                    ? "0 1px 0 rgba(255,255,255,0.6)"
                    : "0 1px 0 rgba(255,255,255,0.4)",
                }}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
