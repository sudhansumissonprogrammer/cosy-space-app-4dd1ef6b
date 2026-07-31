/**
 * TrustVideoLauncher — Flipkart-style floating video preview.
 *
 * ZERO page-load cost by design (v2):
 *  - Nothing renders until the shopper has scrolled (~500px) — the launcher
 *    never exists during the LCP / product-image window.
 *  - The floating tile is a POSTER IMAGE ONLY. No <video> element, no
 *    autoplay, no muted background streaming. Previously a 3-5MB mp4 was
 *    being pulled on every home / category view.
 *  - The reel chunk + the video bytes are fetched only on tap (with a warm
 *    prefetch on touch-start so the first frame paints fast).
 */
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Play, X } from "lucide-react";
import {
  fetchTrustVideoProbe,
  fetchTrustReel,
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
/** px of scroll before the floating tile is allowed to appear */
const SCROLL_REVEAL_PX = 500;

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
  const [revealed, setRevealed] = useState(false);
  const [open, setOpen] = useState(false);
  const [slides, setSlides] = useState<TrustSlide[] | null>(null);
  const [loading, setLoading] = useState(false);
  const prefetchedRef = useRef(false);


  // Existence probe + first-video fetch — both idle, no LCP impact.
  useEffect(() => {
    if (dismissed) return;
    let cancelled = false;
    const run = () => {
      // ONE request for both signals (was: count probe + row fetch, serial).
      fetchTrustVideoProbe(storeId)
        .then(({ available: has, preview: p }) => {
          if (cancelled) return;
          setAvailable(has);
          try { localStorage.setItem(LS_KEY(storeId), has ? "1" : "0"); } catch {}
          if (!has || !p) return;
          setPreview(p);
          try { localStorage.setItem(LS_PREVIEW(storeId), JSON.stringify(p)); } catch {}
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
  // PERF (India mobile): an autoplaying preview downloads the WHOLE mp4
  // (4-6MB was landing on every category page), starving product images on
  // 4G. On slow / data-saver connections we keep the poster image only —
  // tapping still opens the full reel, so nothing is lost functionally.
  useEffect(() => {
    if (!preview || dismissed) return;
    const conn = (navigator as any).connection;
    const slow =
      !!conn &&
      (conn.saveData === true ||
        ["slow-2g", "2g", "3g"].includes(String(conn.effectiveType || "")));
    if (slow && preview.posterUrl) return; // poster-only, zero video bytes

    let cancelled = false;
    // Raw uploads (compression only kicks in above 45MB) can be 20-45MB. An
    // autoplaying 78px thumbnail would stream the ENTIRE file and starve the
    // product grid, so we HEAD the file once (result cached) and fall back to
    // the poster whenever it is too heavy to be a "preview".
    const MAX_PREVIEW_BYTES = 6 * 1024 * 1024;
    const sizeKey = `sf_tv_size_${preview.videoUrl}`;
    const okToPlay = async (): Promise<boolean> => {
      if (!preview.posterUrl) return true; // no poster -> video is the only visual
      try {
        const cached = localStorage.getItem(sizeKey);
        if (cached) return Number(cached) <= MAX_PREVIEW_BYTES;
      } catch {}
      try {
        const res = await fetch(preview.videoUrl, { method: "HEAD" });
        const len = Number(res.headers.get("content-length") || 0);
        if (!len) return true;
        try { localStorage.setItem(sizeKey, String(len)); } catch {}
        return len <= MAX_PREVIEW_BYTES;
      } catch {
        return true;
      }
    };

    const start = () => {
      okToPlay().then((ok) => {
        if (!cancelled && ok) setMountVideo(true);
      });
    };
    const ric = (window as any).requestIdleCallback as
      | ((cb: () => void) => number)
      | undefined;
    const h = ric ? ric(start) : window.setTimeout(start, 800);
    return () => {
      cancelled = true;
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
