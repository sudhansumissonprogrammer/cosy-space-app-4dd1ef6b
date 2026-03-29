import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Search, User, Heart, ShoppingCart, ChevronDown } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { useStorefrontAuth } from "@/contexts/StorefrontAuthContext";
import { storefrontPath } from "@/lib/subdomain";
import type { StoreData } from "@/layouts/StorefrontLayout";

interface DesktopNavBarProps {
  store: StoreData;
  onSearchOpen?: () => void;
  /** Additional class for the outer nav */
  className?: string;
  /** Inline style for the outer nav */
  style?: React.CSSProperties;
}

/**
 * Desktop-only navigation bar matching the reference design:
 * Left: Home | All Products | Catalog ▾ | Contact | About Us | Custom Pages
 * Center: Logo (absolutely centered)
 * Right: Search | Account | Wishlist | Cart
 *
 * Hidden on mobile (< md). Each theme still renders its own mobile header.
 */
export default function DesktopNavBar({ store, onSearchOpen, className = "", style }: DesktopNavBarProps) {
  const queryClient = useQueryClient();
  const categories = queryClient.getQueryData<any[]>(["storefront-categories", store.id]) ?? [];
  const customPages = queryClient.getQueryData<any[]>(["storefront-custom-pages", store.id]) ?? [];
  const { cartCount, openCart } = useCart();
  const { wishlistCount } = useWishlist();
  const { user, loading: authLoading } = useStorefrontAuth();
  const [catalogOpen, setCatalogOpen] = useState(false);
  const catalogTimer = useRef<ReturnType<typeof setTimeout>>();

  const linkClass =
    "text-[13px] font-medium tracking-wide uppercase transition-opacity hover:opacity-70";

  const handleCatalogEnter = () => {
    clearTimeout(catalogTimer.current);
    setCatalogOpen(true);
  };
  const handleCatalogLeave = () => {
    catalogTimer.current = setTimeout(() => setCatalogOpen(false), 200);
  };

  return (
    <nav
      className={`hidden md:block relative z-30 ${className}`}
      style={{
        backgroundColor: "var(--storefront-bg, hsl(var(--background)))",
        color: "var(--storefront-text, hsl(var(--foreground)))",
        borderBottom: "1px solid var(--storefront-text, hsl(var(--foreground)))12",
        ...style,
      }}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center px-6 relative">
        {/* ---- Left: Navigation Links ---- */}
        <div className="flex items-center gap-6">
          <Link to={storefrontPath(store.slug)} className={linkClass}>
            Home
          </Link>
          <Link to={storefrontPath(store.slug, "shop")} className={linkClass}>
            All Products
          </Link>

          {/* Catalog dropdown — only when categories exist */}
          {categories.length > 0 && (
            <div
              className="relative"
              onMouseEnter={handleCatalogEnter}
              onMouseLeave={handleCatalogLeave}
            >
              <button className={`${linkClass} flex items-center gap-1`}>
                Catalog
                <ChevronDown
                  className="h-3.5 w-3.5 transition-transform"
                  style={{ transform: catalogOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                />
              </button>
              {catalogOpen && (
                <div
                  className="absolute left-0 top-full mt-1 min-w-[180px] rounded-lg border py-1.5 shadow-lg"
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

          <Link to={storefrontPath(store.slug, "contact")} className={linkClass}>
            Contact
          </Link>
          <Link to={storefrontPath(store.slug, "about")} className={linkClass}>
            About Us
          </Link>
          {customPages.map((cp: any) => (
            <Link
              key={cp.id}
              to={storefrontPath(store.slug, `page/${cp.slug}`)}
              className={linkClass}
            >
              {cp.title}
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
                className="h-10 w-auto max-w-[160px] object-contain"
                loading="eager"
                decoding="sync"
              />
            ) : (
              <span
                className="text-xl font-bold tracking-tight whitespace-nowrap"
                style={{ fontFamily: "var(--storefront-heading-font, inherit)" }}
              >
                {store.name}
              </span>
            )}
          </Link>
        </div>

        {/* ---- Right: Action Icons ---- */}
        <div className="ml-auto flex items-center gap-1">
          {/* Search */}
          {onSearchOpen && (
            <button
              onClick={onSearchOpen}
              className="flex h-9 w-9 items-center justify-center rounded-md transition-opacity hover:opacity-70"
              aria-label="Search products"
            >
              <Search className="h-5 w-5" />
            </button>
          )}

          {/* Account */}
          {!authLoading && (
            <Link
              to={storefrontPath(store.slug, user ? "account" : "login")}
              className="flex h-9 w-9 items-center justify-center rounded-md transition-opacity hover:opacity-70"
              aria-label={user ? "My account" : "Login"}
            >
              <User className="h-5 w-5" />
            </Link>
          )}

          {/* Wishlist */}
          <Link
            to={storefrontPath(store.slug, "wishlist")}
            className="relative flex h-9 w-9 items-center justify-center rounded-md transition-opacity hover:opacity-70"
            aria-label={`Wishlist${wishlistCount > 0 ? `, ${wishlistCount} items` : ""}`}
          >
            <Heart className="h-5 w-5" />
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
            className="relative flex h-9 w-9 items-center justify-center rounded-md transition-opacity hover:opacity-70"
            aria-label={`Shopping cart${cartCount > 0 ? `, ${cartCount} items` : ""}`}
          >
            <ShoppingCart className="h-5 w-5" />
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
  );
}
