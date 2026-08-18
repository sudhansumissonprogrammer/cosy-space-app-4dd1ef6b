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
 * The <video> has NO `src`, NO `poster` and `preload="none"` until
 * `cardVideoScheduler` promotes it to the single active card, so cold page
 * load costs exactly zero extra bytes and the <img> stays the LCP element.
 * (A `poster` would be fetched immediately by every card — that is why the
 * product image underneath is used as the placeholder instead.)
 */
import { memo, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { isCardVideoEligible, registerCardVideo } from "@/lib/cardVideoScheduler";

interface Props {
  /** Wrapper element that contains the rendered product card. */
  hostRef: React.RefObject<HTMLElement>;
  videoUrl?: string | null;
  /** Set false to skip entirely (e.g. app disabled for the store). */
  enabled?: boolean;
}

/**
 * Some imported catalogues contain concatenated URLs
 * ("https://a.com/https://b.com/x.mp4"). Keep only the last real URL.
 */
/**
 * URLs that failed to decode once (404, bad codec, CORS) are remembered for
 * the page lifetime so a remounted card never re-downloads a dead file.
 */
const deadSources = new Set<string>();

function sanitizeUrl(u?: string | null): string {
  if (!u) return "";
  const i = u.lastIndexOf("https://");
  const j = u.lastIndexOf("http://");
  const k = Math.max(i, j);
  return k > 0 ? u.slice(k) : u;
}

function ProductCardVideoImpl({ hostRef, videoUrl: rawUrl, enabled = true }: Props) {
  const videoUrl = sanitizeUrl(rawUrl);
  const ref = useRef<HTMLVideoElement | null>(null);
  const [mountTo, setMountTo] = useState<HTMLElement | null>(null);
  // Copied from the card's own <img> so the video matches every theme:
  // contain-fit jewellery cards stay letterboxed, cover-fit cards stay cropped,
  // and rounded corners are inherited instead of squared off.
  const [fit, setFit] = useState<{ objectFit: string; objectPosition: string; borderRadius: string }>({
    objectFit: "cover",
    objectPosition: "center",
    borderRadius: "inherit",
  });
  const [playing, setPlaying] = useState(false);
  // A source that fails to decode (bad import, unsupported codec) is dropped
  // for good so the scheduler moves on to the next card instead of stalling.
  const [failed, setFailed] = useState(() => deadSources.has(sanitizeUrl(rawUrl)));
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
      const cs = getComputedStyle(img!);
      setFit({
        objectFit: cs.objectFit || "cover",
        objectPosition: cs.objectPosition || "center",
        borderRadius: cs.borderRadius || "inherit",
      });
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
    if (!mountTo || failed || !ref.current || !videoUrl) return;
    return registerCardVideo(ref.current, videoUrl, (isActive) => {
      if (!isActive) setPlaying(false);
    });
  }, [mountTo, videoUrl, failed]);

  if (!eligible || failed || !mountTo) return null;

  return createPortal(
    <video
      ref={ref}
      preload="none"
      muted
      loop
      playsInline
      disablePictureInPicture
      aria-hidden="true"
      tabIndex={-1}
      onPlaying={() => setPlaying(true)}
      onPause={() => setPlaying(false)}
      onError={() => {
        setPlaying(false);
        // Releasing the buffer (removeAttribute("src") + load()) legitimately
        // fires an empty-src error — that is not a broken video.
        if (ref.current?.getAttribute("src")) {
          deadSources.add(videoUrl);
          setFailed(true);
        }
      }}
      style={{
        objectFit: fit.objectFit as any,
        objectPosition: fit.objectPosition,
        borderRadius: fit.borderRadius,
      }}
      className={`pointer-events-none absolute inset-0 z-[2] h-full w-full transition-opacity duration-300 ease-out ${
        playing ? "opacity-100" : "opacity-0"
      }`}
    />,
    mountTo,
  );
}

export default memo(ProductCardVideoImpl);
