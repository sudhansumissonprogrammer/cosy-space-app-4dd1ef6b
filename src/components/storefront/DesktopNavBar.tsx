import { useState, useRef, lazy, Suspense } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useNavIcons } from "@/hooks/useNavIcons";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { useStorefrontAuth } from "@/contexts/StorefrontAuthContext";
import { storefrontPath } from "@/lib/subdomain";
import type { StoreData } from "@/layouts/StorefrontLayout";
import StoreTextLogo from "@/components/storefront/StoreTextLogo";
import { useSmartHeader } from "@/hooks/useSmartHeader";

const LazySearchOverlay = lazy(() => import("@/components/storefront/StorefrontSearchOverlay"));

interface DesktopNavBarProps {
  store: StoreData;
  onSearchOpen?: () => void;
  /** Additional class for the outer nav */
  className?: string;
  /** Inline style for the outer nav */
  style?: React.CSSProperties;
}

/**
 * Desktop-only navigation bar:
 * Left: Home | All Products | Catalog ▾ | Contact | About Us | Custom Pages
 * Center: Logo (absolutely centered)
 * Right: Search | Account | Wishlist | Cart
 *
 * Includes its own search overlay so all themes get search on desktop automatically.
 * Hidden on mobile (< md).
 */
export default function DesktopNavBar({ store, onSearchOpen, className = "", style }: DesktopNavBarProps) {
  const queryClient = useQueryClient();
  const categories = queryClient.getQueryData<any[]>(["storefront-categories", store.id]) ?? [];
  const customPages = queryClient.getQueryData<any[]>(["storefront-custom-pages", store.id]) ?? [];
  const products = queryClient.getQueryData<any[]>(["storefront-products", store.id]);
  const { cartCount, openCart, cartBounce } = useCart();
  const { wishlistCount } = useWishlist();
  const { user, loading: authLoading } = useStorefrontAuth();
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const catalogTimer = useRef<ReturnType<typeof setTimeout>>();
  const headerVisible = useSmartHeader();
  const location = useLocation();
  const getIcon = useNavIcons(store.id);
  const SearchIcon = getIcon("search");
  const UserIcon = getIcon("account");
  const HeartIcon = getIcon("wishlist");
  const CartIcon = getIcon("cart");

  const isActive = (path: string) => {
    const resolved = storefrontPath(store.slug, path);
    return location.pathname === resolved || location.pathname === resolved + "/";
  };

  const linkClass = (path: string = "") =>
    `text-[13px] lg:text-sm font-medium tracking-wide uppercase transition-all hover:opacity-70 relative pb-1 ${
      isActive(path) ? "opacity-100" : "opacity-80"
    }`;

  const activeDot = (path: string) =>
    isActive(path) ? (
      <span
        className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full"
        style={{ backgroundColor: "var(--storefront-primary, hsl(var(--primary)))" }}
      />
    ) : null;

  const handleCatalogEnter = () => {
    clearTimeout(catalogTimer.current);
    setCatalogOpen(true);
  };
  const handleCatalogLeave = () => {
    catalogTimer.current = setTimeout(() => setCatalogOpen(false), 200);
  };

  const handleSearchOpen = () => {
    if (onSearchOpen) onSearchOpen();
    setSearchOpen(true);
  };

  return (
    <>
      <nav
        className={`hidden md:block relative z-30 smart-header ${headerVisible ? "" : "smart-header-hidden"} ${className}`}
        style={{
          backgroundColor: "var(--storefront-bg, hsl(var(--background)))",
          color: "var(--storefront-text, hsl(var(--foreground)))",
          borderBottom: "1px solid var(--storefront-text, hsl(var(--foreground)))12",
          ...style,
        }}
      >
        <div className="mx-auto flex h-14 lg:h-16 max-w-7xl items-center px-6 lg:px-8 relative">
          {/* ---- Left: Navigation Links ---- */}
          <div className="flex items-center gap-6 lg:gap-7">
            <Link to={storefrontPath(store.slug)} className={linkClass("")}>
              Home
              {activeDot("")}
            </Link>
            <Link to={storefrontPath(store.slug, "shop")} className={linkClass("shop")}>
              All Products
              {activeDot("shop")}
            </Link>

            {/* Catalog dropdown — only when categories exist */}
            {categories.length > 0 && (
              <div
                className="relative"
                onMouseEnter={handleCatalogEnter}
                onMouseLeave={handleCatalogLeave}
              >
                <button className={`${linkClass("shop")} flex items-center gap-1`}>
                  Catalog
                  <ChevronDown
                    className="h-3.5 w-3.5 transition-transform"
                    style={{ transform: catalogOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                  />
                </button>
                {catalogOpen && (
                   <div
                    className="absolute left-0 top-full mt-1 min-w-[180px] max-h-[70vh] overflow-y-auto rounded-lg border py-1.5 shadow-lg"
                    style={{
                      backgroundColor: "var(--storefront-bg, hsl(var(--background)))",
                      borderColor: "var(--storefront-text, hsl(var(--foreground)))15",
                    }}
                  >
                    {categories.map((cat: any) => (
                      <Link
                        key={cat.id}
                        to={storefrontPath(store.slug, `shop?category=${cat.slug}`)}
                        onClick={() => setCatalogOpen(false)}
                        className="block px-4 py-2 text-[13px] font-medium transition-colors hover:opacity-70"
                        style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}
                      >
                        {cat.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            <Link to={storefrontPath(store.slug, "contact")} className={linkClass("contact")}>
              Contact
              {activeDot("contact")}
            </Link>
            <Link to={storefrontPath(store.slug, "about")} className={linkClass("about")}>
              About Us
              {activeDot("about")}
            </Link>
            {customPages.map((cp: any) => (
              <Link
                key={cp.id}
                to={storefrontPath(store.slug, `page/${cp.slug}`)}
                className={linkClass(`page/${cp.slug}`)}
              >
                {cp.title}
                {activeDot(`page/${cp.slug}`)}
              </Link>
            ))}
          </div>

          {/* ---- Center: Logo ---- */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <Link to={storefrontPath(store.slug)} aria-label={`${store.name} home`}>
              {store.logo_url ? (
                <img
                  src={store.logo_url}
                  alt={store.name}
                  className="h-14 w-auto max-w-[240px] object-contain origin-center"
                  style={{ transform: "scale(2.2)" }}
                  loading="eager"
                  decoding="sync"
                />
              ) : (
                <StoreTextLogo storeName={store.name} size="text-xl" />
              )}
            </Link>
          </div>

          {/* ---- Right: Action Icons ---- */}
          <div className="ml-auto flex items-center gap-1">
            {/* Search */}
            <button
              onClick={handleSearchOpen}
              className="flex h-9 w-9 items-center justify-center rounded-md transition-opacity hover:opacity-70"
              aria-label="Search products"
            >
              <SearchIcon className="h-5 w-5" />
            </button>

            {/* Account */}
            {!authLoading && (
              <Link
                to={storefrontPath(store.slug, user ? "account" : "login")}
                className="flex h-9 w-9 items-center justify-center rounded-md transition-opacity hover:opacity-70"
                aria-label={user ? "My account" : "Login"}
              >
                <UserIcon className="h-5 w-5" />
              </Link>
            )}

            {/* Wishlist */}
            <Link
              to={storefrontPath(store.slug, "wishlist")}
              className="relative flex h-9 w-9 items-center justify-center rounded-md transition-opacity hover:opacity-70"
              aria-label={`Wishlist${wishlistCount > 0 ? `, ${wishlistCount} items` : ""}`}
            >
              <HeartIcon className="h-5 w-5" />
              {wishlistCount > 0 && (
                <span
                  className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold"
                  style={{
                    backgroundColor: "var(--storefront-primary, hsl(var(--foreground)))",
                    color: "var(--storefront-btn-text, hsl(var(--background)))",
                  }}
                >
                  {wishlistCount > 9 ? "9+" : wishlistCount}
                </span>
              )}
            </Link>

            {/* Cart */}
            <button
              onClick={openCart}
              data-cart-target
              className="relative flex h-9 w-9 items-center justify-center rounded-md transition-all hover:opacity-70 active:scale-[0.93]"
              aria-label={`Shopping cart${cartCount > 0 ? `, ${cartCount} items` : ""}`}
            >
              <CartIcon className={`h-5 w-5 ${cartBounce ? "cart-bounce" : ""}`} />
              {cartCount > 0 && (
                <span
                  className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold"
                  style={{
                    backgroundColor: "var(--storefront-primary, hsl(var(--foreground)))",
                    color: "var(--storefront-btn-text, hsl(var(--background)))",
                  }}
                >
                  {cartCount > 9 ? "9+" : cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Search overlay — self-contained so every theme gets it */}
      {searchOpen && (
        <Suspense fallback={null}>
          <LazySearchOverlay
            open={searchOpen}
            onClose={() => setSearchOpen(false)}
            products={products}
            slug={store.slug}
            storeId={store.id}
            initialFiltersOpen={false}
          />
        </Suspense>
      )}
    </>
  );
}
