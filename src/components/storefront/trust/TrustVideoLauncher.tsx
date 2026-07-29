/**
 * TrustVideoLauncher — Flipkart-style floating video preview.
 *
 * Renders a small muted-autoplay looping video thumbnail in the bottom-right
 * corner. Tap the video to open the full-screen reel with sound. A tiny X
 * lets the shopper dismiss it for the session.
 *
 * Cold-load safe by design:
 *  - Mounted only after StorefrontShell's idle gate.
 *  - Existence probe cached in localStorage → instant repeat renders.
 *  - The <video> element uses preload="metadata" and is only inserted after
 *    an idle callback, so it never competes with LCP / hero images.
 *  - The player chunk, slide list and full-quality media are fetched ONLY on tap.
 */
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { X, Volume2 } from "lucide-react";
import {
  hasTrustVideos,
  fetchTrustReel,
  fetchFirstTrustVideo,
  type TrustSlide,
} from "@/lib/trustVideos";

const TrustVideoReel = lazy(() => import("./TrustVideoReel"));

interface Props {
  storeId: string;
  storeSlug: string;
}

const LS_KEY = (id: string) => `sf_trust_videos_${id}`;
const LS_PREVIEW = (id: string) => `sf_trust_preview_${id}`;
const SS_DISMISS = (id: string) => `sf_trust_dismiss_${id}`;

type PreviewCache = { videoUrl: string; posterUrl: string | null };

export default function TrustVideoLauncher({ storeId, storeSlug }: Props) {
  const [available, setAvailable] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try { return localStorage.getItem(LS_KEY(storeId)) === "1"; } catch { return false; }
  });
  const [preview, setPreview] = useState<PreviewCache | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(LS_PREVIEW(storeId));
      return raw ? (JSON.parse(raw) as PreviewCache) : null;
    } catch { return null; }
  });
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try { return sessionStorage.getItem(SS_DISMISS(storeId)) === "1"; } catch { return false; }
  });
  const [mountVideo, setMountVideo] = useState(false);
  const [open, setOpen] = useState(false);
  const [slides, setSlides] = useState<TrustSlide[] | null>(null);
  const [loading, setLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Existence probe + first-video fetch — both idle, no LCP impact.
  useEffect(() => {
    if (dismissed) return;
    let cancelled = false;
    const run = () => {
      hasTrustVideos(storeId)
        .then((has) => {
          if (cancelled) return;
          setAvailable(has);
          try { localStorage.setItem(LS_KEY(storeId), has ? "1" : "0"); } catch {}
          if (!has) return;
          if (preview) return;
          return fetchFirstTrustVideo(storeId).then((p) => {
            if (cancelled || !p) return;
            setPreview(p);
            try { localStorage.setItem(LS_PREVIEW(storeId), JSON.stringify(p)); } catch {}
          });
        })
        .catch(() => {});
    };
    const ric = (window as any).requestIdleCallback as
      | ((cb: () => void, opts?: { timeout: number }) => number)
      | undefined;
    const handle = ric
      ? ric(run, { timeout: 3000 })
      : window.setTimeout(run, 1500);
    return () => {
      cancelled = true;
      if (ric && typeof handle === "number") (window as any).cancelIdleCallback?.(handle);
      else window.clearTimeout(handle as number);
    };
  }, [storeId, dismissed, preview]);

  // Insert the <video> element only after an idle tick so we don't fight LCP.
  useEffect(() => {
    if (!preview || dismissed) return;
    const ric = (window as any).requestIdleCallback as
      | ((cb: () => void) => number)
      | undefined;
    const h = ric ? ric(() => setMountVideo(true)) : window.setTimeout(() => setMountVideo(true), 800);
    return () => {
      if (ric) (window as any).cancelIdleCallback?.(h);
      else window.clearTimeout(h as number);
    };
  }, [preview, dismissed]);

  const handleOpen = async () => {
    // Pause the preview so it doesn't fight the full-screen player for the decoder.
    videoRef.current?.pause();
    if (loading) return;
    if (slides) { setOpen(true); return; }
    setLoading(true);
    try {
      const list = await fetchTrustReel(storeId, storeSlug);
      if (list.length === 0) { setAvailable(false); return; }
      setSlides(list);
      setOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissed(true);
    try { sessionStorage.setItem(SS_DISMISS(storeId), "1"); } catch {}
  };

  if (!available || dismissed || !preview) return null;

  return (
    <>
      <div
        className="fixed bottom-24 right-3 z-40 sm:bottom-5"
        style={{ width: 78 }}
      >
        <button
          type="button"
          onClick={handleOpen}
          aria-label="Watch customer videos"
          className="relative block w-full overflow-hidden rounded-2xl bg-black shadow-[0_10px_28px_rgba(0,0,0,0.32)] ring-1 ring-white/25 transition-transform duration-200 active:scale-[0.96]"
          style={{ aspectRatio: "9 / 16" }}
        >
          {mountVideo ? (
            <video
              ref={videoRef}
              src={preview.videoUrl}
              poster={preview.posterUrl || undefined}
              autoPlay
              muted
              loop
              playsInline
              disablePictureInPicture
              disableRemotePlayback
              {...({
                controlsList: "nodownload nofullscreen noremoteplayback noplaybackrate",
                "webkit-playsinline": "true",
                "x-webkit-airplay": "deny",
              } as any)}

              preload="metadata"
              className="sf-trust-preview pointer-events-none absolute inset-0 h-full w-full object-cover"
            />
          ) : preview.posterUrl ? (
            <img
              src={preview.posterUrl}
              alt=""
              aria-hidden
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : null}


          {/* subtle bottom gradient + speaker hint so shoppers know tap = sound */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-1 bg-gradient-to-t from-black/70 via-black/20 to-transparent px-1.5 pb-1.5 pt-6">
            <span className="text-[9px] font-semibold uppercase tracking-wide text-white/95 drop-shadow">
              Reels
            </span>
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/90 text-black">
              <Volume2 className="h-2.5 w-2.5" strokeWidth={2.5} />
            </span>
          </div>

          {loading && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/40">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Hide videos"
          className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/85 text-white shadow-md ring-1 ring-white/30 backdrop-blur transition active:scale-90"
        >
          <X className="h-3 w-3" strokeWidth={3} />
        </button>
      </div>

      {open && slides && (
        <Suspense fallback={null}>
          <TrustVideoReel slides={slides} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
}
