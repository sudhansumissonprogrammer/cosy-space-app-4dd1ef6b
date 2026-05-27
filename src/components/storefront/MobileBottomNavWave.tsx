/**
 * MobileBottomNavWave — Black pill bar with a smooth concave "wave dip"
 * carved at the active position. A white circle holding the active icon
 * floats above the dip. Tapping a tab smoothly slides both the dip and
 * the circle to the new position. Inspired by the user-provided design.
 *
 * Implementation:
 *   - Background = SVG rounded rect with a `mask` that subtracts a wave
 *     shape at the active x. Moving the mask `<g>` with CSS transform +
 *     transition gives a perfectly smooth slide of the dip.
 *   - Floating circle = absolutely positioned div translated to the same
 *     x with matching transition + spring easing.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { storefrontPath } from "@/lib/subdomain";
import { useCart } from "@/contexts/CartContext";
import { useStorefrontAuth } from "@/contexts/StorefrontAuthContext";
import { navTap } from "@/lib/navHaptic";
import { useNavIcons } from "@/hooks/useNavIcons";
import type { StoreData } from "@/layouts/StorefrontLayout";

const BAR_HEIGHT = 62;          // visual bar height (excludes lifted circle)
const DIP_RADIUS = 34;          // half-width of the wave cutout
const DIP_DEPTH = 26;           // how deep the dip carves into the bar
const CIRCLE_SIZE = 50;         // floating circle diameter
const CIRCLE_LIFT = 18;         // how far the circle sits above the bar top

export default function MobileBottomNavWave({ store }: { store: StoreData }) {
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
  const isActive = (path: string) => {
    if (path === "") return currentPath === storePath || currentPath === storePath + "/";
    const full = storefrontPath(store.slug, path);
    return currentPath === full || currentPath.startsWith(full + "/");
  };
  const getTo = (path: string) => {
    if (path === "") return storePath;
    if (path === "account") return storefrontPath(store.slug, user ? "account" : "login");
    return storefrontPath(store.slug, path);
  };

  const activeIndex = Math.max(
    0,
    navItems.findIndex((it) => isActive(it.path))
  );
  const ActiveIcon = navItems[activeIndex]?.icon || navItems[0].icon;

  // Measure container width to compute each tab's center x.
  const barRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const update = () => setWidth(el.getBoundingClientRect().width);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const slotWidth = width / navItems.length || 0;
  const activeX = slotWidth * activeIndex + slotWidth / 2;

  // First-mount: skip transition so initial dip appears in place.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (isCheckout || isProductDetail) return null;

  // Wave dip path — a smooth cubic curve dipping down then back up.
  // Drawn in a viewBox of (DIP_RADIUS*2) x BAR_HEIGHT, centered on its own origin.
  // The mask paints this in black to subtract it from the white bar.
  const dipPath = `
    M ${-DIP_RADIUS - 14} 0
    L ${-DIP_RADIUS} 0
    C ${-DIP_RADIUS + 8} 0, ${-DIP_RADIUS + 14} ${DIP_DEPTH}, 0 ${DIP_DEPTH}
    C ${DIP_RADIUS - 14} ${DIP_DEPTH}, ${DIP_RADIUS - 8} 0, ${DIP_RADIUS} 0
    L ${DIP_RADIUS + 14} 0
    L ${DIP_RADIUS + 14} ${-2}
    L ${-DIP_RADIUS - 14} ${-2}
    Z
  `;

  const transition = mounted
    ? "transform 520ms cubic-bezier(0.65, 0, 0.35, 1)"
    : "none";

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 sm:hidden px-3"
      style={{
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 10px)",
      }}
      aria-label="Bottom navigation"
    >
      <div
        ref={barRef}
        className="relative mx-auto"
        style={{ height: BAR_HEIGHT + CIRCLE_LIFT, maxWidth: 520 }}
      >
        {/* Bar SVG (background pill with wave-dip mask) */}
        {width > 0 && (
          <svg
            width={width}
            height={BAR_HEIGHT}
            viewBox={`0 0 ${width} ${BAR_HEIGHT}`}
            className="absolute left-0 bottom-0 block"
            style={{ filter: "drop-shadow(0 6px 18px rgba(0,0,0,0.18))" }}
            aria-hidden
          >
            <defs>
              <mask id="wave-dip-mask" maskUnits="userSpaceOnUse">
                <rect x="0" y="0" width={width} height={BAR_HEIGHT} fill="white" />
                {/* The dip — black subtracts from the bar. Translated to active x. */}
                <g
                  style={{
                    transform: `translateX(${activeX}px)`,
                    transition,
                  }}
                >
                  <path d={dipPath} fill="black" />
                </g>
              </mask>
            </defs>
            <rect
              x="0"
              y="0"
              width={width}
              height={BAR_HEIGHT}
              rx={BAR_HEIGHT / 2}
              ry={BAR_HEIGHT / 2}
              fill="var(--storefront-nav-bg, #111114)"
              mask="url(#wave-dip-mask)"
            />
          </svg>
        )}

        {/* Floating active circle — center sits on the bar's top edge so it
            pops above the bar and fills the dip cutout below. */}
        {width > 0 && (
          <div
            className="absolute"
            style={{
              left: 0,
              top: CIRCLE_LIFT - CIRCLE_SIZE / 2,
              transform: `translateX(${activeX - CIRCLE_SIZE / 2}px)`,
              transition,
              width: CIRCLE_SIZE,
              height: CIRCLE_SIZE,
              pointerEvents: "none",
            }}
          >
            <div
              className="flex h-full w-full items-center justify-center rounded-full"
              style={{
                background: "var(--storefront-bg, #ffffff)",
                boxShadow:
                  "0 6px 14px rgba(0,0,0,0.18), inset 0 0 0 1px color-mix(in srgb, var(--storefront-text, #111) 6%, transparent)",
              }}
            >
              <span
                className={`flex h-[34px] w-[34px] items-center justify-center rounded-full ${
                  navItems[activeIndex]?.key === "cart" && cartBounce ? "cart-bounce" : ""
                }`}
                style={{
                  background: "var(--storefront-primary, hsl(var(--primary)))",
                  color: "var(--storefront-btn-text, hsl(var(--primary-foreground)))",
                }}
              >
                <ActiveIcon className="h-[18px] w-[18px]" strokeWidth={2.4} />
              </span>
            </div>
          </div>
        )}

        {/* Tap targets row */}
        <div
          className="absolute left-0 right-0 flex"
          style={{ bottom: 0, height: BAR_HEIGHT }}
        >
          {navItems.map((item, idx) => {
            const active = idx === activeIndex;
            const isCart = item.key === "cart";
            const count = isCart ? cartCount : 0;
            const handleClick = (e: React.MouseEvent) => {
              navTap();
              if (isCart) {
                e.preventDefault();
                openCart();
              }
            };
            return (
              <Link
                key={item.key}
                to={getTo(item.path)}
                onClick={handleClick}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className="flex-1 flex items-center justify-center outline-none active:scale-[0.92] transition-transform"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                {/* Inactive icon shown inside the bar; hidden when active (circle covers it) */}
                <span
                  {...(isCart ? { "data-cart-target": "" } : {})}
                  className="relative flex items-center justify-center transition-opacity duration-300"
                  style={{ opacity: active ? 0 : 1 }}
                >
                  <item.icon
                    className="h-[22px] w-[22px]"
                    strokeWidth={2.1}
                    style={{ color: "rgba(255,255,255,0.78)" }}
                  />
                  {count > 0 && (
                    <span className="absolute -right-2 -top-1.5 flex items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground min-w-[16px] h-[16px] px-1 border border-[#111114]">
                      {count > 9 ? "9+" : count}
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
