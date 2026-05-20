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
 * @deprecated Use compressAndUploadExternalImages for CSV bulk uploads.
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

/**
 * Download external images, compress to 800w WebP, upload to Cloudflare R2
 * via the standard uploadOptimizedImage pipeline, and update the product's
 * image_url. Fire-and-forget — does not block the UI.
 */
export function compressAndUploadExternalImages(
  products: Array<{ id: string; image_url: string | null }>,
  storeId: string,
): void {
  const external = products.filter((p) => isExternalImageUrl(p.image_url));
  if (external.length === 0) return;

  console.info(
    `[compress-upload] Processing ${external.length} external images → R2 WebP`,
  );

  (async () => {
    const { uploadOptimizedImage, generateUploadPath } = await import(
      "@/lib/uploadOptimizedImage"
    );
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || "anon";

    for (let i = 0; i < external.length; i++) {
      const p = external[i];
      try {
        // 1. Fetch external image into a File object
        const res = await fetch(p.image_url!);
        if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
        const blob = await res.blob();
        const ext = (blob.type.split("/")[1] || "jpg").split("+")[0];
        const file = new File([blob], `${p.id}.${ext}`, { type: blob.type });

        // 2. Run through standard pipeline (compresses to 800w WebP + uploads to R2)
        const basePath = generateUploadPath(userId, storeId);
        const result = await uploadOptimizedImage(file, "product-images", basePath);

        // 3. Update product image_url in DB
        const { error: updateError } = await supabase
          .from("products")
          .update({ image_url: result.mainUrl })
          .eq("id", p.id);

        if (updateError) {
          console.warn(`[compress-upload] DB update failed for ${p.id}:`, updateError);
        } else {
          console.info(`[compress-upload] ✓ ${p.id}: → ${result.mainUrl}`);
        }
      } catch (err) {
        console.warn(`[compress-upload] Failed for ${p.id}:`, err);
      }

      // 500ms delay between each to avoid hammering the edge function
      if (i < external.length - 1) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    console.info(`[compress-upload] Done processing ${external.length} images`);
  })();
}
