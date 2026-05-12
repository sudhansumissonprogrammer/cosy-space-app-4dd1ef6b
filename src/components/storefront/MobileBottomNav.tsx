import { Link, useLocation } from "react-router-dom";
import { Home, ShoppingBag, LayoutGrid, ClipboardList, Heart } from "lucide-react";
import { storefrontPath } from "@/lib/subdomain";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import type { StoreData } from "@/layouts/StorefrontLayout";

interface MobileBottomNavProps {
  store: StoreData;
}

export default function MobileBottomNav({ store }: MobileBottomNavProps) {
  const location = useLocation();
  const { wishlistCount } = useWishlist();
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
      label: "Home",
      icon: Home,
      to: storefrontPath(store.slug),
      active: isHome,
    },
    {
      label: "Shop",
      icon: ShoppingBag,
      to: storefrontPath(store.slug, "shop"),
      active: isActive("shop"),
    },
    {
      label: "Categories",
      icon: LayoutGrid,
      to: storefrontPath(store.slug, "categories"),
      active: isActive("categories") || isActive("category"),
    },
    {
      label: "Wishlist",
      icon: Heart,
      to: storefrontPath(store.slug, "wishlist"),
      active: isActive("wishlist"),
    },
    {
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
          const count = item.label === "Wishlist" ? wishlistCount : 0;
          return (
            <Link
              key={item.label}
              to={item.to}
              className="relative flex flex-1 flex-col items-center gap-0.5 py-2.5 transition-all active:scale-[0.93]"
              style={{
                color: item.active
                  ? "var(--storefront-primary, hsl(var(--primary)))"
                  : "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 55%, transparent)",
              }}
            >
              <div
                className={`relative flex items-center justify-center rounded-full transition-all duration-[400ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] ${item.active ? "px-3 py-1" : "px-1 py-1"}`}
                style={item.active ? { backgroundColor: "color-mix(in srgb, var(--storefront-primary, hsl(var(--primary))) 14%, transparent)" } : undefined}
              >
                <item.icon className="h-5 w-5" strokeWidth={item.active ? 2.5 : 1.8} />
                {count > 0 && (
                  <span className="absolute -right-2 -top-1.5 flex items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground min-w-[18px] h-[18px] px-0.5">
                    {count > 9 ? "9+" : count}
                  </span>
                )}
              </div>
              <span
                className="text-[11px] font-medium leading-none"
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
