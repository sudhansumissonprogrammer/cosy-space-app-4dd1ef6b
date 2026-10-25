import { Link, useLocation } from "react-router-dom";
import { useLayoutEffect, useRef, useState } from "react";
import { storefrontPath } from "@/lib/subdomain";
import { useCart } from "@/contexts/CartContext";
import { navTap } from "@/lib/navHaptic";
import { useNavIcons } from "@/hooks/useNavIcons";
import type { StoreData } from "@/layouts/StorefrontLayout";
import { waPhoneNumber } from "@/lib/phoneUtils";

function WhatsAppIcon({ className, strokeWidth }: { className?: string; strokeWidth?: number }) {
  void strokeWidth;
  return (
    <svg viewBox="0 0 32 32" fill="#25D366" className={className} aria-hidden="true">
      <path d="M16.004 3.2C9.056 3.2 3.406 8.848 3.404 15.8c-.001 2.222.58 4.392 1.683 6.303L3.2 28.8l6.867-1.802A12.56 12.56 0 0 0 16 28.398h.005C22.95 28.398 28.6 22.75 28.6 15.8 28.6 8.85 22.95 3.2 16.004 3.2Zm0 22.997h-.004a10.44 10.44 0 0 1-5.318-1.457l-.382-.226-3.955 1.038 1.055-3.858-.249-.395A10.42 10.42 0 0 1 5.54 15.8c.002-5.77 4.697-10.463 10.466-10.463 5.77 0 10.463 4.695 10.463 10.464 0 5.77-4.695 10.465-10.465 10.465v-.069Zm5.74-7.835c-.315-.158-1.863-.92-2.152-1.025-.289-.105-.499-.158-.71.158-.21.315-.815 1.025-.999 1.236-.184.21-.368.236-.683.079-.315-.158-1.33-.49-2.533-1.562-.937-.835-1.568-1.867-1.752-2.182-.184-.315-.02-.486.138-.643.142-.141.315-.368.473-.552.158-.184.21-.315.315-.526.106-.21.053-.394-.026-.552-.079-.158-.71-1.71-.973-2.341-.256-.615-.517-.532-.71-.542-.184-.008-.394-.01-.604-.01s-.552.079-.841.394c-.29.315-1.104 1.078-1.104 2.63 0 1.552 1.13 3.052 1.288 3.262.158.21 2.224 3.396 5.388 4.762.753.326 1.341.52 1.8.665.756.24 1.444.206 1.988.125.607-.09 1.863-.762 2.126-1.498.263-.736.263-1.367.184-1.498-.079-.132-.289-.21-.604-.369Z" />
    </svg>
  );
}

interface MobileBottomNavProps {
  store: StoreData;
  /** Theme-16 only: show WhatsApp here instead of Cart (cart lives in the header). */
  swapCartWhatsApp?: boolean;
  rounded?: boolean;
}

export default function MobileBottomNav({ store, swapCartWhatsApp = false, rounded = false }: MobileBottomNavProps) {
  const location = useLocation();
  const { cartCount, openCart, cartBounce } = useCart();
  const getIcon = useNavIcons(store.id);
  const HomeIcon = getIcon("home");
  const ShopIcon = getIcon("shop");
  const CategoriesIcon = getIcon("categories");
  const CartIcon = getIcon("cart");
  const OrdersIcon = getIcon("orders");
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

  const waNumber = waPhoneNumber((store as any).whatsapp_number) ?? "";
  const waHref = `https://wa.me/${waNumber}?text=${encodeURIComponent(`Hi ${store.name}! 👋\nI'm interested in buying products from your store. Could you help me?`)}`;

  const navItems = [
    { key: "home", label: "Home", icon: HomeIcon, to: storefrontPath(store.slug), active: isHome },
    { key: "shop", label: "Shop", icon: ShopIcon, to: storefrontPath(store.slug, "shop"), active: isActive("shop") },
    { key: "categories", label: "Categories", icon: CategoriesIcon, to: storefrontPath(store.slug, "categories"), active: isActive("categories") || isActive("category") },
    swapCartWhatsApp && waNumber
      ? {
          key: "whatsapp",
          label: "WhatsApp",
          icon: WhatsAppIcon,
          to: waHref,
          active: false,
          onClick: (e: React.MouseEvent) => {
            e.preventDefault();
            window.open(waHref, "_blank", "noopener,noreferrer");
          },
        }
      : {
          key: "cart",
          label: "Cart",
          icon: CartIcon,
          to: storefrontPath(store.slug, "cart"),
          active: isActive("cart"),
          onClick: (e: React.MouseEvent) => { e.preventDefault(); openCart(); },
        },
    { key: "orders", label: "Orders", icon: OrdersIcon, to: storefrontPath(store.slug, "account"), active: isActive("account") || isActive("login") || isActive("orders") },
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
      aria-label="Store navigation"
      className={`sfg sfg-bar-bottom fixed bottom-0 inset-x-0 z-40 sm:hidden ${rounded ? "sfg-classic-rounded" : "safe-bottom"}`}
      style={{
        backgroundColor: "color-mix(in srgb, var(--storefront-bg, hsl(var(--card))) 72%, transparent)",
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
