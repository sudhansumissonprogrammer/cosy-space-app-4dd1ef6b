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
import { createPortal } from "react-dom";
import { Play, X } from "lucide-react";
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
/** px of scroll before the floating tile is allowed to appear */
const SCROLL_REVEAL_PX = 500;

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
  const prefetchedRef = useRef(false);


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
      ? ric(run, { timeout: 3000 })
      : window.setTimeout(run, 1500);
    return () => {
      cancelled = true;
      if (ric && typeof handle === "number") (window as any).cancelIdleCallback?.(handle);
      else window.clearTimeout(handle as number);
    };
  }, [storeId, dismissed]);

  // Reveal after the shopper has scrolled, OR after 3s of page load.
  // The tile + poster still only render once the idle probe confirms
  // availability, so the first-paint / LCP window is untouched.
  useEffect(() => {
    if (dismissed || revealed) return;

    let loadTimer: number | undefined;
    const reveal = () => {
      setRevealed(true);
      if (loadTimer !== undefined) window.clearTimeout(loadTimer);
      window.removeEventListener("scroll", check);
    };

    const check = () => {
      if (window.scrollY >= SCROLL_REVEAL_PX) reveal();
    };

    check();
    window.addEventListener("scroll", check, { passive: true });
    loadTimer = window.setTimeout(reveal, 3000);

    return () => {
      window.removeEventListener("scroll", check);
      if (loadTimer !== undefined) window.clearTimeout(loadTimer);
    };
  }, [dismissed, revealed]);

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
    fireStorefrontEvent({ storeId, eventName: "reel_open" });
    // Open IMMEDIATELY — the shopper gets a full-screen response on the very
    // first tap. Slides load behind the overlay (previously a slow/failed
    // fetch made the tap look completely dead).
    setOpen(true);
    if (slides || loading) return;
    setLoading(true);
    try {
      const list = await fetchTrustReel(storeId, storeSlug);
      if (list.length === 0) { setOpen(false); setAvailable(false); return; }
      setSlides(list);
    } catch {
      // Network hiccup — let the next tap retry instead of dead-ending.
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };


  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissed(true);
    try { sessionStorage.setItem(SS_DISMISS(storeId), "1"); } catch {}
  };

  if (!available || dismissed || !preview || !revealed) return null;

  return (
    <>
      <div
        className="fixed bottom-[4.5rem] right-3 z-40 animate-fade-in sm:bottom-5"
        style={{ width: 78 }}
      >
        <button
          type="button"
          onClick={handleOpen}
          onPointerEnter={prefetch}
          onTouchStart={prefetch}
          aria-label="Watch customer videos"
          className="relative block w-full overflow-hidden rounded-2xl bg-black shadow-[0_10px_28px_rgba(0,0,0,0.32)] ring-1 ring-white/25 transition-transform duration-200 active:scale-[0.96]"
          style={{ aspectRatio: "9 / 16" }}
        >
          {preview.posterUrl ? (
            <img
              src={preview.posterUrl}
              alt=""
              aria-hidden
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : null}

          {/* Play affordance — tap loads and plays the reel with sound */}
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-black shadow-md">
              <Play className="h-3.5 w-3.5 translate-x-[1px] fill-current" strokeWidth={0} />
            </span>
          </span>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-1 bg-gradient-to-t from-black/70 via-black/20 to-transparent px-1.5 pb-1.5 pt-6">
            <span className="text-[9px] font-semibold uppercase tracking-wide text-white/95 drop-shadow">
              Reels
            </span>
          </div>


          {loading && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/40">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            </span>
          )}
        </button>

        {/* WhatsApp lives only INSIDE the opened reel — the small floating
            tile stays a pure tap-to-open target. */}

        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Hide videos"
          className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/85 text-white shadow-md ring-1 ring-white/30 backdrop-blur transition active:scale-90"
        >
          <X className="h-3 w-3" strokeWidth={3} />
        </button>
      </div>

      {/* Instant full-screen response while the reel data loads. */}
      {open && !slides &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black">
            <span className="h-9 w-9 animate-spin rounded-full border-2 border-white/80 border-t-transparent" />
            <button
              type="button"
              onClick={() => setOpen(false)}
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
            onClose={() => setOpen(false)}
            storeId={storeId}
            storeName={storeName}
            whatsappNumber={whatsappNumber}
          />
        </Suspense>
      )}

    </>
  );
}
