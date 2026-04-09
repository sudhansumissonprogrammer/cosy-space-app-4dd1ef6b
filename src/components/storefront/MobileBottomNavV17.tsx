/**
 * MobileBottomNavV17 — systumm.shop-inspired bottom nav with custom SVG icons.
 * 5-tab: Home, Account, Shop, Wishlist, Cart
 */
import { Link, useLocation } from "react-router-dom";
import { storefrontPath } from "@/lib/subdomain";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { useStorefrontAuth } from "@/contexts/StorefrontAuthContext";
import type { StoreData } from "@/layouts/StorefrontLayout";

/* Custom SVG icons matching systumm.shop */
function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M19.6325 7.11089L13.1591 3.08871C12.8049 2.86736 12.3957 2.75 11.9781 2.75C11.5604 2.75 11.1512 2.86736 10.797 3.08871L4.32368 7.13318C3.95561 7.36509 3.66347 7.69966 3.4833 8.09564C3.30313 8.49161 3.24281 8.93168 3.30978 9.36153L4.98105 19.3891C5.06886 19.9144 5.34188 20.3908 5.75065 20.7321C6.15942 21.0734 6.67691 21.2571 7.2094 21.2498H16.7913C17.3238 21.2571 17.8413 21.0734 18.2501 20.7321C18.6588 20.3908 18.9319 19.9144 19.0197 19.3891L20.6909 9.36153C20.7582 8.92366 20.6934 8.47568 20.5049 8.07479C20.3164 7.67391 20.0126 7.33833 19.6325 7.11089Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill={active ? "currentColor" : "none"} />
      <path d="M8.63554 16.4588H15.3206" stroke={active ? "var(--storefront-bg, #fff)" : "currentColor"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ShopIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M21.25 9.94445C21.2482 10.5806 21.0497 11.2006 20.6817 11.7195C20.3137 12.2384 19.7942 12.6307 19.1944 12.8428C18.8662 12.9673 18.5177 13.03 18.1667 13.0278C17.5305 13.026 16.9105 12.8275 16.3916 12.4595C15.8727 12.0915 15.4804 11.572 15.2683 10.9722C15.1438 10.644 15.0811 10.2955 15.0833 9.94445C15.0856 10.2955 15.0228 10.644 14.8983 10.9722C14.6863 11.572 14.2939 12.0915 13.775 12.4595C13.2561 12.8275 12.6361 13.026 12 13.0278C11.3639 13.026 10.7439 12.8275 10.225 12.4595C9.70607 12.0915 9.31371 11.572 9.10167 10.9722C8.97716 10.644 8.91443 10.2955 8.91667 9.94445C8.9189 10.2955 8.85618 10.644 8.73167 10.9722C8.51962 11.572 8.12726 12.0915 7.60837 12.4595C7.08948 12.8275 6.46947 13.026 5.83333 13.0278C5.48226 13.03 5.13381 12.9673 4.80556 12.8428C4.2058 12.6307 3.6863 12.2384 3.3183 11.7195C2.95029 11.2006 2.75179 10.5806 2.75 9.94445L3.2125 8.32057L4.3225 5.15501C4.4633 4.75224 4.72595 4.40326 5.07402 4.15648C5.42209 3.9097 5.83833 3.77735 6.265 3.77779H17.735C18.1617 3.77735 18.5779 3.9097 18.926 4.15648C19.274 4.40326 19.5367 4.75224 19.6775 5.15501L20.7875 8.32057L21.25 9.94445Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill={active ? "currentColor" : "none"} />
      <path d="M19.1944 12.8428V18.1667C19.1944 18.7118 18.9778 19.2347 18.5923 19.6202C18.2068 20.0057 17.684 20.2222 17.1388 20.2222H6.86105C6.31588 20.2222 5.79304 20.0057 5.40755 19.6202C5.02206 19.2347 4.80549 18.7118 4.80549 18.1667V12.8428" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.91666 17.1389H15.0833" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AccountIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M19.6177 21.25C19.6177 17.6479 15.6021 14.7206 12 14.7206C8.39794 14.7206 4.38235 17.6479 4.38235 21.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 11.4559C14.404 11.4559 16.3529 9.50701 16.3529 7.10294C16.3529 4.69888 14.404 2.75 12 2.75C9.59594 2.75 7.64706 4.69888 7.64706 7.10294C7.64706 9.50701 9.59594 11.4559 12 11.4559Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill={active ? "currentColor" : "none"} />
    </svg>
  );
}

function CartIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7.53657 21.25H7.54758" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17.9381 21.25H17.9491" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.62838 6.52571H9.60334C12.3104 6.52571 15.0175 6.52571 17.7246 6.52571C18.2498 6.50271 18.7743 6.58341 19.2682 6.76318C19.5116 6.85995 19.73 7.01065 19.9069 7.20397C20.0837 7.39727 20.2145 7.62817 20.2893 7.87927C20.3493 8.45024 20.2761 9.02733 20.0756 9.56528C19.9449 10.1351 19.8263 10.7526 19.7075 11.275C19.4462 12.4624 19.1851 13.6497 18.9714 14.8371C18.9205 15.4101 18.7016 15.9553 18.3421 16.4043C18.1157 16.6114 17.8494 16.7699 17.5594 16.8699C17.2693 16.9699 16.962 17.0095 16.6561 16.986C15.6349 16.986 14.602 16.986 13.569 16.986H9.80509C9.25234 17.0394 8.69568 17.0394 8.14288 16.986C7.8537 16.9546 7.5781 16.8469 7.34439 16.6736C7.11069 16.5004 6.9273 16.2681 6.81307 16.0006C6.61691 15.3381 6.46226 14.6639 6.35001 13.9822C6.25503 13.4478 6.13629 12.9136 6.01756 12.3793C5.60199 10.3964 5.12706 8.43731 4.62838 6.52571ZM4.62838 6.52571C4.31967 5.26714 3.9991 4.00857 3.69039 2.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19.5531 11.9993H5.93447" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WishlistIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

const navItems = [
  { key: "home", label: "Home", Icon: HomeIcon, path: "" },
  { key: "account", label: "Account", Icon: AccountIcon, path: "account" },
  { key: "shop", label: "Shop", Icon: ShopIcon, path: "shop" },
  { key: "wishlist", label: "Wishlist", Icon: WishlistIcon, path: "wishlist" },
  { key: "cart", label: "Cart", Icon: CartIcon, path: "__cart__" },
];

export default function MobileBottomNavV17({ store }: { store: StoreData }) {
  const location = useLocation();
  const { cartCount, openCart, cartBounce } = useCart();
  const { wishlistCount } = useWishlist();
  const { user } = useStorefrontAuth();
  const isCheckout = location.pathname.includes("/checkout");

  if (isCheckout) return null;

  const currentPath = location.pathname;
  const storePath = storefrontPath(store.slug);

  const getActive = (path: string) => {
    if (path === "") return currentPath === storePath || currentPath === storePath + "/";
    if (path === "__cart__") return false;
    const full = storefrontPath(store.slug, path);
    return currentPath === full || currentPath.startsWith(full + "/");
  };

  const getTo = (path: string) => {
    if (path === "") return storePath;
    if (path === "account") return storefrontPath(store.slug, user ? "account" : "login");
    return storefrontPath(store.slug, path);
  };

  const getBadge = (key: string) => {
    if (key === "wishlist") return wishlistCount || 0;
    if (key === "cart") return cartCount || 0;
    return 0;
  };

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 sm:hidden bg-white border-t border-gray-200"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex items-center justify-around h-14">
        {navItems.map((item) => {
          const active = getActive(item.path);
          const badge = getBadge(item.key);
          const isCart = item.key === "cart";

          const content = (
            <div className="flex flex-col items-center justify-center gap-0.5 relative">
              <div className="relative">
                <item.Icon active={active} />
                {badge > 0 && (
                  <span
                    className={`absolute -top-1.5 -right-2 min-w-[16px] h-4 flex items-center justify-center rounded-full text-[9px] font-bold text-white px-1 ${isCart && cartBounce ? "animate-bounce" : ""}`}
                    style={{ backgroundColor: "#1B3A2D" }}
                  >
                    {badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] leading-none ${active ? "font-semibold" : "font-normal text-gray-500"}`}>
                {item.label}
              </span>
            </div>
          );

          if (isCart) {
            return (
              <button key={item.key} onClick={openCart} className="flex-1 flex items-center justify-center h-full text-gray-800">
                {content}
              </button>
            );
          }

          return (
            <Link key={item.key} to={getTo(item.path)} className={`flex-1 flex items-center justify-center h-full ${active ? "text-gray-900" : "text-gray-500"}`}>
              {content}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
