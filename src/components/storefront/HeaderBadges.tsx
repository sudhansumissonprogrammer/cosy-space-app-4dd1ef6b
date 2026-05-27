import { Link } from "react-router-dom";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { useStorefrontAuth } from "@/contexts/StorefrontAuthContext";
import { storefrontPath } from "@/lib/subdomain";
import { useNavIcons } from "@/hooks/useNavIcons";

export function CartBadge({ storeId }: { storeId?: string } = {}) {
  const { cartCount, openCart } = useCart();
  const getIcon = useNavIcons(storeId);
  const Icon = storeId ? getIcon("cart") : ShoppingCart;
  const hasItems = cartCount > 0;
  return (
    <button onClick={openCart} className="relative" aria-label={`Shopping cart${hasItems ? `, ${cartCount} items` : ''}`}>
      <div className={`flex h-9 w-9 items-center justify-center rounded-md transition-colors ${hasItems ? 'cart-breathe' : ''}`} style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      {hasItems && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold" style={{ backgroundColor: "var(--storefront-primary, hsl(var(--foreground)))", color: "var(--storefront-btn-text, hsl(var(--background)))" }} aria-hidden="true">
          {cartCount > 99 ? "99+" : cartCount}
        </span>
      )}
    </button>
  );
}

export function WishlistBadge({ slug, storeId }: { slug: string; storeId?: string }) {
  const { wishlistCount } = useWishlist();
  const getIcon = useNavIcons(storeId);
  const Icon = getIcon("wishlist");
  return (
    <Link to={storefrontPath(slug, "wishlist")} className="relative" aria-label={`Wishlist${wishlistCount > 0 ? `, ${wishlistCount} items` : ''}`}>
      <div className="flex h-9 w-9 items-center justify-center rounded-md transition-colors" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      {wishlistCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold" style={{ backgroundColor: "var(--storefront-primary, hsl(var(--foreground)))", color: "var(--storefront-btn-text, hsl(var(--background)))" }} aria-hidden="true">{wishlistCount > 99 ? "99+" : wishlistCount}</span>
      )}
    </Link>
  );
}

export function AccountBadge({ slug, storeId }: { slug: string; storeId?: string }) {
  const { user, loading } = useStorefrontAuth();
  const getIcon = useNavIcons(storeId);
  const Icon = getIcon("account");
  if (loading) return null;
  return (
    <Link to={storefrontPath(slug, user ? "account" : "login")} aria-label={user ? "My account" : "Login"}>
      <div className="flex h-9 w-9 items-center justify-center rounded-md transition-colors" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
    </Link>
  );
}
