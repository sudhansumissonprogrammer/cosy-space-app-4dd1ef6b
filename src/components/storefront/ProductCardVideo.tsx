/**
 * ProductCardVideo — mobile-only silent video layer for a product card.
 *
 * Renders NOTHING (null) when:
 *   - the product has no `video_url`
 *   - the "Card Video" app is off for the store
 *   - the device/network is not eligible (desktop, save-data, 2G, reduced motion)
 *
 * When it does render, the <video> has NO `src` and `preload="none"`, so it
 * costs zero network bytes until `cardVideoScheduler` promotes it to the
 * single active card. It sits above the product image and only fades in once
 * playback actually starts, so the <img> stays the LCP element.
 */
import { memo, useEffect, useRef, useState } from "react";
import { isCardVideoEligible, registerCardVideo } from "@/lib/cardVideoScheduler";

interface Props {
  videoUrl?: string | null;
  poster?: string | null;
  /** Set false to skip entirely (e.g. app disabled for the store). */
  enabled?: boolean;
  className?: string;
}

function ProductCardVideoImpl({ videoUrl, poster, enabled = true, className }: Props) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const eligible = enabled && !!videoUrl && isCardVideoEligible();

  useEffect(() => {
    if (!eligible || !ref.current || !videoUrl) return;
    return registerCardVideo(ref.current, videoUrl, (isActive) => {
      if (!isActive) setPlaying(false);
    });
  }, [eligible, videoUrl]);

  if (!eligible) return null;

  return (
    <video
      ref={ref}
      poster={poster || undefined}
      preload="none"
      muted
      loop
      playsInline
      disablePictureInPicture
      aria-hidden="true"
      tabIndex={-1}
      onPlaying={() => setPlaying(true)}
      onPause={() => setPlaying(false)}
      onError={() => setPlaying(false)}
      className={
        className ??
        `pointer-events-none absolute inset-0 z-[2] h-full w-full object-cover object-center transition-opacity duration-300 ease-out ${
          playing ? "opacity-100" : "opacity-0"
        }`
      }
      style={className ? undefined : { backgroundColor: "transparent" }}
    />
  );
}

export default memo(ProductCardVideoImpl);
