/**
 * Central image processing utility for ALL uploads.
 * - Validates file size (rejects raw files > 5MB)
 * - Resizes to max 1200px (maintains aspect ratio)
 * - Converts to WebP (falls back to JPEG)
 * - Targets under 100KB output
 * - Logs final file size & type to console
 */

const MAX_RAW_SIZE = 5 * 1024 * 1024; // 5MB — reject before processing
const MAX_OUTPUT_KB = 100; // target output size
const MAX_DIMENSION = 1200;

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

/**
 * Main image processing function. Call this for EVERY upload.
 * Returns a WebP file under 100KB (or best-effort JPEG fallback).
 * Throws if the raw file exceeds 5MB.
 */
export async function processImage(
  file: File,
  maxDimension = MAX_DIMENSION,
  quality = 0.8
): Promise<CompressionResult> {
  const originalSize = file.size;

  // Hard reject oversized raw files
  if (file.size > MAX_RAW_SIZE) {
    throw new Error(`Image too large (${formatSize(file.size)}). Maximum allowed is 5MB.`);
  }

  // Skip if already small WebP under target
  if (file.size <= MAX_OUTPUT_KB * 1024 && file.type === "image/webp") {
    console.log(`[ImageProcess] Skipped (already ${formatSize(file.size)} WebP)`);
    return { file, originalSize, compressedSize: file.size, skipped: true };
  }

  return new Promise((resolve, reject) => {
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
          reject(new Error("Could not create canvas context for image compression"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        const tryFormat = (format: string, q: number): Promise<Blob | null> =>
          new Promise((res) => {
            canvas.toBlob((blob) => res(blob), format, q);
          });

        (async () => {
          // Try WebP first
          let blob = await tryFormat("image/webp", quality);
          let ext = "webp";
          let mimeType = "image/webp";

          // Fallback to JPEG if WebP not supported
          if (!blob || blob.size === 0) {
            blob = await tryFormat("image/jpeg", quality);
            ext = "jpg";
            mimeType = "image/jpeg";
          }

          if (!blob) {
            reject(new Error("Image compression failed — browser could not encode image"));
            return;
          }

          // Iteratively reduce quality to hit target
          let currentQuality = quality - 0.05;
          while (blob.size > MAX_OUTPUT_KB * 1024 && currentQuality > 0.15) {
            const nextBlob = await tryFormat(mimeType, currentQuality);
            if (!nextBlob || nextBlob.size === 0) break;
            blob = nextBlob;
            currentQuality -= 0.05;
          }

          // If still over target with current format, try reducing dimensions
          if (blob.size > MAX_OUTPUT_KB * 1024 && (width > 800 || height > 800)) {
            const scale = 0.7;
            canvas.width = Math.round(width * scale);
            canvas.height = Math.round(height * scale);
            const ctx2 = canvas.getContext("2d");
            if (ctx2) {
              ctx2.drawImage(img, 0, 0, canvas.width, canvas.height);
              let retryQ = 0.6;
              while (retryQ >= 0.2) {
                const smallBlob = await tryFormat(mimeType, retryQ);
                if (smallBlob && smallBlob.size > 0 && smallBlob.size < blob.size) {
                  blob = smallBlob;
                }
                if (blob.size <= MAX_OUTPUT_KB * 1024) break;
                retryQ -= 0.1;
              }
            }
          }

          const baseName = file.name.replace(/\.[^/.]+$/, "");
          const compressedFile = new File([blob], `${baseName}.${ext}`, {
            type: mimeType,
          });

          console.log(
            `[ImageProcess] ✅ ${formatSize(originalSize)} → ${formatSize(blob.size)} | Type: ${mimeType} | Dims: ${canvas.width}x${canvas.height}`
          );

          resolve({
            file: compressedFile,
            originalSize,
            compressedSize: blob.size,
            skipped: false,
          });
        })();
      } catch (err) {
        reject(new Error(`Image compression error: ${err}`));
      }
    };

    img.onerror = () => reject(new Error("Failed to load image for compression"));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * @deprecated Use processImage() instead. Kept for backward compatibility.
 */
export const compressImage = processImage;
