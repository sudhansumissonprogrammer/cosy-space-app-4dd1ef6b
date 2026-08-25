/**
 * Shared equality check for leaf product-card components.
 *
 * Grids re-render whenever cart / wishlist / theme context ticks. The card
 * props themselves almost never change, so this comparator lets React skip the
 * whole subtree (image, title fit, badges) for untouched cards.
 */
export function productCardPropsEqual(prev: any, next: any) {
  return (
    prev.product?.id === next.product?.id &&
    prev.product?.price === next.product?.price &&
    prev.product?.sale_price === next.product?.sale_price &&
    prev.product?.name === next.product?.name &&
    prev.product?.stock_quantity === next.product?.stock_quantity &&
    prev.product?.image_url === next.product?.image_url &&
    prev.product?.images === next.product?.images &&
    prev.slug === next.slug &&
    prev.store?.id === next.store?.id &&
    prev.store?.theme === next.store?.theme &&
    prev.store?.currency === next.store?.currency &&
    prev.priority === next.priority &&
    prev.onVariantRequired === next.onVariantRequired
  );
}
