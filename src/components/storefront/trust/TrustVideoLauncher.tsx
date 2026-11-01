/**
 * TrustVideoLauncher — Flipkart-style floating video preview.
 *
 * Poster first; muted preview media waits until page load plus three seconds.
 * Hidden tabs, dismissed tiles and open reels pause the preview. Data-saving
 * connections keep the poster. The full reel chunk still loads only on intent.
 */
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Play, Volume2, VolumeX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { activateTrustVideo, toggleTrustPreviewSound, TRUST_PROBE_MS, TRUST_PREVIEW_DELAY_MS, allowsTrustPreview } from "@/lib/trustVideoPlayback";
import { afterStorefrontOpening } from "@/lib/storefrontOpeningReady";
import {
  fetchTrustVideoProbe,
  fetchTrustReel,
  waPhoneNumber,
  type TrustSlide,
} from "@/lib/trustVideos";

import { fireStorefrontEvent } from "@/lib/storefrontEvents";
const TrustVideoReel = lazy(() => import("./TrustVideoReel"));

interface Props {
  storeId: string;
  storeSlug: string;
  storeName: string;
  whatsappNumber?: string | null;
}


const LS_KEY = (id: string) => `sf_trust_videos_${id}`;
const LS_PREVIEW = (id: string) => `sf_trust_preview_${id}`;
const SS_DISMISS = (id: string) => `sf_trust_dismiss_${id}`;
type PreviewCache = { videoUrl: string; posterUrl: string | null };

export default function TrustVideoLauncher({ storeId, storeSlug, storeName, whatsappNumber }: Props) {
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
  const [previewReady, setPreviewReady] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [previewMuted, setPreviewMuted] = useState(true);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const [pageVisible, setPageVisible] = useState(() => !document.hidden);
  useEffect(() => {
    const update = () => setPageVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  useEffect(() => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (dismissed) return;
    return afterStorefrontOpening(() => {
      setRevealed(true);
      setPreviewReady(allowsTrustPreview(connection));
    }, TRUST_PREVIEW_DELAY_MS);
  }, [dismissed]);
  useEffect(() => {
    const video = previewVideoRef.current;
    if (!video) return;
    if (open || !pageVisible || dismissed) {
      video.pause();
      video.muted = true;
      setPreviewMuted(true);
    }
    else void video.play().catch(() => {});
  }, [open, pageVisible, dismissed, previewReady, available, revealed]);
  const previewCaption = storeSlug === "serdiyajewellers"
    ? "Transparent box delivery"
    : ["utkalwatch", "utkalwatches"].includes(storeSlug)
      ? "Packing video"
      : "Watch video";
  const prefetchedRef = useRef(false);
  const activatedVideoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => () => { activatedVideoRef.current?.pause(); }, []);
  const closeReel = () => {
    activatedVideoRef.current?.pause();
    setOpen(false);
  };


  // Existence probe + first-video fetch — both idle, no LCP impact.
  // NOTE: `preview` must NOT be a dependency. setPreview() creates a new object
  // identity on every run, which re-triggered this effect → infinite refetch
  // loop (4.4M store_trust_videos queries observed in production).
  const probedRef = useRef(false);
  useEffect(() => {
    if (dismissed || probedRef.current) return;
    probedRef.current = true;

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
      ? ric(run, { timeout: TRUST_PROBE_MS })
      : window.setTimeout(run, TRUST_PROBE_MS);
    return () => {
      cancelled = true;
      if (ric && typeof handle === "number") (window as any).cancelIdleCallback?.(handle);
      else window.clearTimeout(handle as number);
    };
  }, [storeId, dismissed]);

  /** Warm the reel chunk + first video on touch-start so tap feels instant. */
  const prefetch = () => {
    if (prefetchedRef.current) return;
    prefetchedRef.current = true;
    import("./TrustVideoReel").catch(() => {});
    if (preview?.videoUrl) {
      try {
        const l = document.createElement("link");
        l.rel = "prefetch";
        l.as = "video";
        l.href = preview.videoUrl;
        document.head.appendChild(l);
      } catch { /* noop */ }
    }
  };



  const bubbleShown = available && !dismissed && !!preview && revealed;
  useEffect(() => {
    if (bubbleShown) fireStorefrontEvent({ storeId, eventName: "reel_bubble_view" });
  }, [bubbleShown, storeId]);

  const handleOpen = async () => {
    if (!preview || open) return;
    setPreviewMuted(true);
    previewVideoRef.current?.pause();
    activatedVideoRef.current?.pause();
    activatedVideoRef.current = activateTrustVideo(slides?.[0]?.videoUrl || preview.videoUrl);
    fireStorefrontEvent({ storeId, eventName: "reel_open" });
    // Open IMMEDIATELY — the shopper gets a full-screen response on the very
    // first tap. Slides load behind the overlay (previously a slow/failed
    // fetch made the tap look completely dead).
    setOpen(true);
    if (slides || loading) return;
    setLoading(true);
    try {
      const list = await fetchTrustReel(storeId, storeSlug);
      if (list.length === 0) { closeReel(); setAvailable(false); return; }
      setSlides(list);
    } catch {
      // Network hiccup — let the next tap retry instead of dead-ending.
      closeReel();
    } finally {
      setLoading(false);
    }
  };


  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissed(true);
    try { sessionStorage.setItem(SS_DISMISS(storeId), "1"); } catch {}
  };

  const handlePreviewSound = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = previewVideoRef.current;
    if (!video || open || !pageVisible) return;
    const muted = await toggleTrustPreviewSound(video);
    if (previewVideoRef.current === video) setPreviewMuted(muted);
  };

  if (!available || dismissed || !preview || !revealed) return null;

  return (
    <>
      <div
        className="fixed bottom-[4.5rem] right-3 z-40 w-24 animate-fade-in sm:bottom-5"
      >
        <Button variant="ghost"
          type="button"
          onClick={handleOpen}
          onPointerEnter={prefetch}
          onTouchStart={prefetch}
          aria-label={`Watch video: ${previewCaption}`}
          className="relative block h-auto w-full overflow-hidden whitespace-normal rounded-lg bg-primary p-0 text-primary-foreground shadow-xl ring-1 ring-border transition-transform duration-200 active:scale-[0.96] hover:bg-primary"
          style={{ aspectRatio: "9 / 16" }}
        >
          {preview.posterUrl ? (
            <img
              src={preview.posterUrl}
              alt=""
              aria-hidden
              className="absolute inset-0 h-full w-full object-cover"
              loading="eager"
              decoding="async"
            />
          ) : null}
          {previewReady && pageVisible && !open && !previewFailed && (
            <video
              ref={previewVideoRef}
              src={preview.videoUrl}
              poster={preview.posterUrl || undefined}
              className="pointer-events-none absolute inset-0 h-full w-full object-cover"
              muted={previewMuted}
              autoPlay
              playsInline
              loop
              preload="none"
              aria-hidden="true"
              onError={() => setPreviewFailed(true)}
            />
          )}

          {/* Play affordance — tap loads and plays the reel with sound */}
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-background text-foreground shadow-md">
              <Play className="h-3.5 w-3.5 translate-x-[1px] fill-current" strokeWidth={0} />
            </span>
          </span>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-1 bg-primary/85 px-1.5 py-1.5">
            <span className="text-[10px] font-semibold leading-tight text-primary-foreground">
              {previewCaption}
            </span>
          </div>


          {loading && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/40">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            </span>
          )}
        </Button>

        {previewReady && pageVisible && !open && !previewFailed && (
          <Button variant="ghost" size="icon"
            type="button"
            onClick={handlePreviewSound}
            aria-label={previewMuted ? "Unmute preview video" : "Mute preview video"}
            aria-pressed={!previewMuted}
            title={previewMuted ? "Unmute preview video" : "Mute preview video"}
            className="absolute left-1 top-1 h-7 w-7 rounded-full bg-background/90 p-0 text-foreground shadow-md ring-1 ring-border hover:bg-background"
          >
            {previewMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
        )}

        <Button variant="ghost" size="icon"
          type="button"
          onClick={handleDismiss}
          aria-label="Hide videos"
          className="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full bg-primary p-0 text-primary-foreground shadow-md ring-1 ring-border hover:bg-primary"
        >
          <X className="h-3 w-3" strokeWidth={3} />
        </Button>
      </div>

      {/* Instant full-screen response while the reel data loads. */}
      {open && !slides &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black">
            <span className="h-9 w-9 animate-spin rounded-full border-2 border-white/80 border-t-transparent" />
            <button
              type="button"
              onClick={closeReel}
              aria-label="Close video"
              className="absolute left-3 top-3 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-xl"
            >
              <X className="h-5 w-5" />
            </button>
          </div>,
          document.body,
        )}

      {open && slides && (
        <Suspense fallback={null}>
          <TrustVideoReel
            slides={slides}
            onClose={closeReel}
            activatedVideo={activatedVideoRef.current}
            storeId={storeId}
            storeName={storeName}
            whatsappNumber={whatsappNumber}
          />
        </Suspense>
      )}

    </>
  );
}
