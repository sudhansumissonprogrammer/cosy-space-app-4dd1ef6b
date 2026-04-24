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
  // Finer-grained breakpoints so mobile (50vw on a 360-414px screen ≈ 200px CSS,
  // 400px DPR-2) gets a tight 200/400 file instead of the 800 desktop variant.
  srcSetSizes = [200, 400, 600, 800],
  onError,
}: OptimizedImageProps) {
  const [loaded, setLoaded] = useState(priority);
  const [errored, setErrored] = useState(false);

  if (!src || errored) {
    return fallback ? <>{fallback}</> : null;
  }

  const optimizedSrc = optimizeImageUrl(src, width, quality);
  const blurSrc = optimizeImageUrl(src, 20, 30);
  const srcSet = getImageSrcSet(src, srcSetSizes, quality);

  return (
    <div className="relative overflow-hidden" style={aspectRatio ? { aspectRatio } : undefined}>
      {/* Blur-up placeholder */}
      {!priority && !loaded && (
        <img
          src={blurSrc}
          alt=""
          aria-hidden="true"
          className={`absolute inset-0 h-full w-full object-cover ${className}`}
          style={{ filter: "blur(12px)", transform: "scale(1.1)", ...style }}
          loading="eager"
          decoding="sync"
        />
      )}
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
    </div>
  );
}

export const OptimizedImage = memo(OptimizedImageInner);
export default OptimizedImage;
