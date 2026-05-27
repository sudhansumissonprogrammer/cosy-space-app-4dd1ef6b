/**
 * MobileBottomNavTube — Sliding colored capsule that glides under the active tab.
 * Thick rounded tube with depth, smooth spring physics, label slides in.
 */
import { Link, useLocation } from "react-router-dom";
import { useLayoutEffect, useRef, useState } from "react";
import { storefrontPath } from "@/lib/subdomain";
import { useCart } from "@/contexts/CartContext";
import { useStorefrontAuth } from "@/contexts/StorefrontAuthContext";
import { navTap } from "@/lib/navHaptic";
import { useNavIcons } from "@/hooks/useNavIcons";
import type { StoreData } from "@/layouts/StorefrontLayout";

export default function MobileBottomNavTube({ store }: { store: StoreData }) {
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
  const [tube, setTube] = useState({ x: 0, w: 0, ready: false });

  useLayoutEffect(() => {
    if (!activeKey) return;
    const measure = () => {
      const c = containerRef.current;
      const el = itemRefs.current[activeKey];
      if (!c || !el) return;
      const cr = c.getBoundingClientRect();
      const er = el.getBoundingClientRect();
      const w = er.width - 6;
      const x = er.left - cr.left + 3;
      setTube({ x, w, ready: true });
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
      className="fixed bottom-0 inset-x-0 z-40 sm:hidden pointer-events-none"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="px-3 pb-2 pointer-events-auto">
        <div
          ref={containerRef}
          className="relative flex items-stretch rounded-full px-1.5 py-1.5"
          style={{
            backgroundColor: "var(--storefront-bg, hsl(var(--card)))",
            border: "1px solid color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 10%, transparent)",
            boxShadow: "0 6px 24px rgba(0,0,0,0.12)",
          }}
        >
          {/* Sliding tube */}
          <span
            aria-hidden
            className="pointer-events-none absolute top-1.5 bottom-1.5 rounded-full transition-all duration-[500ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]"
            style={{
              transform: `translateX(${tube.x}px)`,
              width: `${tube.w}px`,
              opacity: tube.ready ? 1 : 0,
              background:
                "linear-gradient(135deg, var(--storefront-primary, hsl(var(--primary))), color-mix(in srgb, var(--storefront-primary, hsl(var(--primary))) 70%, black))",
              boxShadow:
                "0 4px 14px color-mix(in srgb, var(--storefront-primary, hsl(var(--primary))) 45%, transparent), inset 0 1px 0 color-mix(in srgb, white 25%, transparent)",
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
                className="relative z-10 flex flex-1 items-center justify-center gap-1.5 py-2 outline-none transition-transform active:scale-[0.92]"
              >
                <div
                  {...(isCart ? { "data-cart-target": "" } : {})}
                  className={`relative flex items-center justify-center ${isCart && cartBounce ? "cart-bounce" : ""}`}
                >
                  <item.icon
                    className="h-[20px] w-[20px] transition-all"
                    strokeWidth={active ? 2.4 : 2}
                    style={{
                      color: active
                        ? "var(--storefront-btn-text, hsl(var(--primary-foreground)))"
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
                  className={`text-[10.5px] font-semibold whitespace-nowrap overflow-hidden transition-all duration-[500ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                    active ? "max-w-[60px] opacity-100" : "max-w-0 opacity-0"
                  }`}
                  style={{
                    fontFamily: "var(--storefront-body-font, inherit)",
                    color: "var(--storefront-btn-text, hsl(var(--primary-foreground)))",
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
