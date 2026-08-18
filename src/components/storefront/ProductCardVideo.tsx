/**
 * ProductCardVideo — mobile-only silent video layer for a product card.
 *
 * It is mounted ONCE per card from `UniversalProductCard`, so it works with
 * every card style (style-1..10, V19, V20) without touching each file. On
 * mount it locates the card's primary <img> and portals a <video> into that
 * image's container, perfectly overlaying the product photo.
 *
 * Renders NOTHING when:
 *   - the product has no `video_url`
 *   - the "Card Video" app is off for the store
 *   - the device/network is not eligible (desktop, save-data, 2G/3G,
 *     reduced motion)
 *
 * The <video> has NO `src` and `preload="none"` until `cardVideoScheduler`
 * promotes it to the single active card, so cold page load costs exactly
 * zero extra bytes and the <img> stays the LCP element.
 */
import { memo, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { isCardVideoEligible, registerCardVideo } from "@/lib/cardVideoScheduler";

interface Props {
  /** Wrapper element that contains the rendered product card. */
  hostRef: React.RefObject<HTMLElement>;
  videoUrl?: string | null;
  poster?: string | null;
  /** Set false to skip entirely (e.g. app disabled for the store). */
  enabled?: boolean;
}

/**
 * Some imported catalogues contain concatenated URLs
 * ("https://a.com/https://b.com/x.mp4"). Keep only the last real URL.
 */
function sanitizeUrl(u?: string | null): string {
  if (!u) return "";
  const i = u.lastIndexOf("https://");
  const j = u.lastIndexOf("http://");
  const k = Math.max(i, j);
  return k > 0 ? u.slice(k) : u;
}

function ProductCardVideoImpl({ hostRef, videoUrl: rawUrl, poster, enabled = true }: Props) {
  const videoUrl = sanitizeUrl(rawUrl);
  const ref = useRef<HTMLVideoElement | null>(null);
  const [mountTo, setMountTo] = useState<HTMLElement | null>(null);
  const [playing, setPlaying] = useState(false);
  // A source that fails to decode (bad import, unsupported codec) is dropped
  // for good so the scheduler moves on to the next card instead of stalling.
  const [failed, setFailed] = useState(false);
  const eligible = enabled && !!videoUrl && isCardVideoEligible();

  // Find the image container of whichever card style rendered. Lazy card
  // styles arrive behind Suspense, so keep watching until the <img> exists.
  useEffect(() => {
    if (!eligible) return;
    const host = hostRef.current;
    if (!host) return;

    let done = false;
    const attach = () => {
      if (done) return true;
      const img = host.querySelector("img");
      const parent = img?.parentElement as HTMLElement | undefined;
      if (!parent) return false;
      const pos = getComputedStyle(parent).position;
      if (pos === "static") parent.style.position = "relative";
      done = true;
      setMountTo(parent);
      return true;
    };

    if (attach()) return;
    const mo = new MutationObserver(() => {
      if (attach()) mo.disconnect();
    });
    mo.observe(host, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [eligible, hostRef]);

  useEffect(() => {
    if (!mountTo || !ref.current || !videoUrl) return;
    return registerCardVideo(ref.current, videoUrl, (isActive) => {
      if (!isActive) setPlaying(false);
    });
  }, [mountTo, videoUrl]);

  if (!eligible || failed || !mountTo) return null;

  return createPortal(
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
      onError={() => { setPlaying(false); setFailed(true); }}
      className={`pointer-events-none absolute inset-0 z-[2] h-full w-full object-cover object-center transition-opacity duration-300 ease-out ${
        playing ? "opacity-100" : "opacity-0"
      }`}
    />,
    mountTo,
  );
}

export default memo(ProductCardVideoImpl);
