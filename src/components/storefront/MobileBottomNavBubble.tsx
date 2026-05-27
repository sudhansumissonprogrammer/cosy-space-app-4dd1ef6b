/**
 * MobileBottomNavBubble — Material You style. Active = wide pill bubble
 * around icon+label. Inactive = icon only. Bouncy spring animation.
 */
import { Link, useLocation } from "react-router-dom";
import { storefrontPath } from "@/lib/subdomain";
import { useCart } from "@/contexts/CartContext";
import { useStorefrontAuth } from "@/contexts/StorefrontAuthContext";
import { navTap } from "@/lib/navHaptic";
import { useNavIcons } from "@/hooks/useNavIcons";
import type { StoreData } from "@/layouts/StorefrontLayout";

export default function MobileBottomNavBubble({ store }: { store: StoreData }) {
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
      className="fixed bottom-0 inset-x-0 z-40 border-t sm:hidden"
      style={{
        backgroundColor: "var(--storefront-bg, hsl(var(--card)))",
        borderColor: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 8%, transparent)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div className="flex items-stretch justify-around px-2 py-2 gap-1">
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
              className={`relative flex items-center justify-center gap-1.5 rounded-full outline-none transition-all duration-[450ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-[0.94] ${
                active ? "px-3.5 py-2 flex-[1.6]" : "px-2 py-2 flex-1"
              }`}
              style={
                active
                  ? {
                      backgroundColor:
                        "color-mix(in srgb, var(--storefront-primary, hsl(var(--primary))) 18%, transparent)",
                    }
                  : undefined
              }
            >
              <div
                {...(isCart ? { "data-cart-target": "" } : {})}
                className={`relative flex items-center justify-center ${isCart && cartBounce ? "cart-bounce" : ""}`}
              >
                <item.icon
                  className="h-[22px] w-[22px] transition-colors shrink-0"
                  strokeWidth={active ? 2.4 : 1.9}
                  style={{
                    color: active
                      ? "var(--storefront-primary, hsl(var(--primary)))"
                      : "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 65%, transparent)",
                  }}
                />
                {count > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex items-center justify-center rounded-full bg-destructive text-[8px] font-bold text-destructive-foreground min-w-[15px] h-[15px] px-0.5">
                    {count > 9 ? "9+" : count}
                  </span>
                )}
              </div>
              <span
                className={`text-[11px] font-bold whitespace-nowrap overflow-hidden transition-all duration-[450ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                  active ? "max-w-[80px] opacity-100" : "max-w-0 opacity-0"
                }`}
                style={{
                  fontFamily: "var(--storefront-body-font, inherit)",
                  color: "var(--storefront-primary, hsl(var(--primary)))",
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
