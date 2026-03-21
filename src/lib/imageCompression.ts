/**
 * Central image processing utility for ALL uploads.
 * - Validates file size (rejects raw files > 5MB)
 * - Resizes to max dimension (maintains aspect ratio)
 * - Converts to WebP (falls back to JPEG)
 * - Targets under 120KB output
 */

const MAX_RAW_SIZE = 5 * 1024 * 1024; // 5MB — reject before processing
const MAX_OUTPUT_KB = 120; // target output size
const DEFAULT_MAX_DIMENSION = 1200;

export const IMAGE_VARIANT_WIDTHS = [200, 400, 800] as const;
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
  img: HTMLImageElement,
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

  // Iteratively reduce quality
  let currentQuality = quality - 0.05;
  while (blob.size > targetKB * 1024 && currentQuality > 0.15) {
    const nextBlob = await tryFormat(mimeType, currentQuality);
    if (!nextBlob || nextBlob.size === 0) break;
    blob = nextBlob;
    currentQuality -= 0.05;
  }

  // If still over, reduce dimensions
  if (blob.size > targetKB * 1024 && (canvas.width > 400 || canvas.height > 400)) {
    const scale = 0.7;
    const smallCanvas = renderToCanvas(img, Math.round(canvas.width * scale), Math.round(canvas.height * scale));
    let retryQ = 0.6;
    while (retryQ >= 0.2) {
      const smallBlob = await new Promise<Blob | null>((res) =>
        smallCanvas.toBlob((b) => res(b), mimeType, retryQ),
      );
      if (smallBlob && smallBlob.size > 0 && smallBlob.size < blob!.size) {
        blob = smallBlob;
      }
      if (blob!.size <= targetKB * 1024) break;
      retryQ -= 0.1;
    }
  }

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
 * Throws if the raw file exceeds 5MB.
 */
export async function processImage(
  file: File,
  maxDimension = DEFAULT_MAX_DIMENSION,
  quality = 0.8,
): Promise<CompressionResult> {
  const originalSize = file.size;

  if (file.size > MAX_RAW_SIZE) {
    throw new Error(`Image too large (${formatSize(file.size)}). Maximum allowed is 5MB.`);
  }

  if (file.size <= MAX_OUTPUT_KB * 1024 && file.type === "image/webp") {
    return { file, originalSize, compressedSize: file.size, skipped: true };
  }

  const img = await loadImage(file);
  const { width, height } = scaleDimensions(img.width, img.height, maxDimension);
  const canvas = renderToCanvas(img, width, height);
  const { blob, ext } = await compressCanvas(canvas, img, quality, MAX_OUTPUT_KB);

  const baseName = file.name.replace(/\.[^/.]+$/, "");
  const compressedFile = new File([blob], `${baseName}.${ext}`, { type: blob.type });

  return { file: compressedFile, originalSize, compressedSize: blob.size, skipped: false };
}

/**
 * Generate multiple size variants (200, 400, 800px) from a single image.
 * Each variant is WebP, compressed under 120KB.
 * Returns the main (800px) result + a map of all variant files.
 */
export async function processImageMultiSize(
  file: File,
  quality = 0.8,
): Promise<MultiSizeResult> {
  const originalSize = file.size;

  if (file.size > MAX_RAW_SIZE) {
    throw new Error(`Image too large (${formatSize(file.size)}). Maximum allowed is 5MB.`);
  }

  const img = await loadImage(file);
  const variants = new Map<VariantWidth, File>();
  let mainResult: CompressionResult | null = null;

  for (const targetWidth of IMAGE_VARIANT_WIDTHS) {
    // Skip variants larger than the original
    const effectiveWidth = Math.min(targetWidth, img.width);
    const { width, height } = scaleDimensions(img.width, img.height, effectiveWidth);
    const canvas = renderToCanvas(img, width, height);

    // Smaller variants get lower KB target for efficiency
    const targetKB = targetWidth <= 200 ? 30 : targetWidth <= 400 ? 60 : MAX_OUTPUT_KB;
    const { blob, ext } = await compressCanvas(canvas, img, quality, targetKB);

    const baseName = file.name.replace(/\.[^/.]+$/, "");
    const variantFile = new File([blob], `${baseName}-${targetWidth}w.${ext}`, { type: blob.type });
    variants.set(targetWidth, variantFile);

    if (targetWidth === 800) {
      mainResult = { file: variantFile, originalSize, compressedSize: blob.size, skipped: false };
    }
  }

  URL.revokeObjectURL(img.src);

  return {
    main: mainResult!,
    variants,
  };
}

/**
 * @deprecated Use processImage() instead. Kept for backward compatibility.
 */
export const compressImage = processImage;
