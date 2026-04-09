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

  if (isCheckout) return null;

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
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t bg-card/95 backdrop-blur-md sm:hidden safe-bottom">
      <div className="flex items-stretch justify-around">
        {navItems.map((item) => {
          const count = item.label === "Wishlist" ? wishlistCount : 0;
          return (
            <Link
              key={item.label}
              to={item.to}
              className="relative flex flex-1 flex-col items-center gap-0.5 py-2 transition-all active:scale-[0.93]"
              style={{
                color: item.active
                  ? "var(--storefront-primary, hsl(var(--primary)))"
                  : "hsl(var(--muted-foreground))",
              }}
            >
              <div className="relative">
                <item.icon className="h-5 w-5" strokeWidth={item.active ? 2.5 : 1.8} />
                {count > 0 && (
                  <span className="absolute -right-2 -top-1.5 flex items-center justify-center rounded-full bg-destructive text-[8px] font-bold text-destructive-foreground min-w-[15px] h-[15px] px-0.5">
                    {count > 9 ? "9+" : count}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
