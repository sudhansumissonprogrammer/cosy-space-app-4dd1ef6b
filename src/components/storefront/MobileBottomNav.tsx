import { Link, useLocation } from "react-router-dom";
import { Home, ShoppingBag, LayoutGrid, ClipboardList, ShoppingCart } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { storefrontPath } from "@/lib/subdomain";
import { useCart } from "@/contexts/CartContext";
import { navTap } from "@/lib/navHaptic";
import type { StoreData } from "@/layouts/StorefrontLayout";

interface MobileBottomNavProps {
  store: StoreData;
}

export default function MobileBottomNav({ store }: MobileBottomNavProps) {
  const location = useLocation();
  const { cartCount, openCart, cartBounce } = useCart();
  const isCheckout = location.pathname.includes("/checkout");
  const isProductDetail = location.pathname.includes("/product/");
  const shouldHide = isCheckout || isProductDetail;

  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [pill, setPill] = useState<{ x: number; w: number; ready: boolean }>({ x: 0, w: 0, ready: false });
  const [poppedKey, setPoppedKey] = useState<string | null>(null);

  const currentPath = location.pathname;

  const isActive = (path: string) => {
    const full = storefrontPath(store.slug, path);
    return currentPath === full || currentPath.startsWith(full + "/");
  };

  const isHome = currentPath === storefrontPath(store.slug) || currentPath === storefrontPath(store.slug) + "/";

  const navItems = [
    { key: "home", label: "Home", icon: Home, to: storefrontPath(store.slug), active: isHome },
    { key: "shop", label: "Shop", icon: ShoppingBag, to: storefrontPath(store.slug, "shop"), active: isActive("shop") },
    { key: "categories", label: "Categories", icon: LayoutGrid, to: storefrontPath(store.slug, "categories"), active: isActive("categories") || isActive("category") },
    {
      key: "cart",
      label: "Cart",
      icon: ShoppingCart,
      to: storefrontPath(store.slug, "cart"),
      active: isActive("cart"),
      onClick: (e: React.MouseEvent) => { e.preventDefault(); openCart(); },
    },
    { key: "orders", label: "Orders", icon: ClipboardList, to: storefrontPath(store.slug, "account"), active: isActive("account") || isActive("login") || isActive("orders") },
  ];

  const activeKey = navItems.find((i) => i.active)?.key ?? null;

  // Measure the active item and position the sliding pill under it.
  useLayoutEffect(() => {
    if (shouldHide || !activeKey) {
      setPill((p) => ({ ...p, ready: false }));
      return;
    }
    const measure = () => {
      const container = containerRef.current;
      const el = itemRefs.current[activeKey];
      if (!container || !el) return;
      const cRect = container.getBoundingClientRect();
      const eRect = el.getBoundingClientRect();
      // Pill is sized to the inner icon cluster ~ 56px, centered under each item.
      const w = Math.min(eRect.width - 14, 64);
      const x = eRect.left - cRect.left + (eRect.width - w) / 2;
      setPill({ x, w, ready: true });
    };
    measure();
    // Re-measure on resize / orientation change
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("orientationchange", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", measure);
    };
  }, [activeKey, currentPath, shouldHide]);

  const handleTap = (key: string, extra?: (e: React.MouseEvent) => void) => (e: React.MouseEvent) => {
    navTap();
    setPoppedKey(key);
    window.setTimeout(() => setPoppedKey((k) => (k === key ? null : k)), 380);
    extra?.(e);
  };

  if (shouldHide) return null;

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 border-t backdrop-blur-md sm:hidden safe-bottom"
      style={{
        backgroundColor: "var(--storefront-bg, hsl(var(--card)))",
        borderColor: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 10%, transparent)",
      }}
    >
      <div ref={containerRef} className="relative flex items-stretch justify-around">
        {/* Sliding pill indicator — glides between active tabs */}
        <span
          aria-hidden
          className="nav-pill-indicator"
          data-ready={pill.ready ? "true" : "false"}
          style={{ ["--pill-x" as any]: `${pill.x}px`, ["--pill-w" as any]: `${pill.w}px` }}
        />
        {navItems.map((item) => {
          const count = item.key === "cart" ? cartCount : 0;
          const bouncing = item.key === "cart" && cartBounce;
          const popping = poppedKey === item.key;
          return (
            <Link
              key={item.key}
              ref={(el) => { itemRefs.current[item.key] = el; }}
              to={item.to}
              onClick={handleTap(item.key, (item as any).onClick)}
              className="relative z-10 flex flex-1 flex-col items-center gap-0.5 py-1.5 transition-transform active:scale-[0.92]"
              style={{
                color: item.active
                  ? "var(--storefront-primary, hsl(var(--primary)))"
                  : "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 55%, transparent)",
              }}
            >
              <div
                {...(item.key === "cart" ? { "data-cart-target": "" } : {})}
                className={`relative flex items-center justify-center ${popping ? "nav-icon-pop" : ""} ${bouncing ? "cart-bounce" : ""}`}
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
