/**
 * MobileBottomNavNeon — Flat bar with gradient-glow underline beneath active tab.
 * Animated neon underline slides between tabs. Streetwear / gaming feel.
 */
import { Link, useLocation } from "react-router-dom";
import { useLayoutEffect, useRef, useState } from "react";
import { storefrontPath } from "@/lib/subdomain";
import { useCart } from "@/contexts/CartContext";
import { useStorefrontAuth } from "@/contexts/StorefrontAuthContext";
import { navTap } from "@/lib/navHaptic";
import { useNavIcons } from "@/hooks/useNavIcons";
import type { StoreData } from "@/layouts/StorefrontLayout";

export default function MobileBottomNavNeon({ store }: { store: StoreData }) {
  const location = useLocation();
  const { cartCount, openCart, cartBounce } = useCart();
  const { user } = useStorefrontAuth();
  const getIcon = useNavIcons(store.id);

  const isCheckout = location.pathname.includes("/checkout");
  const isProductDetail = location.pathname.includes("/product/");

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

  const activeKey = navItems.find((i) => getActive(i.path))?.key ?? null;
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [glow, setGlow] = useState({ x: 0, w: 0, ready: false });

  useLayoutEffect(() => {
    if (!activeKey) return;
    const measure = () => {
      const c = containerRef.current;
      const el = itemRefs.current[activeKey];
      if (!c || !el) return;
      const cr = c.getBoundingClientRect();
      const er = el.getBoundingClientRect();
      const w = Math.min(er.width - 12, 52);
      const x = er.left - cr.left + (er.width - w) / 2;
      setGlow({ x, w, ready: true });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("orientationchange", measure);
    return () => { ro.disconnect(); window.removeEventListener("orientationchange", measure); };
  }, [activeKey, currentPath]);

  if (isCheckout || isProductDetail) return null;

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 border-t backdrop-blur-md sm:hidden"
      style={{
        backgroundColor: "color-mix(in srgb, var(--storefront-bg, hsl(var(--card))) 92%, transparent)",
        borderColor: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 10%, transparent)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div ref={containerRef} className="relative flex items-stretch justify-around">
        {/* Animated neon underline */}
        <span
          aria-hidden
          className="pointer-events-none absolute top-0 h-[3px] rounded-full transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
          style={{
            transform: `translateX(${glow.x}px)`,
            width: `${glow.w}px`,
            opacity: glow.ready ? 1 : 0,
            background:
              "linear-gradient(90deg, transparent, var(--storefront-primary, hsl(var(--primary))) 30%, var(--storefront-primary, hsl(var(--primary))) 70%, transparent)",
            boxShadow:
              "0 0 12px var(--storefront-primary, hsl(var(--primary))), 0 0 24px color-mix(in srgb, var(--storefront-primary, hsl(var(--primary))) 60%, transparent)",
          }}
        />
        {/* Soft glow halo behind active item */}
        <span
          aria-hidden
          className="pointer-events-none absolute top-0 h-12 rounded-b-full blur-2xl transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
          style={{
            transform: `translateX(${glow.x - 10}px)`,
            width: `${glow.w + 20}px`,
            opacity: glow.ready ? 0.35 : 0,
            background: "var(--storefront-primary, hsl(var(--primary)))",
          }}
        />
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
              ref={(el) => { itemRefs.current[item.key] = el; }}
              to={getTo(item.path)}
              onClick={handleClick}
              aria-label={item.label}
              className="relative z-10 flex flex-1 flex-col items-center gap-0.5 py-2.5 outline-none transition-transform active:scale-[0.92]"
            >
              <div
                {...(isCart ? { "data-cart-target": "" } : {})}
                className={`relative flex items-center justify-center ${isCart && cartBounce ? "cart-bounce" : ""}`}
              >
                <item.icon
                  className="h-[20px] w-[20px] transition-all"
                  strokeWidth={active ? 2.5 : 1.9}
                  style={{
                    color: active
                      ? "var(--storefront-primary, hsl(var(--primary)))"
                      : "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 60%, transparent)",
                    filter: active
                      ? "drop-shadow(0 0 6px color-mix(in srgb, var(--storefront-primary, hsl(var(--primary))) 70%, transparent))"
                      : undefined,
                  }}
                />
                {count > 0 && (
                  <span className="absolute -right-2 -top-1.5 flex items-center justify-center rounded-full bg-destructive text-[8px] font-bold text-destructive-foreground min-w-[16px] h-[16px] px-0.5">
                    {count > 9 ? "9+" : count}
                  </span>
                )}
              </div>
              <span
                className="text-[10px] font-semibold leading-none transition-colors"
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
