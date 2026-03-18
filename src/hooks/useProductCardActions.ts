/**
 * Shared hook for product card add-to-cart and wishlist actions.
 * Eliminates duplicate handler code across 6+ product card components.
 */
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

  const wishlisted = isWishlisted(product.id);
  const cartItem = items.find((i) => i.productId === product.id && !i.variantId);
  const cartQty = cartItem?.quantity || 0;

  const effectivePrice = product.sale_price && product.sale_price < product.price
    ? Number(product.sale_price)
    : Number(product.price);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart({
      productId: product.id,
      name: product.name,
      price: effectivePrice,
      image: product.image_url || undefined,
      quantity: 1,
    });
    toast.success(`${product.name} added to cart`);
  };

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist({
      productId: product.id,
      name: product.name,
      price: Number(product.price),
      salePrice: product.sale_price ? Number(product.sale_price) : undefined,
      image: product.image_url || undefined,
      slug: product.slug || product.id,
    });
    toast.success(wishlisted ? "Removed from wishlist" : "Added to wishlist");
  };

  return {
    wishlisted,
    cartQty,
    effectivePrice,
    handleAddToCart,
    handleToggleWishlist,
    updateQuantity,
  };
}
