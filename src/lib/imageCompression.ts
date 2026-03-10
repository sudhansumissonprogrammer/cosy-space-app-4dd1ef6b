/**
 * Compresses an image file using the browser Canvas API.
 * - Resizes to max 1200px (maintains aspect ratio)
 * - Converts to WebP (falls back to JPEG)
 * - Targets 100-200KB output
 */
export async function compressImage(
  file: File,
  maxDimension = 1200,
  quality = 0.8
): Promise<File> {
  // Skip if already small enough (under 200KB)
  if (file.size <= 200 * 1024) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        let { width, height } = img;

        // Scale down if exceeds max dimension
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height / width) * maxDimension);
            width = maxDimension;
          } else {
            width = Math.round((width / height) * maxDimension);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(file); // fallback to original
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Try WebP first, fall back to JPEG
        const tryFormat = (format: string, q: number): Promise<Blob | null> =>
          new Promise((res) => {
            canvas.toBlob(
              (blob) => res(blob),
              format,
              q
            );
          });

        (async () => {
          let blob = await tryFormat("image/webp", quality);
          let ext = "webp";

          // If WebP not supported or blob is null, fall back to JPEG
          if (!blob || blob.size === 0) {
            blob = await tryFormat("image/jpeg", quality);
            ext = "jpg";
          }

          if (!blob) {
            resolve(file);
            return;
          }

          // If still too large (>300KB), reduce quality iteratively
          let currentQuality = quality - 0.1;
          while (blob.size > 300 * 1024 && currentQuality > 0.3) {
            blob = await tryFormat(`image/${ext === "webp" ? "webp" : "jpeg"}`, currentQuality);
            if (!blob) break;
            currentQuality -= 0.1;
          }

          if (!blob) {
            resolve(file);
            return;
          }

          const baseName = file.name.replace(/\.[^/.]+$/, "");
          const compressedFile = new File([blob], `${baseName}.${ext}`, {
            type: `image/${ext === "webp" ? "webp" : "jpeg"}`,
          });

          resolve(compressedFile);
        })();
      } catch {
        resolve(file); // fallback to original on any error
      }
    };

    img.onerror = () => resolve(file); // fallback to original
    img.src = URL.createObjectURL(file);
  });
}
