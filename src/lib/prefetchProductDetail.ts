/**
 * Prefetch the ProductDetail chunk on hover/touch so it's ready
 * by the time the user taps through. Only triggers once.
 */
let loaded = false;

export function prefetchProductDetail() {
  if (loaded) return;
  loaded = true;
  import("@/pages/ProductDetail").catch(() => {
    loaded = false; // retry on next hover if failed
  });
}
