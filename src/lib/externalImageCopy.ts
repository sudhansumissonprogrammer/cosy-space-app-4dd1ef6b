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
 * Download external images, compress to ~50% of original size (client-side),
 * upload to product-images bucket, and update the product's image_url.
 * Fire-and-forget — does not block the UI.
 */
export function compressAndUploadExternalImages(
  products: Array<{ id: string; image_url: string | null }>,
  storeId: string
): void {
  const external = products.filter((p) => isExternalImageUrl(p.image_url));
  if (external.length === 0) return;

  console.info(`[compress-upload] Processing ${external.length} external images with 50% compression`);

  // Process sequentially with delays
  (async () => {
    const { processImageFromUrl } = await import("@/lib/imageCompression");
    const { supabase } = await import("@/integrations/supabase/client");

    for (let i = 0; i < external.length; i++) {
      const p = external[i];
      try {
        // 1. Fetch + compress to 50% of original
        const result = await processImageFromUrl(p.image_url!, 50);

        // 2. Upload to storage
        const filePath = `${storeId}/${p.id}-${Date.now()}.${result.file.name.split(".").pop()}`;
        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(filePath, result.file, {
            contentType: result.file.type,
            upsert: true,
          });

        if (uploadError) {
          console.warn(`[compress-upload] Upload failed for ${p.id}:`, uploadError);
          continue;
        }

        // 3. Get public URL
        const { data: urlData } = supabase.storage
          .from("product-images")
          .getPublicUrl(filePath);

        const newUrl = urlData.publicUrl;

        // 4. Update product image_url in DB
        const { error: updateError } = await supabase
          .from("products")
          .update({ image_url: newUrl })
          .eq("id", p.id);

        if (updateError) {
          console.warn(`[compress-upload] DB update failed for ${p.id}:`, updateError);
        } else {
          const reduction = result.skipped
            ? "skipped (small)"
            : `${Math.round((1 - result.compressedSize / result.originalSize) * 100)}% smaller`;
          console.info(`[compress-upload] ✓ ${p.id}: ${reduction}`);
        }
      } catch (err) {
        console.warn(`[compress-upload] Failed for ${p.id}:`, err);
      }

      // 500ms delay between each
      if (i < external.length - 1) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    console.info(`[compress-upload] Done processing ${external.length} images`);
  })();
}
