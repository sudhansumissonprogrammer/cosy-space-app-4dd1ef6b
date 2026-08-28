/**
 * TrustVideoReel — full-screen, reel-style player for owner-uploaded trust
 * videos (and, when the Shop by Video app is on, product videos).
 *
 * Loaded ONLY on demand (lazy chunk) when the shopper taps the floating
 * button, so it never touches home / category / PDP cold-load cost.
 *
 * Video only: no titles floating around, no chrome — just the clip plus a
 * glassmorphic "See more details" CTA.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ChevronUp, Volume2, VolumeX, X } from "lucide-react";
import type { TrustSlide } from "@/lib/trustVideos";
import { formatPrice } from "@/lib/productUtils";
import { optimizeImageUrl } from "@/lib/imageOptimize";

interface Props {
  slides: TrustSlide[];
  onClose: () => void;
}

export default function TrustVideoReel({ slides, onClose }: Props) {
  const navigate = useNavigate();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const [buffering, setBuffering] = useState(true);

  const [muted, setMuted] = useState(true);


  // Lock background scroll while the reel owns the screen.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Play only the visible slide; everything else stays paused + unbuffered.
  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const idx = Number((entry.target as HTMLElement).dataset.idx);
          const v = videoRefs.current[idx];
          if (!v) return;
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            setActive(idx);
            // Only the on-screen clip is allowed to buffer.
            v.preload = "auto";
            if (v.readyState < 3) setBuffering(true);
            v.play().catch(() => {});
            // Warm just the next clip's header so the swipe feels instant.
            const nxt = videoRefs.current[idx + 1];
            if (nxt && nxt.preload === "none") nxt.preload = "metadata";
          } else {
            v.pause();
          }
        });
      },
      { root, threshold: [0, 0.6, 1] },
    );
    root.querySelectorAll("[data-idx]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [slides.length]);


  useEffect(() => {
    videoRefs.current.forEach((v) => { if (v) v.muted = muted; });
  }, [muted]);

  const goNext = (idx: number) => {
    const root = scrollerRef.current;
    if (!root) return;
    const next = root.querySelector<HTMLElement>(`[data-idx="${idx + 1}"]`);
    if (next) next.scrollIntoView({ behavior: "smooth" });
  };

  const handleCta = (s: TrustSlide) => {
    if (s.href) {
      window.open(s.href, "_blank", "noopener,noreferrer");
      return;
    }
    onClose();
    if (s.to) navigate(s.to);
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black">
      {/* Top controls */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between p-3">
        <button
          onClick={onClose}
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-xl transition-transform active:scale-[0.92]"
          aria-label="Close video"
        >
          <X className="h-5 w-5" />
        </button>
        <button
          onClick={() => setMuted((m) => !m)}
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-xl transition-transform active:scale-[0.92]"
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
      </div>

      <div
        ref={scrollerRef}
        className="h-full w-full snap-y snap-mandatory overflow-y-auto overscroll-contain"
        style={{ scrollbarWidth: "none" }}
      >
        {slides.map((s, i) => (
          <section
            key={s.id}
            data-idx={i}
            className="relative flex h-full w-full snap-start items-center justify-center"
          >
            <video
              ref={(el) => { videoRefs.current[i] = el; }}
              src={s.videoUrl}
              poster={s.posterUrl || undefined}
              className="h-full w-full object-contain"
              playsInline
              muted
              loop
              // Only the visible clip buffers (the observer flips this to
              // "auto"). Everything else stays at zero bytes.
              preload={i === 0 ? "auto" : "none"}
              onWaiting={() => { if (i === active) setBuffering(true); }}
              onPlaying={() => { if (i === active) setBuffering(false); }}
              onCanPlay={() => { if (i === active) setBuffering(false); }}
              onError={() => { setFailed((f) => ({ ...f, [s.id]: true })); setBuffering(false); }}
              onClick={() => setMuted((m) => !m)}
            />

            {i === active && buffering && !failed[s.id] && (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="h-9 w-9 animate-spin rounded-full border-2 border-white/80 border-t-transparent" />
              </span>
            )}


            {failed[s.id] && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-8 text-center">
                <p className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white/80 backdrop-blur-xl">
                  This video could not be played.
                </p>
              </div>
            )}


            {/* Glassmorphic CTA — product-tagged slides get a shoppable card */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-4 pb-8">
              <div className="mx-auto flex max-w-sm flex-col gap-2">
                {s.featuredProducts && s.featuredProducts.length > 0 && (
                  <div className="pointer-events-auto grid grid-cols-2 gap-1.5">
                    {s.featuredProducts.map((p, pi) => (
                      <button
                        key={pi}
                        onClick={() => { onClose(); navigate(p.to); }}
                        className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 p-1.5 text-left shadow-[0_6px_24px_rgba(0,0,0,0.3)] backdrop-blur-2xl transition-transform active:scale-[0.97]"
                      >
                        <span className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-white/10 ring-1 ring-white/15">
                          {p.imageUrl && (
                            <img
                              src={optimizeImageUrl(p.imageUrl, 128, 128)}
                              alt=""
                              className="h-full w-full object-cover"
                              loading="lazy"
                              draggable={false}
                            />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[10.5px] font-semibold leading-tight text-white">
                            {p.name}
                          </span>
                          {(p.salePrice ?? p.price) != null && (
                            <span className="mt-0.5 block text-[10px] font-semibold text-white/85">
                              {formatPrice(Number(p.salePrice ?? p.price), p.currency || "INR")}
                            </span>
                          )}
                          <span className="mt-0.5 inline-flex items-center gap-0.5 text-[9px] font-medium text-white/60">
                            See details <ArrowRight className="h-2.5 w-2.5" />
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {s.product && (s.to || s.href) && (
                  <button
                    onClick={() => handleCta(s)}
                    className="pointer-events-auto flex w-full items-center gap-2.5 rounded-2xl border border-white/25 bg-white/15 p-2.5 text-left shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-2xl transition-transform active:scale-[0.98]"
                  >
                    <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-white/10 ring-1 ring-white/20">
                      {s.product.imageUrl && (
                        <img
                          src={optimizeImageUrl(s.product.imageUrl, 96, 80)}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                          draggable={false}
                        />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-white">
                        {s.product.name}
                      </span>
                      {(s.product.salePrice ?? s.product.price) != null && (
                        <span className="mt-0.5 block text-[12.5px] font-semibold text-white/95">
                          {formatPrice(
                            Number(s.product.salePrice ?? s.product.price),
                            s.product.currency || "INR",
                          )}
                          {s.product.salePrice != null &&
                            s.product.price != null &&
                            s.product.salePrice < s.product.price && (
                              <span className="ml-1.5 text-[10.5px] font-normal text-white/60 line-through">
                                {formatPrice(Number(s.product.price), s.product.currency || "INR")}
                              </span>
                            )}
                        </span>
                      )}
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white/95 px-2.5 py-1.5 text-[11.5px] font-semibold text-black">
                      See more details <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </button>
                )}
                {!s.product && s.ctaLabel && (s.to || s.href) && (
                  <button
                    onClick={() => handleCta(s)}
                    className={s.featuredProducts
                      ? "pointer-events-auto mx-auto inline-flex items-center gap-1.5 rounded-full bg-white/95 px-4 py-2 text-[12px] font-semibold text-black shadow-[0_4px_16px_rgba(0,0,0,0.3)] transition-transform active:scale-[0.95]"
                      : "pointer-events-auto flex w-full items-center justify-center gap-2 rounded-2xl border border-white/25 bg-white/15 px-5 py-3.5 text-[15px] font-semibold text-white shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-2xl transition-transform active:scale-[0.97]"}
                  >
                    {s.ctaLabel}
                    <ArrowRight className={s.featuredProducts ? "h-3.5 w-3.5" : "h-4 w-4"} />
                  </button>
                )}

                {i < slides.length - 1 && (
                  <button
                    onClick={() => goNext(i)}
                    className="pointer-events-auto mx-auto flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-medium text-white/80 backdrop-blur-xl"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                    Swipe up
                  </button>
                )}
              </div>
            </div>
          </section>
        ))}
      </div>

      {/* Progress dots */}
      {slides.length > 1 && (
        <div className="pointer-events-none absolute right-2 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-1.5">
          {slides.map((s, i) => (
            <span
              key={s.id}
              className={`h-1.5 w-1.5 rounded-full transition-all ${i === active ? "h-4 bg-white" : "bg-white/40"}`}
            />
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}
