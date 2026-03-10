import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link, useOutletContext, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Package, ChevronLeft, ChevronRight, Tag, ShoppingBag, ShoppingCart, Share2, Copy, Facebook, Twitter, X, ZoomIn } from "lucide-react";
import { toast } from "sonner";
import { useMetaTags } from "@/hooks/useMetaTags";
import { useProductJsonLd } from "@/hooks/useJsonLd";
import { useCart } from "@/contexts/CartContext";
import type { StoreData } from "@/layouts/StorefrontLayout";
import { storefrontPath } from "@/lib/subdomain";
import StorefrontProductCard from "@/components/storefront/StorefrontProductCard";
import type { Tables } from "@/integrations/supabase/types";
import { fbPixelTrack } from "@/hooks/useFacebookPixel";

interface Variant {
  id: string;
  name: string;
  price: number | null;
  stock_quantity: number;
  sku: string | null;
}

export default function ProductDetail() {
  const store = useOutletContext<StoreData>();
  const { productSlug } = useParams<{ productSlug: string }>();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const queryClient = useQueryClient();

  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);

  // Try to get product instantly from cached storefront data
  const getCachedProduct = () => {
    const cached = queryClient.getQueryData<any[]>(["storefront-products", store.id]);
    if (!cached) return undefined;
    return cached.find(
      (p: any) => p.slug === productSlug || p.id === productSlug
    ) || undefined;
  };

  const { data: product, isLoading } = useQuery({
    queryKey: ["storefront-product", store.id, productSlug],
    queryFn: async () => {
      let { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("store_id", store.id)
        .eq("slug", productSlug!)
        .eq("is_active", true)
        .maybeSingle();

      if (!data && !error) {
        const result = await supabase
          .from("products")
          .select("*")
          .eq("store_id", store.id)
          .eq("id", productSlug!)
          .eq("is_active", true)
          .maybeSingle();
        data = result.data;
        error = result.error;
      }

      if (error) throw error;
      return data;
    },
    initialData: getCachedProduct,
    enabled: !!store.id && !!productSlug,
    staleTime: 2 * 60 * 1000,
  });

  const productId = product?.id;

  const { data: extraImages } = useQuery({
    queryKey: ["product-images", productId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("product_images")
        .select("*")
        .eq("product_id", productId!)
        .order("display_order");
      if (error) throw error;
      return data as { id: string; image_url: string; display_order: number }[];
    },
    enabled: !!productId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: variants } = useQuery({
    queryKey: ["product-variants", productId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("product_variants")
        .select("*")
        .eq("product_id", productId!)
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data as Variant[];
    },
    enabled: !!productId,
    staleTime: 5 * 60 * 1000,
  });

  useMetaTags({
    title: product ? `${product.name} — ${store.name}` : undefined,
    description: product?.description || undefined,
    ogImage: product?.image_url || undefined,
    storeSlug: store.slug,
    canonicalPath: product ? `product/${product.slug || product.id}` : undefined,
  });

  // Facebook Pixel: ViewContent
  useEffect(() => {
    if (!product) return;
    fbPixelTrack("ViewContent", {
      content_name: product.name,
      content_ids: [product.id],
      content_type: "product",
      value: product.sale_price && product.sale_price < product.price ? product.sale_price : product.price,
      currency: product.currency || store.currency || "INR",
    });
  }, [product?.id]);

  useProductJsonLd({
    product: product ? {
      name: product.name,
      description: product.description,
      image_url: product.image_url,
      price: Number(product.price),
      sale_price: product.sale_price ? Number(product.sale_price) : null,
      currency: product.currency || store.currency || "INR",
      slug: product.slug,
      id: product.id,
      category: product.category,
      stock_quantity: product.stock_quantity,
      sku: product.sku,
    } : { name: "", price: 0, id: "", currency: "INR" },
    storeSlug: store.slug,
    storeName: store.name,
  });

  const allImages = (() => {
    const imgs: string[] = [];
    if (product?.image_url) imgs.push(product.image_url);
    if (extraImages) imgs.push(...extraImages.map((i) => i.image_url));
    return imgs;
  })();

  if (isLoading) {
    return <ProductDetailSkeleton />;
  }

  if (!product) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16">
        <div className="flex flex-col items-center gap-4 text-center">
          <Package className="h-12 w-12 text-muted-foreground" />
          <h1 className="text-2xl font-semibold text-foreground">Product not found</h1>
          <p className="text-muted-foreground">This product doesn't exist or is no longer available.</p>
          <Button asChild variant="outline">
            <Link to={storefrontPath(store.slug)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to store
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const hasDiscount = product.sale_price && product.sale_price < product.price;
  const discountPct = hasDiscount
    ? Math.round(((product.price - product.sale_price!) / product.price) * 100)
    : 0;
  const currency = product.currency || "USD";
  const basePrice = hasDiscount ? product.sale_price! : product.price;
  const variantPrice = selectedVariant?.price ?? basePrice;
  const orderMode = (store as any).order_mode || "whatsapp";
  const showWhatsApp = orderMode === "whatsapp" || orderMode === "both";
  const showBuyNow = orderMode === "website" || orderMode === "both";

  const handleAddToCart = () => {
    addToCart({
      productId: product.id,
      variantId: selectedVariant?.id,
      name: product.name,
      variantName: selectedVariant?.name,
      price: variantPrice,
      image: product.image_url || undefined,
    });
    toast.success(`${product.name} added to cart`);
  };

  const handleBuyNow = () => {
    const params = new URLSearchParams({ product: product.id });
    if (selectedVariant) params.set("variant", selectedVariant.id);
    navigate(storefrontPath(store.slug, `checkout?${params.toString()}`));
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <Link
          to={storefrontPath(store.slug)}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to {store.name}
        </Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <ImageGallery images={allImages} productName={product.name} />

        <div className="flex flex-col">
          {product.category && (
            <Badge variant="secondary" className="mb-3 w-fit text-xs uppercase tracking-wide">
              {product.category}
            </Badge>
          )}

          <h1 className="text-3xl font-bold text-foreground">{product.name}</h1>

          <div className="mt-4 flex items-baseline gap-3">
            {hasDiscount ? (
              <>
                <span className="text-3xl font-bold text-foreground">
                  {currency} {Number(product.sale_price).toFixed(2)}
                </span>
                <span className="text-lg text-muted-foreground line-through">
                  {currency} {Number(product.price).toFixed(2)}
                </span>
                <Badge variant="destructive" className="text-xs">
                  -{discountPct}%
                </Badge>
              </>
            ) : (
              <span className="text-3xl font-bold text-foreground">
                {currency} {Number(product.price).toFixed(2)}
              </span>
            )}
          </div>

          <p className="mt-3 text-sm text-muted-foreground">
            {product.stock_quantity > 0
              ? `${product.stock_quantity} in stock`
              : "Out of stock"}
          </p>

          {product.description && (
            <div className="mt-6">
              <h2 className="mb-2 text-sm font-semibold text-foreground uppercase tracking-wide">Description</h2>
              <p className="leading-relaxed text-muted-foreground whitespace-pre-line">
                {product.description}
              </p>
            </div>
          )}

          {/* Shared variant selector */}
          {(variants || []).length > 0 && (
            <div className="mt-6 space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide">Variant</Label>
              <div className="flex flex-wrap gap-2">
                {(variants || []).map((v) => (
                  <Button
                    key={v.id}
                    type="button"
                    variant={selectedVariant?.id === v.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedVariant(selectedVariant?.id === v.id ? null : v)}
                    disabled={v.stock_quantity <= 0}
                  >
                    {v.name}
                    {v.price !== null && v.price !== basePrice && (
                      <span className="ml-1 text-xs opacity-70">
                        ({currency} {Number(v.price).toFixed(2)})
                      </span>
                    )}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              className="btn-gold inline-flex items-center justify-center gap-2 rounded-md px-6 py-3 text-sm font-extrabold uppercase tracking-widest"
              onClick={handleAddToCart}
            >
              <ShoppingCart className="h-5 w-5" />
              Add to Cart
            </button>

            {showBuyNow && (
              <button
                className="btn-gold inline-flex items-center justify-center gap-2 rounded-md px-6 py-3 text-sm font-extrabold uppercase tracking-widest"
                onClick={handleBuyNow}
              >
                <ShoppingBag className="h-5 w-5" />
                Buy Now — {currency} {Number(variantPrice).toFixed(2)}
              </button>
            )}

            {showWhatsApp && store.whatsapp_number && (
              <button
                className="inline-flex items-center justify-center gap-2 rounded-md bg-[#25D366] px-6 py-3 text-sm font-extrabold uppercase tracking-widest text-white transition-all hover:bg-[#1ebe5d] active:scale-[0.98]"
                onClick={() => {
                  const phone = store.whatsapp_number!.replace(/[^0-9+]/g, "");
                  const variantInfo = selectedVariant ? ` (${selectedVariant.name})` : "";
                  const productUrl = `${window.location.origin}${window.location.pathname}`;
                  const text = `Hi ${store.name}! 👋\n\nI want to buy *${product.name}${variantInfo}*\n\n💰 Price: ${currency} ${Number(variantPrice).toFixed(0)}\n\n🔗 ${productUrl}\n\nPlease share availability, delivery time & payment options.`;
                  window.open(`https://wa.me/${encodeURIComponent(phone)}?text=${encodeURIComponent(text)}`, "_blank");
                }}
              >
                <svg viewBox="0 0 32 32" fill="white" className="h-5 w-5"><path d="M16.004 3.2C9.056 3.2 3.406 8.848 3.404 15.8c-.001 2.222.58 4.392 1.683 6.303L3.2 28.8l6.867-1.802A12.56 12.56 0 0 0 16 28.398h.005C22.95 28.398 28.6 22.75 28.6 15.8 28.6 8.85 22.95 3.2 16.004 3.2Zm0 22.997h-.004a10.44 10.44 0 0 1-5.318-1.457l-.382-.226-3.955 1.038 1.055-3.858-.249-.395A10.42 10.42 0 0 1 5.54 15.8c.002-5.77 4.697-10.463 10.466-10.463 5.77 0 10.463 4.695 10.463 10.464 0 5.77-4.695 10.465-10.465 10.465v-.069Zm5.74-7.835c-.315-.158-1.863-.92-2.152-1.025-.289-.105-.499-.158-.71.158-.21.315-.815 1.025-.999 1.236-.184.21-.368.236-.683.079-.315-.158-1.33-.49-2.533-1.562-.937-.835-1.568-1.867-1.752-2.182-.184-.315-.02-.486.138-.643.142-.141.315-.368.473-.552.158-.184.21-.315.315-.526.106-.21.053-.394-.026-.552-.079-.158-.71-1.71-.973-2.341-.256-.615-.517-.532-.71-.542-.184-.008-.394-.01-.604-.01s-.552.079-.841.394c-.29.315-1.104 1.078-1.104 2.63 0 1.552 1.13 3.052 1.288 3.262.158.21 2.224 3.396 5.388 4.762.753.326 1.341.52 1.8.665.756.24 1.444.206 1.988.125.607-.09 1.863-.762 2.126-1.498.263-.736.263-1.367.184-1.498-.079-.132-.289-.21-.604-.369Z"/></svg>
                Order on WhatsApp
              </button>
            )}
          </div>

          {/* Share Buttons */}
          <ShareButtons productName={product.name} />
        </div>
      </div>

      {/* Related Products */}
      <RelatedProducts
        storeId={store.id}
        storeSlug={store.slug}
        currentProductId={product.id}
        currentCategory={product.category}
        store={store}
      />
    </div>
  );
}

/* ── Share Buttons ── */
function ShareButtons({ productName }: { productName: string }) {
  const url = window.location.href;
  const text = `Check out ${productName}!`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied!");
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <div className="mt-6 flex items-center gap-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Share</span>
      <Button variant="outline" size="icon" className="h-8 w-8" onClick={copyLink} title="Copy link">
        <Copy className="h-3.5 w-3.5" />
      </Button>
      <Button variant="outline" size="icon" className="h-8 w-8" asChild title="Share on WhatsApp">
        <a href={`https://wa.me/?text=${encodeURIComponent(text + " " + url)}`} target="_blank" rel="noopener noreferrer">
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 0 1-4.243-1.213l-.304-.181-2.868.852.852-2.868-.181-.304A8 8 0 1 1 12 20z"/></svg>
        </a>
      </Button>
      <Button variant="outline" size="icon" className="h-8 w-8" asChild title="Share on Facebook">
        <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">
          <Facebook className="h-3.5 w-3.5" />
        </a>
      </Button>
      <Button variant="outline" size="icon" className="h-8 w-8" asChild title="Share on X">
        <a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">
          <Twitter className="h-3.5 w-3.5" />
        </a>
      </Button>
    </div>
  );
}

/* ── Image Gallery with Fullscreen Lightbox (Shopify-style) ── */
function ImageGallery({ images, productName }: { images: string[]; productName: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (images.length === 0) {
    return (
      <div className="overflow-hidden rounded-2xl bg-accent">
        <div className="flex aspect-square w-full items-center justify-center">
          <Package className="h-16 w-16 text-muted-foreground/30" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {/* Main image — tap to open lightbox */}
        <div
          className="relative overflow-hidden rounded-2xl bg-accent cursor-zoom-in select-none"
          onClick={() => setLightboxOpen(true)}
        >
          <img
            src={images[activeIndex]}
            alt={productName}
            className="aspect-square w-full object-cover"
            decoding="async"
            fetchPriority="high"
            draggable={false}
          />
          {/* Zoom hint */}
          <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-background/80 px-2.5 py-1 text-[10px] font-semibold text-foreground shadow backdrop-blur-sm">
            <ZoomIn className="h-3.5 w-3.5" /> Tap to zoom
          </div>
          {images.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveIndex((i) => (i - 1 + images.length) % images.length); }}
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-1.5 shadow backdrop-blur-sm hover:bg-background"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveIndex((i) => (i + 1) % images.length); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-1.5 shadow backdrop-blur-sm hover:bg-background"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto">
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => setActiveIndex(i)}
                className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                  i === activeIndex ? "border-primary" : "border-transparent"
                }`}
              >
                <img src={img} alt="" className="h-full w-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Fullscreen Lightbox */}
      {lightboxOpen && (
        <FullscreenLightbox
          images={images}
          productName={productName}
          initialIndex={activeIndex}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  );
}

/* ── Fullscreen Lightbox with Pinch-to-Zoom ── */
function FullscreenLightbox({
  images,
  productName,
  initialIndex,
  onClose,
}: {
  images: string[];
  productName: string;
  initialIndex: number;
  onClose: () => void;
}) {
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const lastDistance = useRef<number | null>(null);
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const resetZoom = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  useEffect(() => { resetZoom(); }, [activeIndex, resetZoom]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const getDistance = (t1: React.Touch, t2: React.Touch) =>
    Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      lastDistance.current = getDistance(e.touches[0], e.touches[1]);
    } else if (e.touches.length === 1 && scale > 1) {
      isDragging.current = true;
      lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastDistance.current !== null) {
      e.preventDefault();
      const dist = getDistance(e.touches[0], e.touches[1]);
      const newScale = Math.min(5, Math.max(1, scale * (dist / lastDistance.current)));
      setScale(newScale);
      lastDistance.current = dist;
      if (newScale <= 1) setTranslate({ x: 0, y: 0 });
    } else if (e.touches.length === 1 && isDragging.current && scale > 1) {
      e.preventDefault();
      const dx = e.touches[0].clientX - lastPos.current.x;
      const dy = e.touches[0].clientY - lastPos.current.y;
      setTranslate(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const handleTouchEnd = () => {
    lastDistance.current = null;
    isDragging.current = false;
    if (scale <= 1) resetZoom();
  };

  // Desktop: double-click to zoom
  const handleDoubleClick = (e: React.MouseEvent) => {
    if (scale > 1) {
      resetZoom();
    } else {
      setScale(2.5);
      setTranslate({ x: 0, y: 0 });
    }
  };

  // Swipe to change image (when not zoomed)
  const swipeStart = useRef<number | null>(null);
  const handleSwipeStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && scale <= 1) {
      swipeStart.current = e.touches[0].clientX;
    }
  };
  const handleSwipeEnd = (e: React.TouchEvent) => {
    if (swipeStart.current !== null && scale <= 1 && e.changedTouches.length === 1) {
      const diff = e.changedTouches[0].clientX - swipeStart.current;
      if (Math.abs(diff) > 60) {
        if (diff < 0 && activeIndex < images.length - 1) setActiveIndex(i => i + 1);
        if (diff > 0 && activeIndex > 0) setActiveIndex(i => i - 1);
      }
      swipeStart.current = null;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/95 animate-in fade-in duration-200">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="text-sm font-medium opacity-80">
          {images.length > 1 ? `${activeIndex + 1} / ${images.length}` : productName}
        </span>
        <button
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm shadow transition-all hover:scale-110 active:scale-95"
        >
          <X className="h-5 w-5 text-white" strokeWidth={2.5} />
        </button>
      </div>

      {/* Image area */}
      <div
        className="flex flex-1 items-center justify-center overflow-hidden touch-none select-none"
        onTouchStart={(e) => { handleTouchStart(e); handleSwipeStart(e); }}
        onTouchMove={handleTouchMove}
        onTouchEnd={(e) => { handleTouchEnd(); handleSwipeEnd(e); }}
        onDoubleClick={handleDoubleClick}
        style={{ cursor: scale > 1 ? "grab" : "default" }}
      >
        <img
          src={images[activeIndex]}
          alt={productName}
          className="max-h-full max-w-full object-contain transition-transform duration-100"
          style={{ transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})` }}
          draggable={false}
        />
      </div>

      {/* Desktop arrows */}
      {images.length > 1 && scale <= 1 && (
        <>
          <button
            onClick={() => setActiveIndex((i) => (i - 1 + images.length) % images.length)}
            className="absolute left-3 top-1/2 -translate-y-1/2 hidden sm:flex h-10 w-10 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm text-white hover:bg-white/25 transition-all"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => setActiveIndex((i) => (i + 1) % images.length)}
            className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex h-10 w-10 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm text-white hover:bg-white/25 transition-all"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="flex justify-center gap-2 px-4 py-3 overflow-x-auto">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => { setActiveIndex(i); resetZoom(); }}
              className={`h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                i === activeIndex ? "border-white opacity-100" : "border-transparent opacity-50 hover:opacity-80"
              }`}
            >
              <img src={img} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}



/* ── Related Products ── */
function RelatedProducts({
  storeId,
  storeSlug,
  currentProductId,
  currentCategory,
  store,
}: {
  storeId: string;
  storeSlug: string;
  currentProductId: string;
  currentCategory: string | null;
  store: Tables<"stores">;
}) {
  const { data: related } = useQuery({
    queryKey: ["related-products", storeId, currentProductId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("store_id", storeId)
        .eq("is_active", true)
        .neq("id", currentProductId)
        .limit(8);
      if (error) throw error;

      // Prioritize same category
      if (currentCategory && data.length > 4) {
        const sameCategory = data.filter((p) => p.category === currentCategory);
        const otherCategory = data.filter((p) => p.category !== currentCategory);
        return [...sameCategory, ...otherCategory].slice(0, 4);
      }
      return data.slice(0, 4);
    },
    enabled: !!storeId && !!currentProductId,
    staleTime: 5 * 60 * 1000,
  });

  if (!related || related.length === 0) return null;

  return (
    <section className="mt-12 pt-8 border-t border-border">
      <h2 className="mb-5 text-xl font-bold text-foreground">You May Also Like</h2>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
        {related.map((product) => (
          <StorefrontProductCard
            key={product.id}
            product={product}
            slug={storeSlug}
            store={store}
          />
        ))}
      </div>
    </section>
  );
}

/* ── Product Detail Skeleton ── */
function ProductDetailSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Skeleton className="mb-6 h-4 w-32" />
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Image skeleton */}
        <div className="space-y-3">
          <Skeleton className="aspect-square w-full rounded-2xl" />
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-16 rounded-lg" />
            ))}
          </div>
        </div>
        {/* Details skeleton */}
        <div className="flex flex-col gap-4">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-24" />
          <div className="mt-4 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
          <div className="mt-6 flex gap-3">
            <Skeleton className="h-12 w-40 rounded-md" />
            <Skeleton className="h-12 w-52 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}
