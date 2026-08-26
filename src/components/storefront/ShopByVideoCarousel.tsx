/**
 * ShopByVideoCarousel — Shop by Video storefront section.
 *
 * Renders as an Instagram-Reels-style carousel right below Best Sellers on the
 * storefront home. Videos are tap-to-play so the section adds zero cold-load
 * video bytes; the carousel shell itself still auto-scrolls. Only shows when the
 * store owner has enabled the "shop-by-video" App Store add-on. Products
 * auto-qualify: any active product that has `video_url` set will appear.
 * Sequence is controlled from the dashboard config (`order` array).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { Volume2, VolumeX, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchStoreEnabledApps } from "@/hooks/useStoreEnabledApps";
import { storefrontPath, getSubdomainSlug } from "@/lib/subdomain";
import { cn } from "@/lib/utils";
import { optimizeImageUrl } from "@/lib/imageOptimize";
import VideoBufferDots from "./VideoBufferDots";


interface AppConfig {
  enabled?: boolean;
  title?: string;
  autoplay?: boolean;
  loop?: boolean;
  aspect_ratio?: "9:16" | "4:5";
  max_items?: number;
  show_price?: boolean;
  show_cta?: boolean;
  order?: string[];
}

interface Product {
  id: string;
  slug: string;
  name: string;
  price: number;
  sale_price: number | null;
  currency: string | null;
  image_url: string | null;
  video_url: string;
  video_poster_url: string | null;
}

interface Props {
  storeSlug?: string;
  storeId: string;
  /** Bypass RPC fetch — dashboard preview. */
  previewConfig?: AppConfig;
  /** Bypass product query — dashboard preview. */
  previewProducts?: Product[];
}

function formatMoney(amount: number, currency: string) {
  const sym = currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : "₹";
  return `${sym}${Math.round(amount).toLocaleString("en-IN")}`;
}

export default function ShopByVideoCarousel({ storeSlug: storeSlugProp, storeId, previewConfig, previewProducts }: Props) {
  // On subdomain / custom-domain hosts the storefront routes are mounted at "/",
  // so `useParams().slug` is undefined and callers used to pass `slug!` — that
  // made `fetchStoreEnabledApps(undefined)` short-circuit to [], the config
  // resolved to null and the whole section silently never rendered (the exact
  // "Shop by Video missing on live store" bug). Resolve the slug locally.
  const storeSlug = storeSlugProp || getSubdomainSlug() || "";
  const [config, setConfig] = useState<AppConfig | null | undefined>(
    previewConfig !== undefined ? { ...previewConfig } : undefined,
  );
  const [products, setProducts] = useState<Product[] | null>(previewProducts ?? null);

  // Fetch app config
  useEffect(() => {
    if (previewConfig !== undefined) { setConfig(previewConfig); return; }
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchStoreEnabledApps(storeSlug);
        if (cancelled) return;
        const row = Array.isArray(data) ? data.find((r: any) => r.app_id === "shop-by-video") : null;
        setConfig(row ? { ...(row.config || {}), enabled: true } : null);
      } catch {
        if (!cancelled) setConfig(null);
      }
    })();
    return () => { cancelled = true; };
  }, [storeSlug, previewConfig]);

  // Fetch products with video
  useEffect(() => {
    if (previewProducts) return;
    if (!config || !storeId) return;
    let cancelled = false;
    (async () => {
      const max = Math.max(2, Math.min(30, config.max_items ?? 10));
      const { data, error } = await supabase
        .from("products")
        .select("id,slug,name,price,sale_price,currency,image_url,video_url,video_poster_url")
        .eq("store_id", storeId)
        .eq("is_active", true)
        .not("video_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(max);
      if (error || cancelled) return;
      let list = (data as any[] as Product[]) || [];
      const orderIds = config.order || [];
      if (orderIds.length) {
        const idx = new Map(orderIds.map((id, i) => [id, i]));
        list = list.sort((a, b) => {
          const ai = idx.has(a.id) ? (idx.get(a.id) as number) : Number.MAX_SAFE_INTEGER;
          const bi = idx.has(b.id) ? (idx.get(b.id) as number) : Number.MAX_SAFE_INTEGER;
          return ai - bi;
        });
      }
      setProducts(list.slice(0, max));
    })();
    return () => { cancelled = true; };
  }, [config, storeId, previewProducts]);

  if (!config || config.enabled === false) return null;
  if (!products) return null;
  if (products.length < 2) return null;

  return (
    <ShopByVideoInner
      title={config.title || "Shop by Video"}
      autoplay={config.autoplay !== false}
      loop={config.loop !== false}
      aspect={config.aspect_ratio || "9:16"}
      showPrice={config.show_price !== false}
      showCta={config.show_cta !== false}
      products={products}
      storeSlug={storeSlug}
    />
  );
}

interface InnerProps {
  title: string;
  autoplay: boolean;
  loop: boolean;
  aspect: "9:16" | "4:5";
  showPrice: boolean;
  showCta: boolean;
  products: Product[];
  storeSlug: string;
}

function ShopByVideoInner({ title, autoplay, loop, aspect, showPrice, showCta, products, storeSlug }: InnerProps) {
  const plugins = useMemo(
    () => (autoplay ? [Autoplay({ delay: 5000, stopOnInteraction: true, stopOnMouseEnter: true })] : []),
    [autoplay],
  );
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { align: "start", loop: loop && products.length > 3, dragFree: false, containScroll: "trimSnaps" },
    plugins,
  );
  const [selected, setSelected] = useState(0);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelected(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi]);

  const aspectClass = aspect === "9:16" ? "aspect-[9/16]" : "aspect-[4/5]";

  return (
    <section aria-label={title}>
      <div className="mb-4 flex items-center justify-between px-1">
        <h2
          className="text-lg sm:text-xl font-bold inline-flex items-center gap-2"
          style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}
        >
          <span aria-hidden>🎬</span> {title}
        </h2>
        <div className="hidden md:flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => emblaApi?.scrollPrev()}
            aria-label="Previous"
            className="h-9 w-9 rounded-full inline-flex items-center justify-center border border-border/60 bg-card hover:bg-accent transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => emblaApi?.scrollNext()}
            aria-label="Next"
            className="h-9 w-9 rounded-full inline-flex items-center justify-center border border-border/60 bg-card hover:bg-accent transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex -ml-3">
          {products.map((p, i) => (
            <div
              key={p.id}
              className="pl-3 shrink-0 basis-[62%] xs:basis-[52%] sm:basis-1/3 md:basis-1/4 lg:basis-1/5"
            >
              <VideoTile
                product={p}
                slug={storeSlug}
                active={i === selected}
                muted={muted}
                onToggleMute={() => setMuted((m) => !m)}
                aspectClass={aspectClass}
                showPrice={showPrice}
                showCta={showCta}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-center gap-1.5">
        {products.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Go to video ${i + 1}`}
            onClick={() => emblaApi?.scrollTo(i)}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === selected ? "w-5 bg-foreground" : "w-1.5 bg-foreground/25",
            )}
          />
        ))}
      </div>
    </section>
  );
}

interface TileProps {
  product: Product;
  slug: string;
  active: boolean;
  muted: boolean;
  onToggleMute: () => void;
  aspectClass: string;
  showPrice: boolean;
  showCta: boolean;
}

function VideoTile({ product, slug, active, muted, onToggleMute, aspectClass, showPrice, showCta }: TileProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [inView, setInView] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setInView(entry.intersectionRatio > 0.5),
      { threshold: [0, 0.5, 1] },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (active && inView) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [active, inView]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = muted;
  }, [muted]);

  const currency = product.currency || "INR";
  const displayPrice = product.sale_price ?? product.price;
  const hasSale = product.sale_price != null && product.sale_price < product.price;
  const productHref = storefrontPath(slug, `product/${product.slug}`);

  return (
    <div ref={containerRef} className="group relative overflow-hidden rounded-2xl bg-black">
      <Link to={productHref} aria-label={product.name} className="block">
        <div className={cn("relative w-full", aspectClass)}>
          {product.video_poster_url && (
            <img
              src={optimizeImageUrl(product.video_poster_url, 400, 80)}
              alt=""
              aria-hidden
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
              draggable={false}
            />
          )}
          <video
            ref={videoRef}
            src={product.video_url}
            poster={optimizeImageUrl(product.video_poster_url, 400, 80) || undefined}
            className="relative z-[1] h-full w-full object-cover"
            muted
            playsInline
            loop
            preload="none"
            disablePictureInPicture
          />

          <div className="absolute inset-x-0 bottom-0 z-10 pointer-events-none bg-gradient-to-t from-black/85 via-black/40 to-transparent pt-10 pb-3 px-3">
            <div className="flex items-end gap-2.5 pointer-events-auto">
              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-white/10 ring-1 ring-white/20">
                {product.image_url ? (
                  <img
                    src={optimizeImageUrl(product.image_url, 96, 80)}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                    draggable={false}
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-semibold text-white leading-tight line-clamp-2 [text-shadow:0_1px_2px_rgba(0,0,0,.6)]">
                  {product.name}
                </p>
                {showPrice && (
                  <p className="mt-0.5 text-[12px] font-semibold text-white/95 leading-tight [text-shadow:0_1px_2px_rgba(0,0,0,.6)]">
                    {formatMoney(displayPrice, currency)}
                    {hasSale && (
                      <span className="ml-1.5 text-[10.5px] font-normal text-white/60 line-through">
                        {formatMoney(product.price, currency)}
                      </span>
                    )}
                  </p>
                )}
              </div>
            </div>
            {showCta && (
              <div className="mt-2.5 pointer-events-auto">
                <span className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-white/95 px-3 py-1.5 text-[12px] font-semibold text-black transition-colors hover:bg-white">
                  See details <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            )}
          </div>
        </div>
      </Link>

      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleMute(); }}
        aria-label={muted ? "Unmute" : "Mute"}
        className="absolute top-2 right-2 z-20 h-8 w-8 inline-flex items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm ring-1 ring-white/20 hover:bg-black/70 transition-colors"
      >
        {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
