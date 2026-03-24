/**
 * Check if an image URL is external (not hosted on our storage).
 */
export function isExternalImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
  // Skip our own storage URLs
  if (url.includes(supabaseUrl)) return false;
  if (url.includes("supabase.co/storage")) return false;
  // Must be a valid http URL
  return url.startsWith("http://") || url.startsWith("https://");
}

/**
 * Trigger background copy of an external image to our storage.
 * Fire-and-forget — does not block the UI.
 */
export function copyExternalImageInBackground(
  url: string,
  storeId: string,
  productId: string
): void {
  if (!isExternalImageUrl(url)) return;

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  if (!projectId) return;

  // Fire-and-forget — uses merged image-ops function
  fetch(`https://${projectId}.supabase.co/functions/v1/image-ops?action=copy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, store_id: storeId, product_id: productId }),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data?.success && !data?.skipped) {
        console.info("[copy-external-image] Copied to:", data.new_url);
      } else if (!data?.success) {
        console.warn("[copy-external-image] Failed:", data?.error);
      }
    })
    .catch((err) => {
      console.warn("[copy-external-image] Error:", err);
    });
}

/**
 * Process multiple products' external images in background.
 * Used after bulk import.
 */
export function copyExternalImagesForProducts(
  products: Array<{ id: string; image_url: string | null }>,
  storeId: string
): void {
  const external = products.filter((p) => isExternalImageUrl(p.image_url));
  if (external.length === 0) return;

  console.info(`[copy-external-image] Queuing ${external.length} external images for background copy`);

  // Stagger requests to avoid overwhelming the edge function
  external.forEach((p, i) => {
    setTimeout(() => {
      copyExternalImageInBackground(p.image_url!, storeId, p.id);
    }, i * 500); // 500ms between each
  });
}
