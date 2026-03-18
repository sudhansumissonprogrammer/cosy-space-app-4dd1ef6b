/**
 * Compresses an image file using the browser Canvas API.
 * - Resizes to max 1200px (maintains aspect ratio)
 * - Converts to WebP (falls back to JPEG)
 * - Targets 100-200KB output
 */

export interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  skipped: boolean;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${Math.round(bytes / 1024)}KB`;
}

export function getCompressionMessage(result: CompressionResult): string | null {
  if (result.skipped) return null;
  const reduction = Math.round((1 - result.compressedSize / result.originalSize) * 100);
  return `Image compressed: ${formatSize(result.originalSize)} → ${formatSize(result.compressedSize)} (${reduction}% smaller)`;
}

export async function compressImage(
  file: File,
  maxDimension = 1200,
  quality = 0.8
): Promise<CompressionResult> {
  const originalSize = file.size;

  // Skip if already small enough (under 150KB)
  if (file.size <= 150 * 1024) {
    return { file, originalSize, compressedSize: file.size, skipped: true };
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        let { width, height } = img;

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
          resolve({ file, originalSize, compressedSize: file.size, skipped: true });
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        const tryFormat = (format: string, q: number): Promise<Blob | null> =>
          new Promise((res) => {
            canvas.toBlob((blob) => res(blob), format, q);
          });

        (async () => {
          let blob = await tryFormat("image/webp", quality);
          let ext = "webp";

          if (!blob || blob.size === 0) {
            blob = await tryFormat("image/jpeg", quality);
            ext = "jpg";
          }

          if (!blob) {
            resolve({ file, originalSize, compressedSize: file.size, skipped: true });
            return;
          }

          let currentQuality = quality - 0.1;
          while (blob.size > 300 * 1024 && currentQuality > 0.3) {
            blob = await tryFormat(`image/${ext === "webp" ? "webp" : "jpeg"}`, currentQuality);
            if (!blob) break;
            currentQuality -= 0.1;
          }

          if (!blob) {
            resolve({ file, originalSize, compressedSize: file.size, skipped: true });
            return;
          }

          const baseName = file.name.replace(/\.[^/.]+$/, "");
          const compressedFile = new File([blob], `${baseName}.${ext}`, {
            type: `image/${ext === "webp" ? "webp" : "jpeg"}`,
          });

          resolve({ file: compressedFile, originalSize, compressedSize: blob.size, skipped: false });
        })();
      } catch {
        resolve({ file, originalSize, compressedSize: file.size, skipped: true });
      }
    };

    img.onerror = () => resolve({ file, originalSize, compressedSize: file.size, skipped: true });
    img.src = URL.createObjectURL(file);
  });
}
