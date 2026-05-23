import { Link } from "react-router-dom";
import { ShoppingCart, Heart, User } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { useStorefrontAuth } from "@/contexts/StorefrontAuthContext";
import { storefrontPath } from "@/lib/subdomain";

export function CartBadge() {
  const { cartCount, openCart } = useCart();
  const hasItems = cartCount > 0;
  return (
    <button onClick={openCart} className="relative" aria-label={`Shopping cart${hasItems ? `, ${cartCount} items` : ''}`}>
      <div className={`flex h-9 w-9 items-center justify-center rounded-md transition-colors ${hasItems ? 'cart-breathe' : ''}`} style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>
        <ShoppingCart className="h-5 w-5" aria-hidden="true" />
      </div>
      {hasItems && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold" style={{ backgroundColor: "var(--storefront-primary, hsl(var(--foreground)))", color: "var(--storefront-btn-text, hsl(var(--background)))" }} aria-hidden="true">
          {cartCount > 99 ? "99+" : cartCount}
        </span>
      )}
    </button>
  );
}

export function WishlistBadge({ slug }: { slug: string }) {
  const { wishlistCount } = useWishlist();
  return (
    <Link to={storefrontPath(slug, "wishlist")} className="relative" aria-label={`Wishlist${wishlistCount > 0 ? `, ${wishlistCount} items` : ''}`}>
      <div className="flex h-9 w-9 items-center justify-center rounded-md transition-colors" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>
        <Heart className="h-5 w-5" aria-hidden="true" />
      </div>
      {wishlistCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold" style={{ backgroundColor: "var(--storefront-primary, hsl(var(--foreground)))", color: "var(--storefront-btn-text, hsl(var(--background)))" }} aria-hidden="true">{wishlistCount > 99 ? "99+" : wishlistCount}</span>
      )}
    </Link>
  );
}

export function AccountBadge({ slug }: { slug: string }) {
  const { user, loading } = useStorefrontAuth();
  if (loading) return null;
  return (
    <Link to={storefrontPath(slug, user ? "account" : "login")} aria-label={user ? "My account" : "Login"}>
      <div className="flex h-9 w-9 items-center justify-center rounded-md transition-colors" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>
        <User className="h-5 w-5" aria-hidden="true" />
      </div>
    </Link>
  );
}
