import { Link, useLocation } from "react-router-dom";
import { Home, ShoppingBag, LayoutGrid, ClipboardList, ShoppingCart } from "lucide-react";
import { storefrontPath } from "@/lib/subdomain";
import { useCart } from "@/contexts/CartContext";
import type { StoreData } from "@/layouts/StorefrontLayout";

interface MobileBottomNavProps {
  store: StoreData;
}

export default function MobileBottomNav({ store }: MobileBottomNavProps) {
  const location = useLocation();
  const { cartCount, openCart, cartBounce } = useCart();
  const isCheckout = location.pathname.includes("/checkout");
  const isProductDetail = location.pathname.includes("/product/");

  if (isCheckout || isProductDetail) return null;

  const currentPath = location.pathname;

  const isActive = (path: string) => {
    const full = storefrontPath(store.slug, path);
    return currentPath === full || currentPath.startsWith(full + "/");
  };

  const isHome = currentPath === storefrontPath(store.slug) || currentPath === storefrontPath(store.slug) + "/";

  const navItems = [
    {
      key: "home",
      label: "Home",
      icon: Home,
      to: storefrontPath(store.slug),
      active: isHome,
    },
    {
      key: "shop",
      label: "Shop",
      icon: ShoppingBag,
      to: storefrontPath(store.slug, "shop"),
      active: isActive("shop"),
    },
    {
      key: "categories",
      label: "Categories",
      icon: LayoutGrid,
      to: storefrontPath(store.slug, "categories"),
      active: isActive("categories") || isActive("category"),
    },
    {
      key: "cart",
      label: "Cart",
      icon: ShoppingCart,
      to: storefrontPath(store.slug, "cart"),
      active: isActive("cart"),
      onClick: (e: React.MouseEvent) => { e.preventDefault(); openCart(); },
    },
    {
      key: "orders",
      label: "Orders",
      icon: ClipboardList,
      to: storefrontPath(store.slug, "account"),
      active: isActive("account"),
    },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t backdrop-blur-md sm:hidden safe-bottom" style={{ backgroundColor: "var(--storefront-bg, hsl(var(--card)))", borderColor: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 10%, transparent)" }}>
      <div className="flex items-stretch justify-around">
        {navItems.map((item) => {
          const count = item.key === "cart" ? cartCount : 0;
          const bouncing = item.key === "cart" && cartBounce;
          return (
            <Link
              key={item.label}
              to={item.to}
              onClick={(item as any).onClick}
              className="relative flex flex-1 flex-col items-center gap-0.5 py-1.5 transition-all active:scale-[0.93]"
              style={{
                color: item.active
                  ? "var(--storefront-primary, hsl(var(--primary)))"
                  : "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 55%, transparent)",
              }}
            >
              <div
                className={`relative flex items-center justify-center rounded-full transition-all duration-[400ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] ${item.active ? "px-3 py-0.5" : "px-1 py-0.5"}`}
                style={item.active ? { backgroundColor: "color-mix(in srgb, var(--storefront-primary, hsl(var(--primary))) 14%, transparent)" } : undefined}
              >
                <item.icon className="h-[18px] w-[18px]" strokeWidth={item.active ? 2.5 : 1.8} />
                {count > 0 && (
                  <span className="absolute -right-2 -top-1.5 flex items-center justify-center rounded-full bg-destructive text-[8px] font-bold text-destructive-foreground min-w-[16px] h-[16px] px-0.5">
                    {count > 9 ? "9+" : count}
                  </span>
                )}
              </div>
              <span
                className="text-[10px] font-medium leading-none"
                style={{ fontFamily: "var(--storefront-body-font, inherit)" }}
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
