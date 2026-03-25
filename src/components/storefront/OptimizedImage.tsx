import { useState, memo } from "react";
import {
  optimizeImageUrl,
  getImageSrcSet,
  PRODUCT_CARD_SIZES,
} from "@/lib/imageOptimize";

interface OptimizedImageProps {
  src: string | null | undefined;
  alt: string;
  /** Largest render width needed (for srcSet generation) */
  width?: number;
  /** Custom sizes attribute — defaults to product card sizes */
  sizes?: string;
  /** Whether this is an above-the-fold / LCP image */
  priority?: boolean;
  /** CSS class for the img element */
  className?: string;
  /** Inline style */
  style?: React.CSSProperties;
  /** Aspect ratio for the wrapper (e.g., "4/5", "3/4", "1/1") */
  aspectRatio?: string;
  /** Fallback component when no src */
  fallback?: React.ReactNode;
  /** Image quality 1-100 */
  quality?: number;
  /** Breakpoint widths for srcSet */
  srcSetSizes?: number[];
  /** Called on error */
  onError?: () => void;
}

/**
 * Universal optimized image component for the storefront.
 *
 * - Generates srcSet for responsive loading
 * - Sets fetchpriority / loading / decoding based on `priority`
 * - Shows a fade-in on load for lazy images
 * - Handles broken images gracefully
 */
function OptimizedImageInner({
  src,
  alt,
  width = 400,
  sizes = PRODUCT_CARD_SIZES,
  priority = false,
  className = "",
  style,
  aspectRatio,
  fallback,
  quality = 85,
  srcSetSizes = [400, 800],
  onError,
}: OptimizedImageProps) {
  const [loaded, setLoaded] = useState(priority); // priority images start visible
  const [errored, setErrored] = useState(false);

  if (!src || errored) {
    return fallback ? <>{fallback}</> : null;
  }

  const optimizedSrc = optimizeImageUrl(src, width, quality);
  const srcSet = getImageSrcSet(src, srcSetSizes, quality);

  return (
    <img
      src={optimizedSrc}
      srcSet={srcSet || undefined}
      sizes={srcSet ? sizes : undefined}
      alt={alt}
      className={`${className} ${!priority && !loaded ? "opacity-0" : "opacity-100"} transition-opacity duration-300`}
      style={style}
      loading={priority ? "eager" : "lazy"}
      decoding={priority ? "sync" : "async"}
      fetchPriority={priority ? "high" : "auto"}
      onLoad={() => setLoaded(true)}
      onError={() => {
        setErrored(true);
        onError?.();
      }}
      draggable={false}
    />
  );
}

export const OptimizedImage = memo(OptimizedImageInner);
export default OptimizedImage;
