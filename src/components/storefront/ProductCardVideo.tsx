/**
 * ProductCardVideo — tap-to-play video layer for a product card.
 *
 * No autoplay, no scheduler, no preloading: the card shows a small play
 * button over the product image, and the <video> element (and therefore the
 * first byte of video) only exists after the shopper taps it. Cold page load
 * and category-grid performance are byte-for-byte identical to a card
 * without video.
 *
 * Mounted ONCE per card from `UniversalProductCard`, so it works with every
 * card style (style-1..10, V19, V20) by portalling into the card's own image
 * container.
 */
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Play, X } from "lucide-react";
import { normalizeProductVideoUrl } from "@/lib/productVideoUrl";

interface Props {
  /** Wrapper element that contains the rendered product card. */
  hostRef: React.RefObject<HTMLElement>;
  videoUrl?: string | null;
  /** Set false to skip entirely (e.g. app disabled for the store). */
  enabled?: boolean;
}

/** Only one card video may play at a time across the whole grid. */
let activeStop: (() => void) | null = null;

function ProductCardVideoImpl({ hostRef, videoUrl: rawUrl, enabled = true }: Props) {
  const videoUrl = normalizeProductVideoUrl(rawUrl) || "";
  const ref = useRef<HTMLVideoElement | null>(null);
  const retries = useRef(0);

  const [mountTo, setMountTo] = useState<HTMLElement | null>(null);
  const [fit, setFit] = useState({ objectFit: "cover", objectPosition: "center", borderRadius: "inherit" });
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const eligible = enabled && !!videoUrl && !failed;

  // Find the image container of whichever card style rendered. Lazy card
  // styles arrive behind Suspense, so keep watching until the <img> exists.
  useEffect(() => {
    if (!eligible) return;
    const host = hostRef.current;
    if (!host) return;

    let done = false;
    let retryTimer: number | undefined;
    const attach = () => {
      if (done) return true;
      const preferredStage = host.querySelector<HTMLElement>("[class*='card-img-zoom']");
      // Some themes render a badge <img> before the product photo — pick the
      // largest rendered image instead of blindly taking the first one.
      const images = Array.from(host.querySelectorAll("img"));
      const img = images.reduce<HTMLImageElement | null>((largest, candidate) => {
        const box = candidate.getBoundingClientRect();
        const largestBox = largest?.getBoundingClientRect();
        return !largestBox || box.width * box.height > largestBox.width * largestBox.height
          ? candidate
          : largest;
      }, null);
      const parent = preferredStage || img?.parentElement || undefined;
      if (!parent || (img && img.getBoundingClientRect().width * img.getBoundingClientRect().height === 0)) {
        return false;
      }
      if (getComputedStyle(parent).position === "static") parent.style.position = "relative";
      const cs = img ? getComputedStyle(img) : getComputedStyle(parent);
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
    const retry = () => {
      if (done || attach()) return;
      retryTimer = window.setTimeout(retry, 200);
    };
    retryTimer = window.setTimeout(retry, 100);
    return () => {
      done = true;
      mo.disconnect();
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    };
  }, [eligible, hostRef]);

  const stop = useCallback(() => {
    const video = ref.current;
    if (video) {
      try {
        video.pause();
        video.removeAttribute("src");
        video.load();
      } catch {}
    }
    setOpen(false);
  }, []);

  const stopRef = useRef(stop);
  stopRef.current = stop;

  // Release the buffer when the card unmounts (infinite grids recycle a lot).
  // Only clear the global slot if THIS card currently owns it.
  useEffect(() => () => {
    if (activeStop === stopRef.current) activeStop = null;
    const video = ref.current;
    if (video) {
      try {
        video.pause();
        video.removeAttribute("src");
      } catch {}
    }
  }, []);

  const start = useCallback(
    (event: React.MouseEvent) => {
      // Card is wrapped in a link — do not navigate to the PDP.
      event.preventDefault();
      event.stopPropagation();
      if (activeStop) activeStop();
      activeStop = stop;
      setOpen(true);
    },
    [stop],
  );

  useEffect(() => {
    if (!open) return;
    const video = ref.current;
    if (!video) return;
    retries.current = 0;

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.src = videoUrl;
    video.load();
    const attempt = video.play();
    if (attempt && typeof attempt.catch === "function") attempt.catch(() => {});
  }, [open, videoUrl]);

  if (!eligible || !mountTo) return null;

  return createPortal(
    <>
      {open && (
        <video
          ref={ref}
          preload="none"
          muted
          loop
          playsInline
          disablePictureInPicture
          controls={false}
          aria-hidden="true"
          tabIndex={-1}
          onError={(event) => {
            const current = event.currentTarget;
            if (!current.getAttribute("src") || current.error?.code === MediaError.MEDIA_ERR_ABORTED) return;
            // Network hiccups (and cold CDN edges on big .mov files) surface as
            // a hard error on the first byte. Retry once before giving up so a
            // transient blip does not permanently remove the play button.
            if (retries.current < 1) {
              retries.current += 1;
              const url = videoUrl;
              window.setTimeout(() => {
                const video = ref.current;
                if (!video) return;
                video.src = url;
                video.load();
                const attempt = video.play();
                if (attempt && typeof attempt.catch === "function") attempt.catch(() => {});
              }, 400);
              return;
            }
            setFailed(true);
            setOpen(false);
          }}

          style={{
            objectFit: fit.objectFit as any,
            objectPosition: fit.objectPosition,
            borderRadius: fit.borderRadius,
          }}
          className="pointer-events-none absolute inset-0 z-[2] h-full w-full"
        />
      )}
      <button
        type="button"
        onClick={open ? (e) => { e.preventDefault(); e.stopPropagation(); stop(); } : start}
        aria-label={open ? "Stop video" : "Play product video"}
        className="absolute bottom-2 left-2 z-[3] grid h-10 w-10 place-items-center rounded-full bg-black/55 text-white shadow-lg ring-1 ring-white/40 backdrop-blur-sm transition-transform active:scale-95"
      >
        {open ? <X className="h-5 w-5" /> : <Play className="h-5 w-5 translate-x-[1px] fill-current" />}
      </button>
    </>,
    mountTo,
  );
}

export default memo(ProductCardVideoImpl);
