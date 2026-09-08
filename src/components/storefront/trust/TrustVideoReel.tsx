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
import { waPhoneNumber, type TrustSlide } from "@/lib/trustVideos";
import { formatPrice } from "@/lib/productUtils";
import { optimizeImageUrl } from "@/lib/imageOptimize";

interface Props {
  slides: TrustSlide[];
  onClose: () => void;
  storeName: string;
  whatsappNumber?: string | null;
}


export default function TrustVideoReel({ slides, onClose, storeName, whatsappNumber }: Props) {
  const navigate = useNavigate();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const [buffering, setBuffering] = useState(true);

  const [muted, setMuted] = useState(false);

  const waPhone = waPhoneNumber(whatsappNumber);
  const waMessage = encodeURIComponent(
    `Hi ${storeName}! 👋\nI'm interested in buying products from your store. Could you help me?`
  );



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
  // Sound is ON by default; if the browser blocks unmuted autoplay, we fall
  // back to muted playback so the reel still starts immediately.
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
            const attempt = v.play();
            if (attempt && typeof attempt.catch === "function") {
              attempt.catch(() => {
                v.muted = true;
                setMuted(true);
                v.play().catch(() => {});
              });
            }
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
        <div className="pointer-events-auto flex items-center gap-2">
          {waPhone && (
            <a
              href={`https://wa.me/${waPhone}?text=${waMessage}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Chat on WhatsApp"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-[#25D366] text-white shadow-lg shadow-[#25D366]/30 backdrop-blur-xl transition-transform hover:scale-105 active:scale-[0.92]"
            >
              <svg viewBox="0 0 32 32" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                <path d="M16.004 3.2C9.056 3.2 3.406 8.848 3.404 15.8c-.001 2.222.58 4.392 1.683 6.303L3.2 28.8l6.867-1.802A12.56 12.56 0 0 0 16 28.398h.005C22.95 28.398 28.6 22.75 28.6 15.8 28.6 8.85 22.95 3.2 16.004 3.2Zm0 22.997h-.004a10.44 10.44 0 0 1-5.318-1.457l-.382-.226-3.955 1.038 1.055-3.858-.249-.395A10.42 10.42 0 0 1 5.54 15.8c.002-5.77 4.697-10.463 10.466-10.463 5.77 0 10.463 4.695 10.463 10.464 0 5.77-4.695 10.465-10.465 10.465v-.069Zm5.74-7.835c-.315-.158-1.863-.92-2.152-1.025-.289-.105-.499-.158-.71.158-.21.315-.815 1.025-.999 1.236-.184.21-.368.236-.683.079-.315-.158-1.33-.49-2.533-1.562-.937-.835-1.568-1.867-1.752-2.182-.184-.315-.02-.486.138-.643.142-.141.315-.368.473-.552.158-.184.21-.315.315-.526.106-.21.053-.394-.026-.552-.079-.158-.71-1.71-.973-2.341-.256-.615-.517-.532-.71-.542-.184-.008-.394-.01-.604-.01s-.552.079-.841.394c-.29.315-1.104 1.078-1.104 2.63 0 1.552 1.13 3.052 1.288 3.262.158.21 2.224 3.396 5.388 4.762.753.326 1.341.52 1.8.665.756.24 1.444.206 1.988.125.607-.09 1.863-.762 2.126-1.498.263-.736.263-1.367.184-1.498-.079-.132-.289-.21-.604-.369Z" />
              </svg>
            </a>
          )}
          <button
            onClick={() => setMuted((m) => !m)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-xl transition-transform active:scale-[0.92]"
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
        </div>
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
              muted={muted}
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
