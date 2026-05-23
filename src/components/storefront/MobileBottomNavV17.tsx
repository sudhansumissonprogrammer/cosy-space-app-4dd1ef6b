/**
 * MobileBottomNavV17 — systumm.shop-exact bottom nav with custom SVG icons.
 * White bg, clean icons, heading-style labels.
 */
import { Link, useLocation } from "react-router-dom";
import { storefrontPath } from "@/lib/subdomain";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { useStorefrontAuth } from "@/contexts/StorefrontAuthContext";
import type { StoreData } from "@/layouts/StorefrontLayout";

/* Custom SVG icons matching systumm.shop exactly */
function HomeIcon() {
  return (
    <svg width="20" height="20" fill="none">
      <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10 15.001v-2.5M8.392 2.353 2.617 6.977c-.65.517-1.066 1.609-.924 2.425L2.8 16.035c.2 1.183 1.333 2.141 2.533 2.141h9.332c1.192 0 2.333-.966 2.533-2.141l1.108-6.633c.134-.816-.283-1.908-.924-2.425l-5.775-4.616c-.891-.716-2.333-.716-3.216-.008Z" />
    </svg>
  );
}

function AccountIcon() {
  return (
    <svg width="20" height="20" fill="none">
      <g fill="currentColor"><path d="M18.887 17.699a10.285 10.285 0 0 0-3.768-3.704 10.353 10.353 0 0 0-10.24 0 10.285 10.285 0 0 0-3.768 3.704.87.87 0 0 0 .075.962c.073.09.164.165.268.217a.881.881 0 0 0 .44.114.829.829 0 0 0 .754-.42 8.515 8.515 0 0 1 3.12-3.068 8.572 8.572 0 0 1 8.48 0 8.514 8.514 0 0 1 3.12 3.068.878.878 0 0 0 1.195.315.808.808 0 0 0 .404-.516.869.869 0 0 0-.08-.672ZM10 11.803c1.416 0 2.775-.56 3.784-1.56 1.01-1.001 1.59-2.362 1.617-3.79a5.476 5.476 0 0 0-1.582-3.854 5.375 5.375 0 0 0-3.818-1.596 5.375 5.375 0 0 0-3.819 1.596 5.476 5.476 0 0 0-1.581 3.854 5.474 5.474 0 0 0 1.616 3.79A5.374 5.374 0 0 0 10 11.802Zm-3.6-5.35c0-.964.38-1.888 1.055-2.57a3.583 3.583 0 0 1 2.546-1.063c.955 0 1.87.382 2.545 1.064a3.65 3.65 0 0 1 1.055 2.569 3.65 3.65 0 0 1-1.055 2.569 3.583 3.583 0 0 1-2.545 1.064c-.955 0-1.87-.383-2.546-1.064a3.65 3.65 0 0 1-1.054-2.57Z" /></g>
    </svg>
  );
}

function ShopIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none">
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"><path d="M2.508 9.352v3.742c0 3.741 1.5 5.241 5.242 5.241h4.492c3.741 0 5.241-1.5 5.241-5.241V9.352" /><path d="M10 10.002c1.525 0 2.65-1.242 2.5-2.767l-.55-5.566H8.058L7.5 7.235c-.15 1.525.975 2.767 2.5 2.767Z" /><path d="M15.258 10.002c1.684 0 2.917-1.367 2.75-3.042l-.233-2.291c-.3-2.167-1.133-3-3.317-3h-2.541L12.5 7.51c.142 1.375 1.383 2.492 2.758 2.492ZM4.7 10.002c1.375 0 2.617-1.117 2.75-2.492l.183-1.841.4-4H5.492c-2.184 0-3.017.833-3.317 3L1.95 6.96c-.167 1.675 1.067 3.042 2.75 3.042ZM10 14.169c-1.392 0-2.083.691-2.083 2.083v2.083h4.166v-2.083c0-1.392-.691-2.083-2.083-2.083Z" /></g>
    </svg>
  );
}

function WishlistIcon() {
  return (
    <svg width="22" height="20" fill="none">
      <path fill="currentColor" d="M19.389 2.646C18.35 1.589 16.977 1 15.549 1s-2.801.589-3.84 1.646L11 3.375l-.71-.73C9.256 1.583 7.878.993 6.448 1 5.019.993 3.644 1.583 2.61 2.646a5.496 5.496 0 0 0-1.19 1.82A5.847 5.847 0 0 0 1 6.647c0 .75.143 1.493.42 2.182a5.497 5.497 0 0 0 1.191 1.82l7.828 8.11c.077.072.163.132.256.178a.77.77 0 0 0 .61 0c.093-.046.18-.106.256-.178l7.828-8.11a5.497 5.497 0 0 0 1.19-1.82c.278-.689.421-1.431.421-2.182 0-.75-.143-1.493-.42-2.18a5.497 5.497 0 0 0-1.191-1.821Zm0 3.984a4.149 4.149 0 0 1-.285 1.531c-.19.485-.469.923-.82 1.287L11 17.008l-7.275-7.56a3.883 3.883 0 0 1-.836-1.283 4.129 4.129 0 0 1 0-3.071c.194-.485.479-.922.836-1.283.732-.755 1.709-1.173 2.722-1.165 1.018-.009 2 .409 2.738 1.165l1.254 1.307c.077.072.163.132.256.178a.77.77 0 0 0 .61 0c.093-.046.18-.106.256-.178l1.262-1.307c.732-.755 1.709-1.173 2.722-1.165 1.018-.009 2 .409 2.738 1.165.355.363.637.8.83 1.285.193.484.293 1.006.292 1.534h-.016Z" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg width="20" height="20" fill="none">
      <path fill="currentColor" d="m16.102 4.278-1.2-1.649H6.098L4.898 4.278h11.204Zm2.23.307v.019h.018c.038.077.069.153.094.23a.56.56 0 0 1 .056.25v11.462c0 .333-.069.652-.206.959-.125.294-.294.55-.506.767-.212.23-.468.409-.768.536a2.233 2.233 0 0 1-.918.192H4.898c-.324 0-.637-.07-.937-.21a2.402 2.402 0 0 1-.749-.518 2.312 2.312 0 0 1-.525-.767 2.518 2.518 0 0 1-.187-.959V5.083a1.112 1.112 0 0 1 .075-.345l.038-.077a.3.3 0 0 0 .056-.076l2.398-3.26a.706.706 0 0 1 .28-.23A.71.71 0 0 1 5.705 1h9.592a.71.71 0 0 1 .356.096.706.706 0 0 1 .281.23l2.398 3.259ZM4.111 5.907v10.64c0 .102.018.204.056.306a.747.747 0 0 0 .43.44c.1.04.2.058.3.058h11.204a.74.74 0 0 0 .3-.057.748.748 0 0 0 .43-.44.887.887 0 0 0 .057-.308V5.907H4.11Zm8.786 2.454a.79.79 0 0 1 .225-.575.784.784 0 0 1 .58-.25c.213 0 .394.084.544.25a.758.758 0 0 1 .244.575c0 .562-.106 1.093-.319 1.591-.2.498-.48.933-.843 1.304-.362.37-.787.664-1.274.881a3.977 3.977 0 0 1-1.555.307c-.55 0-1.068-.102-1.555-.307A4.096 4.096 0 0 1 6.81 9.952c-.2-.498-.3-1.029-.3-1.591a.79.79 0 0 1 .225-.575.764.764 0 0 1 .562-.25c.225 0 .413.084.562.25a.758.758 0 0 1 .244.575c0 .345.062.665.187.958.125.294.3.55.525.767a2.259 2.259 0 0 0 1.686.729 2.258 2.258 0 0 0 1.686-.728c.225-.218.4-.474.525-.768.125-.293.187-.613.187-.958Z" />
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
  const isProductDetail = location.pathname.includes("/product/");

  if (isCheckout || isProductDetail) return null;

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
      className="fixed bottom-0 inset-x-0 z-40 sm:hidden"
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        backgroundColor: "var(--storefront-bg, #fff)",
        borderTop: "1px solid var(--storefront-text, #e8e8e3)15",
        fontFamily: "var(--v17-heading-font, 'Cormorant Garamond', serif)",
      }}
    >
      <div className="flex items-center justify-around" style={{ height: "48px", padding: "0 15px" }}>
        {navItems.map((item) => {
          const active = getActive(item.path);
          const badge = getBadge(item.key);
          const isCart = item.key === "cart";

          const itemColor = active ? "var(--v17-primary, #2B4C3F)" : "var(--v17-text, #1a1a1a)";

          const content = (
            <div className="flex flex-col items-center justify-center gap-0.5 relative" style={{ lineHeight: 1 }}>
              <div className="relative" style={{ color: itemColor }}>
                <item.Icon />
                {badge > 0 && (
                  <span
                    className={`absolute flex items-center justify-center rounded-full ${isCart && cartBounce ? "animate-bounce" : ""}`}
                    style={{
                      top: "-4px",
                      right: "-8px",
                      minWidth: "16px",
                      height: "16px",
                      fontSize: "10px",
                      fontWeight: 700,
                      color: "var(--storefront-bg, var(--v17-bg, #fff))",
                      backgroundColor: "var(--v17-primary, #2B4C3F)",
                      padding: "0 3px",
                      fontFamily: "var(--v17-body-font, 'Jost', sans-serif)",
                    }}
                  >
                    {badge}
                  </span>
                )}
              </div>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: active ? 700 : 500,
                  color: itemColor,
                  letterSpacing: "0.02em",
                }}
              >
                {item.label}
              </span>
              {active && (
                <div style={{
                  position: "absolute",
                  bottom: "-8px",
                  left: "25%",
                  right: "25%",
                  height: "2.5px",
                  borderRadius: "2px",
                  backgroundColor: "var(--v17-primary, #2B4C3F)",
                }} />
              )}
            </div>
          );

          if (isCart) {
            return (
              <button key={item.key} onClick={openCart} className="flex-1 flex items-center justify-center h-full">
                {content}
              </button>
            );
          }

          return (
            <Link key={item.key} to={getTo(item.path)} className="flex-1 flex items-center justify-center h-full">
              {content}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
