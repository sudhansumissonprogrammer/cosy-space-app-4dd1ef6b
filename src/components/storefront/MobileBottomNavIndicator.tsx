/**
 * MobileBottomNavIndicator — Side-scroll pill / browser-tab indicator style.
 * A thin colored bar at the TOP edge slides horizontally between active tabs.
 * Bottom is clean & minimal. Editorial / news vibe.
 */
import { Link, useLocation } from "react-router-dom";
import { storefrontPath } from "@/lib/subdomain";
import { useCart } from "@/contexts/CartContext";
import { useStorefrontAuth } from "@/contexts/StorefrontAuthContext";
import { navTap } from "@/lib/navHaptic";
import { useNavIcons } from "@/hooks/useNavIcons";
import type { StoreData } from "@/layouts/StorefrontLayout";

export default function MobileBottomNavIndicator({ store }: { store: StoreData }) {
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

  const activeIndex = Math.max(0, navItems.findIndex((i) => getActive(i.path)));
  const itemWidthPct = 100 / navItems.length;
  // Indicator pill is 50% of slot width, centered
  const indicatorLeft = activeIndex * itemWidthPct + itemWidthPct * 0.25;
  const indicatorWidth = itemWidthPct * 0.5;

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 sm:hidden"
      style={{
        backgroundColor: "var(--storefront-bg, hsl(var(--card)))",
        borderTop: "1px solid color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 8%, transparent)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {/* Top sliding indicator bar */}
      <div className="relative h-[3px] w-full overflow-hidden">
        <div
          className="absolute top-0 h-full rounded-b-full transition-all duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{
            left: `${indicatorLeft}%`,
            width: `${indicatorWidth}%`,
            background:
              "linear-gradient(90deg, color-mix(in srgb, var(--storefront-primary, hsl(var(--primary))) 60%, transparent) 0%, var(--storefront-primary, hsl(var(--primary))) 50%, color-mix(in srgb, var(--storefront-primary, hsl(var(--primary))) 60%, transparent) 100%)",
            boxShadow: "0 1px 6px color-mix(in srgb, var(--storefront-primary, hsl(var(--primary))) 50%, transparent)",
          }}
        />
      </div>

      <div className="flex items-stretch justify-around px-1 pt-2 pb-1.5">
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
              className="flex-1 relative flex flex-col items-center justify-center gap-1 py-1.5 px-1 outline-none transition-all duration-200 active:scale-[0.94]"
            >
              <div
                {...(isCart ? { "data-cart-target": "" } : {})}
                className={`relative flex items-center justify-center ${isCart && cartBounce ? "cart-bounce" : ""}`}
              >
                <item.icon
                  className="h-[22px] w-[22px] transition-colors shrink-0"
                  strokeWidth={active ? 2.3 : 1.9}
                  style={{
                    color: active
                      ? "var(--storefront-primary, hsl(var(--primary)))"
                      : "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 60%, transparent)",
                  }}
                />
                {count > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex items-center justify-center rounded-full bg-destructive text-[8px] font-bold text-destructive-foreground min-w-[15px] h-[15px] px-0.5">
                    {count > 9 ? "9+" : count}
                  </span>
                )}
              </div>
              <span
                className="text-[10px] font-semibold leading-none tracking-wide transition-colors"
                style={{
                  fontFamily: "var(--storefront-body-font, inherit)",
                  color: active
                    ? "var(--storefront-primary, hsl(var(--primary)))"
                    : "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 60%, transparent)",
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
