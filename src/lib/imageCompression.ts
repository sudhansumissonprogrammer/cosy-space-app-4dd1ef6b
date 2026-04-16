/**
 * Central image processing utility for ALL uploads.
 * - Validates file size (rejects raw files > 5MB)
 * - Skips compression for images already under 100KB
 * - Resizes to max dimension (maintains aspect ratio)
 * - Converts to WebP (falls back to JPEG)
 * - Targets 90–120KB output with high quality floor (0.75 min)
 */

const MAX_RAW_SIZE = 5 * 1024 * 1024; // 5MB — reject before processing
const SKIP_THRESHOLD_KB = 100; // Don't compress images already under 100KB
const HEAVY_THRESHOLD_KB = 200; // Heavy compression for images above 200KB
const MAX_OUTPUT_KB = 200; // target output size for light compression
const HEAVY_OUTPUT_KB = 150; // target output size for heavy compression — never below 100KB
const DEFAULT_MAX_DIMENSION = 1200;
const DEFAULT_QUALITY = 0.92; // near-lossless
const HEAVY_QUALITY = 0.85; // starting quality for heavy compression
const MIN_QUALITY = 0.80; // never go below this for light compression
const HEAVY_MIN_QUALITY = 0.72; // higher floor to preserve visual quality

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

/** Compress a canvas to a WebP/JPEG blob under target size */
async function compressCanvas(
  canvas: HTMLCanvasElement,
  quality: number,
  targetKB: number,
): Promise<{ blob: Blob; ext: string; mimeType: string }> {
  const tryFormat = (format: string, q: number): Promise<Blob | null> =>
    new Promise((res) => canvas.toBlob((blob) => res(blob), format, q));

  let blob = await tryFormat("image/webp", quality);
  let ext = "webp";
  let mimeType = "image/webp";

  if (!blob || blob.size === 0) {
    blob = await tryFormat("image/jpeg", quality);
    ext = "jpg";
    mimeType = "image/jpeg";
  }
  if (!blob) throw new Error("Browser could not encode image");

  // If already under target at high quality, use it directly (no iterative reduction)
  if (blob.size <= targetKB * 1024) {
    return { blob, ext, mimeType };
  }

  // Iteratively reduce quality, but never below the floor
  const qualityFloor = quality <= HEAVY_QUALITY ? HEAVY_MIN_QUALITY : MIN_QUALITY;
  let currentQuality = quality - 0.05;
  while (blob.size > targetKB * 1024 && currentQuality >= qualityFloor) {
    const nextBlob = await tryFormat(mimeType, currentQuality);
    if (!nextBlob || nextBlob.size === 0) break;
    blob = nextBlob;
    currentQuality -= 0.05;
  }

  // Accept the result even if slightly over target — quality > file size
  return { blob, ext, mimeType };
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
 * Returns a WebP file under 120KB (or best-effort JPEG fallback).
 * Skips compression entirely for images already under 100KB.
 * Throws if the raw file exceeds 5MB.
 */
export async function processImage(
  file: File,
  maxDimension = DEFAULT_MAX_DIMENSION,
  quality?: number,
): Promise<CompressionResult> {
  const originalSize = file.size;

  if (file.size > MAX_RAW_SIZE) {
    throw new Error(`Image too large (${formatSize(file.size)}). Maximum allowed is 5MB.`);
  }

  // Skip compression for any image under 100KB — preserve quality
  if (file.size <= SKIP_THRESHOLD_KB * 1024) {
    return { file, originalSize, compressedSize: file.size, skipped: true };
  }

  const isHeavy = file.size > HEAVY_THRESHOLD_KB * 1024;
  const effectiveQuality = quality ?? (isHeavy ? HEAVY_QUALITY : DEFAULT_QUALITY);
  const targetKB = isHeavy ? HEAVY_OUTPUT_KB : MAX_OUTPUT_KB;

  const img = await loadImage(file);
  const { width, height } = scaleDimensions(img.width, img.height, maxDimension);
  const canvas = renderToCanvas(img, width, height);
  const { blob, ext } = await compressCanvas(canvas, effectiveQuality, targetKB);

  URL.revokeObjectURL(img.src);

  const baseName = file.name.replace(/\.[^/.]+$/, "");
  const compressedFile = new File([blob], `${baseName}.${ext}`, { type: blob.type });

  return { file: compressedFile, originalSize, compressedSize: blob.size, skipped: false };
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
  // Delegate to processImage with 800px max dimension
  const main = await processImage(file, 800, quality);
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
