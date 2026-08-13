import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { optimizeImageUrl, getImageSrcSet, preloadHeroImage, HERO_IMAGE_SIZES } from "@/lib/imageOptimize";

interface HeroVideoProps {
  /** Video file URL (mp4/webm) */
  src: string;
  /** Poster image URL — this is the LCP element, always rendered first */
  poster?: string | null;
  storeName: string;
  className?: string;
  /** Poster optimisation width (mobile 800, desktop 1200) */
  posterWidth?: number;
  /** Aspect ratio reserved before the video/poster paints (prevents CLS) */
  aspectRatio?: string;
  /** Extra style for the media element */
  mediaClassName?: string;
  /** Max height style */
  maxHeight?: string;
  /** Optional storefront route the hero links to */
  linkTo?: string;
  overlay?: React.ReactNode;
}

/** Coarse "should we even fetch a video?" check — saves data on 2G/3G. */
function connectionAllowsVideo(): boolean {
  const c = (navigator as any).connection;
  if (!c) return true;
  if (c.saveData) return false;
  const t = String(c.effectiveType || "");
  return !(t === "slow-2g" || t === "2g");
}

/**
 * Hero video with a zero-cost first paint.
 *
 * Load strategy (this is what keeps PageSpeed intact):
 *  1. The poster image renders immediately as a normal <img> (eager, high
 *     priority, srcSet) — the LCP candidate stays an image, exactly like the
 *     image-only hero.
 *  2. The <video> element is only mounted once the hero is in/near the
 *     viewport AND the browser is idle, with preload="none" until then, so
 *     video bytes never compete with the critical path.
 *  3. Skipped entirely on save-data / 2G connections and when the visitor
 *     prefers reduced motion — they keep the poster image.
 */
export default function HeroVideo({
  src,
  poster,
  storeName,
  className = "",
  posterWidth = 800,
  aspectRatio,
  mediaClassName = "w-full h-auto block object-cover",
  maxHeight,
  linkTo,
  overlay,
}: HeroVideoProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mountVideo, setMountVideo] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  // Poster is the LCP image — preload it just like the image hero does.
  useEffect(() => {
    if (poster) return preloadHeroImage(poster, posterWidth);
  }, [poster, posterWidth]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || !connectionAllowsVideo()) return;

    let cancelled = false;
    const start = () => {
      if (cancelled) return;
      const idle = (window as any).requestIdleCallback;
      if (typeof idle === "function") idle(() => !cancelled && setMountVideo(true), { timeout: 2000 });
      else setTimeout(() => !cancelled && setMountVideo(true), 300);
    };

    if (typeof IntersectionObserver !== "function") {
      start();
      return () => { cancelled = true; };
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          io.disconnect();
          start();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
    };
  }, []);

  // Pause when scrolled away — no decoding cost while browsing the page.
  useEffect(() => {
    const el = wrapRef.current;
    if (!mountVideo || !el || typeof IntersectionObserver !== "function") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        const v = videoRef.current;
        if (!v) return;
        if (entry.isIntersecting) v.play().catch(() => {});
        else v.pause();
      },
      { threshold: 0.1 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [mountVideo]);

  const posterSrc = poster ? optimizeImageUrl(poster, posterWidth) : undefined;
  const posterSrcSet = poster ? getImageSrcSet(poster, [400, 600, 800, 1200]) : "";

  return (
    <div
      ref={wrapRef}
      className={`relative w-full overflow-hidden ${className}`}
      style={{ ...(aspectRatio ? { aspectRatio } : {}), ...(maxHeight ? { maxHeight } : {}), contain: "layout style" }}
    >
      {poster && (
        <img
          src={posterSrc}
          srcSet={posterSrcSet || undefined}
          sizes={HERO_IMAGE_SIZES}
          alt={`${storeName} hero`}
          className={`${mediaClassName} ${videoReady ? "opacity-0" : "opacity-100"} transition-opacity duration-300 ${aspectRatio ? "absolute inset-0 h-full w-full" : ""}`}
          loading="eager"
          fetchPriority="high"
          decoding="sync"
          draggable={false}
        />
      )}

      {mountVideo && (
        <video
          ref={videoRef}
          src={src}
          poster={posterSrc}
          className={`${mediaClassName} ${poster ? "absolute inset-0 h-full w-full" : ""} ${videoReady || !poster ? "opacity-100" : "opacity-0"} transition-opacity duration-300`}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          {...({ "webkit-playsinline": "true" } as any)}
          disablePictureInPicture
          controls={false}
          aria-label={`${storeName} hero video`}
          onLoadedData={() => setVideoReady(true)}
        />
      )}

      {linkTo && (
        <Link to={linkTo} aria-label={`${storeName} — shop now`} className="absolute inset-0 z-10" />
      )}

      {overlay}
    </div>
  );
}
