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



  const handleOpen = async () => {
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

  const waPhone = whatsappNumber?.replace(/[^0-9+]/g, "");
  const waMessage = encodeURIComponent(
    `Hi ${storeName}! 👋\nI'm interested in buying products from your store. Could you help me?`
  );

  return (
    <>
      <div
        className="fixed bottom-24 right-3 z-40 animate-fade-in sm:bottom-5"
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

        {waPhone && (
          <a
            href={`https://wa.me/${waPhone}?text=${waMessage}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Chat on WhatsApp"
            onClick={(e) => e.stopPropagation()}
            className="absolute -top-1.5 -left-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#25D366] text-white shadow-md ring-1 ring-white/30 backdrop-blur transition hover:scale-105 active:scale-90"
          >
            <svg viewBox="0 0 32 32" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
              <path d="M16.004 3.2C9.056 3.2 3.406 8.848 3.404 15.8c-.001 2.222.58 4.392 1.683 6.303L3.2 28.8l6.867-1.802A12.56 12.56 0 0 0 16 28.398h.005C22.95 28.398 28.6 22.75 28.6 15.8 28.6 8.85 22.95 3.2 16.004 3.2Zm0 22.997h-.004a10.44 10.44 0 0 1-5.318-1.457l-.382-.226-3.955 1.038 1.055-3.858-.249-.395A10.42 10.42 0 0 1 5.54 15.8c.002-5.77 4.697-10.463 10.466-10.463 5.77 0 10.463 4.695 10.463 10.464 0 5.77-4.695 10.465-10.465 10.465v-.069Zm5.74-7.835c-.315-.158-1.863-.92-2.152-1.025-.289-.105-.499-.158-.71.158-.21.315-.815 1.025-.999 1.236-.184.21-.368.236-.683.079-.315-.158-1.33-.49-2.533-1.562-.937-.835-1.568-1.867-1.752-2.182-.184-.315-.02-.486.138-.643.142-.141.315-.368.473-.552.158-.184.21-.315.315-.526.106-.21.053-.394-.026-.552-.079-.158-.71-1.71-.973-2.341-.256-.615-.517-.532-.71-.542-.184-.008-.394-.01-.604-.01s-.552.079-.841.394c-.29.315-1.104 1.078-1.104 2.63 0 1.552 1.13 3.052 1.288 3.262.158.21 2.224 3.396 5.388 4.762.753.326 1.341.52 1.8.665.756.24 1.444.206 1.988.125.607-.09 1.863-.762 2.126-1.498.263-.736.263-1.367.184-1.498-.079-.132-.289-.21-.604-.369Z" />
            </svg>
          </a>
        )}

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
          <TrustVideoReel
            slides={slides}
            onClose={() => setOpen(false)}
            storeName={storeName}
            whatsappNumber={whatsappNumber}
          />
        </Suspense>
      )}
    </>
  );
}
