/**
 * TrustVideoLauncher — floating glass pill that opens the trust-video reel.
 *
 * Cold-load safe by design:
 *  - Mounted only after StorefrontShell's idle gate.
 *  - Renders nothing until a tiny HEAD-style count query confirms the store
 *    actually has active trust videos (result memoised in localStorage so
 *    repeat visits render instantly with zero flicker).
 *  - The player chunk, the slide list and the media itself are fetched ONLY
 *    on tap.
 */
import { lazy, Suspense, useEffect, useState } from "react";
import { PlayCircle } from "lucide-react";
import { hasTrustVideos, fetchTrustReel, type TrustSlide } from "@/lib/trustVideos";

const TrustVideoReel = lazy(() => import("./TrustVideoReel"));

interface Props {
  storeId: string;
  storeSlug: string;
}

const LS_KEY = (id: string) => `sf_trust_videos_${id}`;

export default function TrustVideoLauncher({ storeId, storeSlug }: Props) {
  const [available, setAvailable] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try { return localStorage.getItem(LS_KEY(storeId)) === "1"; } catch { return false; }
  });
  const [open, setOpen] = useState(false);
  const [slides, setSlides] = useState<TrustSlide[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    hasTrustVideos(storeId)
      .then((has) => {
        if (cancelled) return;
        setAvailable(has);
        try { localStorage.setItem(LS_KEY(storeId), has ? "1" : "0"); } catch {}
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [storeId]);

  const handleOpen = async () => {
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

  if (!available) return null;

  return (
    <>
      <button
        onClick={handleOpen}
        aria-label="Watch customer trust videos"
        className="fixed bottom-24 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-white/30 bg-white/15 text-white shadow-[0_8px_28px_rgba(0,0,0,0.28)] backdrop-blur-2xl transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.94] sm:bottom-5"
        style={{ color: "var(--storefront-text, #111)" }}
      >
        <span
          className="absolute inset-0 rounded-full opacity-30"
          style={{ background: "linear-gradient(140deg, var(--storefront-primary, #10b981), transparent 70%)" }}
          aria-hidden="true"
        />
        {loading ? (
          <span className="relative h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <PlayCircle className="relative h-7 w-7" strokeWidth={1.8} />
        )}
      </button>

      {open && slides && (
        <Suspense fallback={null}>
          <TrustVideoReel slides={slides} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
}
