/**
 * Central image processing utility for ALL uploads.
 * - Validates file size (rejects raw files > 6MB)
 * - Skips compression for images already under 80KB
 * - Resizes to max dimension (maintains aspect ratio)
 * - Converts to WebP (falls back to JPEG)
 * - Targets 80–120KB output with a strict iteration loop:
 *     1. Walk quality from 0.90 → 0.72 in 0.03 steps
 *     2. If still over target, progressively shrink dimensions
 *        (1200 → 1000 → 900 → 800) re-running the quality walk
 *     3. Always returns the smallest acceptable result
 */

const MAX_RAW_SIZE = 6 * 1024 * 1024; // 6MB — reject before processing
const SKIP_THRESHOLD_KB = 80; // Skip compression if already under 80KB (in target band)
const HEAVY_THRESHOLD_KB = 300; // Anything over this needs aggressive treatment
const MAX_OUTPUT_KB = 120; // Hard upper bound for the 80–120KB target band
const DEFAULT_MAX_DIMENSION = 1200; // Sharpness ceiling for retina screens
const DOWNSCALE_STEPS = [1200, 1000, 900, 800] as const; // Progressive fallbacks
const DEFAULT_START_QUALITY = 0.9; // Starting quality — high but not max
const HEAVY_START_QUALITY = 0.86; // Slightly lower start for big photos
const MIN_QUALITY = 0.78; // Floor — below this WebP starts looking soft
const QUALITY_STEP = 0.03; // Finer steps → more chances to land in band

/** @deprecated Multi-size variants removed — single 800w upload only */
export const IMAGE_VARIANT_WIDTHS = [800] as const;
export type VariantWidth = (typeof IMAGE_VARIANT_WIDTHS)[number];

export interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  skipped: boolean;
}

export interface MultiSizeResult {
  /** The main (largest / 800px) variant */
  main: CompressionResult;
  /** Map of width → compressed file */
  variants: Map<VariantWidth, File>;
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

/** Load an image element from a File */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image for compression"));
    img.src = URL.createObjectURL(file);
  });
}

/** Render image to canvas at target dimensions */
function renderToCanvas(
  img: HTMLImageElement,
  targetWidth: number,
  targetHeight: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create canvas context");
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
  return canvas;
}

/** Encode a canvas to a Blob in the requested format/quality */
function encodeCanvas(
  canvas: HTMLCanvasElement,
  format: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((res) => canvas.toBlob((blob) => res(blob), format, quality));
}

/**
 * Walk quality from `startQuality` down to `MIN_QUALITY` (in QUALITY_STEP
 * decrements) and return the first encoding that lands at or below `targetKB`.
 * If nothing fits, returns the smallest blob produced.
 */
async function walkQuality(
  canvas: HTMLCanvasElement,
  startQuality: number,
  targetKB: number,
): Promise<{ blob: Blob; ext: string; mimeType: string; quality: number }> {
  // Try WebP first; fall back to JPEG if the browser refuses WebP
  let mimeType = "image/webp";
  let ext = "webp";
  let blob = await encodeCanvas(canvas, mimeType, startQuality);
  if (!blob || blob.size === 0) {
    mimeType = "image/jpeg";
    ext = "jpg";
    blob = await encodeCanvas(canvas, mimeType, startQuality);
  }
  if (!blob) throw new Error("Browser could not encode image");

  let bestBlob = blob;
  let bestQuality = startQuality;
  if (blob.size <= targetKB * 1024) {
    return { blob, ext, mimeType, quality: startQuality };
  }

  // Iterate downward — keep the smallest blob seen along the way
  for (
    let q = startQuality - QUALITY_STEP;
    q >= MIN_QUALITY - 1e-6;
    q -= QUALITY_STEP
  ) {
    const next = await encodeCanvas(canvas, mimeType, Math.max(q, MIN_QUALITY));
    if (!next || next.size === 0) continue;
    if (next.size < bestBlob.size) {
      bestBlob = next;
      bestQuality = q;
    }
    if (next.size <= targetKB * 1024) {
      return { blob: next, ext, mimeType, quality: q };
    }
  }

  return { blob: bestBlob, ext, mimeType, quality: bestQuality };
}

/** Calculate scaled dimensions maintaining aspect ratio */
function scaleDimensions(
  origW: number,
  origH: number,
  maxDim: number,
): { width: number; height: number } {
  let width = origW;
  let height = origH;
  if (width > maxDim || height > maxDim) {
    if (width > height) {
      height = Math.round((height / width) * maxDim);
      width = maxDim;
    } else {
      width = Math.round((width / height) * maxDim);
      height = maxDim;
    }
  }
  return { width, height };
}

/**
 * Process a single image to a given max dimension.
 * Returns a WebP file in the 80–120KB target band whenever possible.
 *
 * Strategy:
 *   1. Skip entirely if already ≤ 80KB
 *   2. Walk quality at the requested dimension
 *   3. If still over 120KB, progressively shrink dimensions
 *      (1200 → 1000 → 900 → 800) and walk quality again
 *   4. Return the smallest result produced
 *
 * Throws if the raw file exceeds 6MB.
 */
export async function processImage(
  file: File,
  maxDimension = DEFAULT_MAX_DIMENSION,
  quality?: number,
): Promise<CompressionResult> {
  const originalSize = file.size;

  if (file.size > MAX_RAW_SIZE) {
    throw new Error(`Image too large (${formatSize(file.size)}). Maximum allowed is 6MB.`);
  }

  // Already in target band — preserve original quality
  if (file.size <= SKIP_THRESHOLD_KB * 1024) {
    return { file, originalSize, compressedSize: file.size, skipped: true };
  }

  const isHeavy = file.size > HEAVY_THRESHOLD_KB * 1024;
  const startQuality = quality ?? (isHeavy ? HEAVY_START_QUALITY : DEFAULT_START_QUALITY);

  const img = await loadImage(file);

  // Try the requested dimension first, then fall back to smaller dimensions
  // until we land in the 80–120KB band. Track the best result across attempts.
  const dimensionsToTry: number[] = DOWNSCALE_STEPS.filter((d) => d <= maxDimension);
  if (dimensionsToTry.length === 0) dimensionsToTry.push(maxDimension);

  let bestResult: { blob: Blob; ext: string; mimeType: string } | null = null;

  for (const dim of dimensionsToTry) {
    const { width, height } = scaleDimensions(img.width, img.height, dim);
    const canvas = renderToCanvas(img, width, height);
    const result = await walkQuality(canvas, startQuality, MAX_OUTPUT_KB);

    if (!bestResult || result.blob.size < bestResult.blob.size) {
      bestResult = { blob: result.blob, ext: result.ext, mimeType: result.mimeType };
    }
    // Landed in band — done
    if (result.blob.size <= MAX_OUTPUT_KB * 1024) break;
  }

  URL.revokeObjectURL(img.src);

  if (!bestResult) throw new Error("Image compression failed");

  const baseName = file.name.replace(/\.[^/.]+$/, "");
  const compressedFile = new File(
    [bestResult.blob],
    `${baseName}.${bestResult.ext}`,
    { type: bestResult.mimeType },
  );

  return {
    file: compressedFile,
    originalSize,
    compressedSize: bestResult.blob.size,
    skipped: false,
  };
}

/**
 * Process a single 800w optimized image for upload.
 * Previously generated multiple variants — now produces a single 800w WebP.
 * Supabase render API handles responsive resizing on-the-fly.
 */
export async function processImageMultiSize(
  file: File,
  quality?: number,
): Promise<MultiSizeResult> {
  // Use 1200px max — keeps images sharp on retina/zoom while staying ~100KB
  const main = await processImage(file, DEFAULT_MAX_DIMENSION, quality);
  const variants = new Map<VariantWidth, File>();
  variants.set(800, main.file);
  return { main, variants };
}

/**
 * @deprecated Use processImage() instead. Kept for backward compatibility.
 */
export const compressImage = processImage;

/**
 * Fetch an image from a URL and compress it to ~50% of original file size.
 * Used for CSV bulk-upload flow — lighter compression than manual uploads.
 * Quality range: 0.92 → 0.80 (never degrades visually).
 * Max dimension: 1200px (same as manual uploads).
 */
export async function processImageFromUrl(
  url: string,
  targetReductionPercent = 50,
): Promise<CompressionResult> {
  // Fetch image as blob
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
  const blob = await response.blob();
  const originalSize = blob.size;

  // Determine file name from URL
  const urlPath = new URL(url).pathname;
  const baseName = urlPath.split("/").pop()?.replace(/\.[^/.]+$/, "") || "image";
  const ext = urlPath.split(".").pop()?.toLowerCase() || "jpg";
  const mimeType = blob.type || (ext === "png" ? "image/png" : "image/jpeg");

  const file = new File([blob], `${baseName}.${ext}`, { type: mimeType });

  // Skip if already very small (under 50KB)
  if (originalSize <= 50 * 1024) {
    return { file, originalSize, compressedSize: originalSize, skipped: true };
  }

  const targetBytes = originalSize * (1 - targetReductionPercent / 100);

  const img = await loadImage(file);
  const { width, height } = scaleDimensions(img.width, img.height, DEFAULT_MAX_DIMENSION);
  const canvas = renderToCanvas(img, width, height);
  URL.revokeObjectURL(img.src);

  // Start at high quality, iterate down to hit ~50% reduction
  const BULK_START_QUALITY = 0.92;
  const BULK_MIN_QUALITY = 0.80;

  const tryFormat = (format: string, q: number): Promise<Blob | null> =>
    new Promise((res) => canvas.toBlob((b) => res(b), format, q));

  let quality = BULK_START_QUALITY;
  let resultBlob = await tryFormat("image/webp", quality);
  let resultExt = "webp";

  if (!resultBlob || resultBlob.size === 0) {
    resultBlob = await tryFormat("image/jpeg", quality);
    resultExt = "jpg";
  }
  if (!resultBlob) throw new Error("Browser could not encode image");

  // Iterate down quality to reach target size
  const format = resultExt === "webp" ? "image/webp" : "image/jpeg";
  while (resultBlob.size > targetBytes && quality > BULK_MIN_QUALITY) {
    quality -= 0.03;
    const nextBlob = await tryFormat(format, quality);
    if (!nextBlob || nextBlob.size === 0) break;
    resultBlob = nextBlob;
  }

  const compressedFile = new File([resultBlob], `${baseName}.${resultExt}`, { type: resultBlob.type });
  return { file: compressedFile, originalSize, compressedSize: resultBlob.size, skipped: false };
}
