/**
 * Shared hook for product card add-to-cart and wishlist actions.
 * Eliminates duplicate handler code across 6+ product card components.
 */
import { useState } from "react";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { toast } from "sonner";

interface Product {
  id: string;
  name: string;
  price: number;
  sale_price?: number | null;
  image_url?: string | null;
  slug?: string | null;
}

export function useProductCardActions(product: Product) {
  const { addToCart, items, updateQuantity } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const [heartBursting, setHeartBursting] = useState(false);

  const wishlisted = isWishlisted(product.id);
  const cartItem = items.find((i) => i.productId === product.id && !i.variantId);
  const cartQty = cartItem?.quantity || 0;

  const effectivePrice = product.sale_price && product.sale_price < product.price
    ? Number(product.sale_price)
    : Number(product.price);

  const handleAddToCart = (e: React.MouseEvent, onVariantRequired?: () => void) => {
    e.preventDefault();
    e.stopPropagation();
    if (onVariantRequired) {
      onVariantRequired();
      return;
    }
    addToCart({
      productId: product.id,
      name: product.name,
      price: effectivePrice,
      image: product.image_url || undefined,
      quantity: 1,
    });
    // Side cart opens automatically — no toast needed
  };

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const wasWishlisted = wishlisted;
    toggleWishlist({
      productId: product.id,
      name: product.name,
      price: Number(product.price),
      salePrice: product.sale_price ? Number(product.sale_price) : undefined,
      image: product.image_url || undefined,
      slug: product.slug || product.id,
    });
    // Only burst on add (not remove)
    if (!wasWishlisted) {
      setHeartBursting(true);
      window.setTimeout(() => setHeartBursting(false), 650);
    }
    toast.success(wasWishlisted ? "Removed from wishlist" : "Added to wishlist");
  };

  return {
    wishlisted,
    cartQty,
    effectivePrice,
    handleAddToCart,
    handleToggleWishlist,
    heartBursting,
    updateQuantity,
  };
}
