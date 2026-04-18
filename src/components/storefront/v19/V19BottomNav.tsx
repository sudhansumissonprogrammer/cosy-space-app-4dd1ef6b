/**
 * V19 Bottom Nav — 4-tab grocery nav (Home, Categories, Cart, Account)
 * Active = green tint. Cart shows live count badge.
 */
import { Link, useLocation } from "react-router-dom";
import { Home, LayoutGrid, ShoppingCart, User } from "lucide-react";
import { storefrontPath } from "@/lib/subdomain";
import { useCart } from "@/contexts/CartContext";
import { useStorefrontAuth } from "@/contexts/StorefrontAuthContext";

const GREEN = "#036B52";

export default function V19BottomNav({ store }: { store: any }) {
  const location = useLocation();
  const { cartCount } = useCart();
  const { user } = useStorefrontAuth();
  const isCheckout = location.pathname.includes("/checkout");
  if (isCheckout) return null;

  const slug = store?.slug || "";
  const storePath = storefrontPath(slug);

  const items = [
    { key: "home", label: "Home", icon: Home, to: storePath, match: (p: string) => p === storePath || p === storePath + "/" },
    { key: "categories", label: "Categories", icon: LayoutGrid, to: storefrontPath(slug, "categories"), match: (p: string) => p.includes("/categories") || p.includes("/category/") },
    { key: "cart", label: "Cart", icon: ShoppingCart, to: storefrontPath(slug, "cart"), match: (p: string) => p.includes("/cart"), badge: cartCount },
    { key: "account", label: "Account", icon: User, to: storefrontPath(slug, user ? "account" : "login"), match: (p: string) => p.includes("/account") || p.includes("/login") },
  ];

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 sm:hidden bg-white border-t"
      style={{ borderColor: "#e5e7eb", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex items-stretch justify-around h-[60px]">
        {items.map((item) => {
          const active = item.match(location.pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              to={item.to}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 relative"
              style={{ color: active ? GREEN : "#6b7280" }}
            >
              <div className="relative">
                <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.4 : 1.8} />
                {item.badge && item.badge > 0 ? (
                  <span
                    className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] rounded-full text-white text-[9px] font-bold flex items-center justify-center px-1"
                    style={{ background: GREEN }}
                  >
                    {item.badge > 9 ? "9+" : item.badge}
                  </span>
                ) : null}
              </div>
              <span className="text-[10px] font-semibold">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
