/**
 * MobileBottomNavNotch — Curved notch bar with elevated center cart FAB.
 * SVG-cut notch wraps around a floating circular cart button.
 * Modern e-commerce feel (Instacart / Bolt style).
 */
import { Link, useLocation } from "react-router-dom";
import { storefrontPath } from "@/lib/subdomain";
import { useCart } from "@/contexts/CartContext";
import { useStorefrontAuth } from "@/contexts/StorefrontAuthContext";
import { navTap } from "@/lib/navHaptic";
import { useNavIcons } from "@/hooks/useNavIcons";
import type { StoreData } from "@/layouts/StorefrontLayout";

export default function MobileBottomNavNotch({ store }: { store: StoreData }) {
  const location = useLocation();
  const { cartCount, openCart, cartBounce } = useCart();
  const { user } = useStorefrontAuth();
  const getIcon = useNavIcons(store.id);

  const isCheckout = location.pathname.includes("/checkout");
  const isProductDetail = location.pathname.includes("/product/");
  if (isCheckout || isProductDetail) return null;

  // Cart is rendered as floating center FAB; bar holds 4 side tabs.
  const sideItems = [
    { key: "home", label: "Home", icon: getIcon("home"), path: "" },
    { key: "shop", label: "Shop", icon: getIcon("shop"), path: "shop" },
    { key: "categories", label: "Categories", icon: getIcon("categories"), path: "categories" },
    { key: "orders", label: "Orders", icon: getIcon("orders"), path: "account" },
  ];
  const CartIcon = getIcon("cart");

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
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label="Bottom navigation"
    >
      {/* SVG curved bar with notch cutout */}
      <div className="relative h-[68px]">
        <svg
          aria-hidden
          viewBox="0 0 400 68"
          preserveAspectRatio="none"
          className="absolute inset-x-0 bottom-0 w-full h-[68px]"
          style={{
            filter: "drop-shadow(0 -4px 14px rgba(0,0,0,0.10))",
          }}
        >
          {/* Path: left edge -> up to notch start -> arc dip down -> arc up -> right edge */}
          <path
            d="M0,8 L160,8 C172,8 175,28 200,28 C225,28 228,8 240,8 L400,8 L400,68 L0,68 Z"
            fill="var(--storefront-bg, hsl(var(--card)))"
            stroke="color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 8%, transparent)"
            strokeWidth="1"
          />
        </svg>

        {/* Tabs row (4 side items, gap reserved for center FAB) */}
        <div className="absolute inset-x-0 bottom-0 h-[60px] grid grid-cols-5 items-center px-1">
          {sideItems.slice(0, 2).map((item) => (
            <NotchTab key={item.key} item={item} active={getActive(item.path)} to={getTo(item.path)} />
          ))}
          <div /> {/* slot for center FAB */}
          {sideItems.slice(2).map((item) => (
            <NotchTab key={item.key} item={item} active={getActive(item.path)} to={getTo(item.path)} />
          ))}
        </div>

        {/* Floating center cart FAB */}
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); navTap(); openCart(); }}
          aria-label="Cart"
          className="absolute left-1/2 -top-1 z-10 flex h-14 w-14 items-center justify-center rounded-full active:scale-95 transition-transform"
          style={{
            transform: "translateX(-50%)",
            background:
              "linear-gradient(135deg, var(--storefront-primary, hsl(var(--primary))), color-mix(in srgb, var(--storefront-primary, hsl(var(--primary))) 70%, black))",
            boxShadow:
              "0 8px 22px color-mix(in srgb, var(--storefront-primary, hsl(var(--primary))) 45%, transparent), 0 2px 4px rgba(0,0,0,0.15)",
          }}
        >
          <span data-cart-target="" className="relative flex items-center justify-center">
            <span className={`flex items-center justify-center ${cartBounce ? "cart-bounce" : ""}`}>
              <CartIcon
                className="h-6 w-6"
                strokeWidth={2.2}
                style={{ color: "var(--storefront-btn-text, hsl(var(--primary-foreground)))" }}
              />
            </span>
          </span>
          {cartCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground min-w-[18px] h-[18px] px-1 border-2 border-[var(--storefront-bg,hsl(var(--card)))]">
              {cartCount > 9 ? "9+" : cartCount}
            </span>
          )}
        </button>
      </div>
    </nav>
  );
}

function NotchTab({
  item,
  active,
  to,
}: {
  item: { key: string; label: string; icon: any };
  active: boolean;
  to: string;
}) {
  return (
    <Link
      to={to}
      onClick={() => navTap()}
      aria-label={item.label}
      className="flex flex-col items-center justify-center gap-0.5 outline-none transition-transform active:scale-[0.9]"
    >
      <item.icon
        className="h-[20px] w-[20px] transition-colors"
        strokeWidth={active ? 2.6 : 2}
        style={{
          color: active
            ? "var(--storefront-primary, hsl(var(--primary)))"
            : "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 55%, transparent)",
        }}
      />
      <span
        className="text-[9.5px] font-semibold leading-none"
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
}
