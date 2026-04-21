/**
 * Theme 19 — Blinkit-style product detail page.
 * Sticky header + back, swipeable gallery with thumbnails, delivery pill,
 * title/price/MRP/%off, variant chips, "Why shop from us" trust strip,
 * Highlights accordion, similar products carousel, sticky bottom ADD bar.
 */
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, Search, ShoppingCart, Clock, ChevronDown, ChevronUp,
  Zap, IndianRupee, Package, Plus, Minus, Share2, Star,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { useMetaTags } from "@/hooks/useMetaTags";
import { storefrontPath } from "@/lib/subdomain";
import { optimizeImageUrl, resolveProductImages } from "@/lib/imageOptimize";
import { getDiscountPercent } from "@/lib/productUtils";
import V19ProductCard from "@/components/storefront/v19/V19ProductCard";
import { useRecentlyViewed } from "@/hooks/useRecentlyViewed";
import type { StoreData } from "@/layouts/StorefrontLayout";
import { ZoomHint } from "@/components/storefront/ZoomableGallery";
import {
  DeliveryEtaPill, CouponTeaser, TopReviewsStrip, BundleCard, StockUrgencyStrip, StickyAddInfo,
} from "@/components/storefront/PdpEnhancements";

const ZoomableGallery = lazy(() => import("@/components/storefront/ZoomableGallery"));

const SEARCH_TERMS = ['"milk"', '"bread"', '"eggs"', '"atta"', '"chips"', '"chocolate"'];

interface Variant {
  id: string;
  name: string;
  price: number | null;
  stock_quantity: number;
}

export default function V19ProductDetail() {
  const { productSlug } = useParams<{ productSlug: string }>();
  const store = useOutletContext<StoreData>();
  const navigate = useNavigate();
  const slug = store?.slug || "";
  const { addToCart, items, updateQuantity } = useCart();
  const totalItems = items.reduce((sum, i) => sum + (i.quantity || 0), 0);
  const { track } = useRecentlyViewed(store?.id);

  const [galleryIdx, setGalleryIdx] = useState(0);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [highlightsOpen, setHighlightsOpen] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [termIdx, setTermIdx] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const galleryRef = useRef<HTMLDivElement>(null);

  // Rotating search placeholder (matches V19Header)
  useEffect(() => {
    const id = setInterval(() => setTermIdx((i) => (i + 1) % SEARCH_TERMS.length), 2200);
    return () => clearInterval(id);
  }, []);

  // Fetch product
  const { data: product, isLoading } = useQuery({
    queryKey: ["v19-product", store?.id, productSlug],
    enabled: !!store?.id && !!productSlug,
    queryFn: async () => {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productSlug || "");
      let query = supabase
        .from("products")
        .select(`*,
          product_images(id, image_url, display_order),
          product_variants(id, name, price, stock_quantity, display_order, is_active)
        `)
        .eq("store_id", store!.id)
        .eq("is_active", true);
      query = isUuid
        ? query.eq("id", productSlug!)
        : query.eq("slug", productSlug!);
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch similar products (co-purchased fallback to category)
  const { data: similarProducts = [] } = useQuery({
    queryKey: ["v19-similar", product?.id],
    enabled: !!product?.id && !!store?.id,
    queryFn: async () => {
      const { data: coIds } = await supabase.rpc("get_co_purchased_products", {
        _product_id: product!.id,
        _limit: 8,
      });
      let ids: string[] = (coIds as any)?.map?.((r: any) => r.get_co_purchased_products || r) || [];
      ids = ids.filter(Boolean);

      if (ids.length < 4 && product?.category) {
        const { data: catData } = await supabase
          .from("products")
          .select("id, name, slug, price, sale_price, image_url, store_id, currency, is_active, stock_quantity")
          .eq("store_id", store!.id)
          .eq("category", product.category)
          .eq("is_active", true)
          .neq("id", product!.id)
          .limit(8);
        return (catData || []).slice(0, 8);
      }

      if (ids.length === 0) return [];
      const { data: byIds } = await supabase
        .from("products")
        .select("id, name, slug, price, sale_price, image_url, store_id, currency, is_active, stock_quantity")
        .in("id", ids)
        .eq("is_active", true);
      return byIds || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch product reviews
  const { data: reviews = [] } = useQuery({
    queryKey: ["v19-reviews", product?.id],
    enabled: !!product?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("product_reviews")
        .select("id, customer_name, rating, review_text, created_at")
        .eq("product_id", product!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const avgRating = reviews.length
    ? reviews.reduce((s, r: any) => s + (r.rating || 0), 0) / reviews.length
    : 0;
  useMetaTags({
    title: product ? `${product.name} — ${store?.name}` : undefined,
    description: product?.description || undefined,
    ogImage: product?.image_url || undefined,
    storeSlug: store?.slug,
    customDomain: (store as any)?.custom_domain,
  });

  const images = useMemo(() => (product ? resolveProductImages(product) : []), [product]);

  // Track recently viewed (only after product loads)
  useEffect(() => {
    if (!product) return;
    track({
      id: product.id,
      name: product.name,
      slug: product.slug,
      image_url: product.image_url,
      price: Number(product.price),
      sale_price: product.sale_price ? Number(product.sale_price) : null,
      currency: product.currency,
    });
  }, [product, track]);

  const activeVariant: Variant | null = useMemo(() => {
    if (!product || !selectedVariantId) return null;
    return (product.product_variants || []).find((v: any) => v.id === selectedVariantId) || null;
  }, [product, selectedVariantId]);

  const basePrice = Number(product?.price || 0);
  const salePrice = product?.sale_price ? Number(product.sale_price) : null;
  const variantPrice = activeVariant?.price ? Number(activeVariant.price) : null;
  const effectivePrice = variantPrice ?? (salePrice && salePrice < basePrice ? salePrice : basePrice);
  const showStrike = (salePrice && salePrice < basePrice) || variantPrice;
  const mrpToShow = basePrice;
  const discountPct = product ? getDiscountPercent(basePrice, effectivePrice < basePrice ? effectivePrice : null) : null;

  const cartItem = items.find(
    (i) => i.productId === product?.id && (selectedVariantId ? i.variantId === selectedVariantId : !i.variantId)
  );
  const cartQty = cartItem?.quantity || 0;

  const handleAdd = () => {
    if (!product) return;
    addToCart({
      productId: product.id,
      variantId: selectedVariantId || undefined,
      variantName: activeVariant?.name,
      name: product.name,
      price: effectivePrice,
      image: images[0] || product.image_url || undefined,
      quantity: 1,
    }, { silent: true });
  };

  const handleShare = async () => {
    if (!product) return;
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: product.name, text: product.name, url });
      } catch { /* user cancelled */ }
    } else {
      navigator.clipboard?.writeText(url);
    }
  };

  // Snap gallery scroll → update active index
  const onGalleryScroll = () => {
    const el = galleryRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    if (idx !== galleryIdx) setGalleryIdx(idx);
  };
  const scrollToImage = (i: number) => {
    const el = galleryRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  if (isLoading) {
    return (
      <div className="bg-white min-h-screen pb-32">
        <div className="h-12" style={{ background: "var(--storefront-primary, #036B52)" }} />
        <div className="aspect-square bg-gray-100 animate-pulse" />
        <div className="p-4 space-y-3">
          <div className="h-5 w-3/4 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-1/2 bg-gray-200 rounded animate-pulse" />
          <div className="h-7 w-1/3 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <Package className="h-12 w-12 text-gray-300 mb-3" />
        <h2 className="text-lg font-bold text-gray-900">Product not found</h2>
        <p className="text-sm text-gray-500 mt-1">This item may have been removed.</p>
        <Link
          to={storefrontPath(slug, "shop")}
          className="mt-4 px-5 py-2.5 rounded-lg text-white text-sm font-bold"
          style={{ background: "var(--storefront-primary, #036B52)" }}
        >
          Browse store
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen pb-28">
      <style>{`
        .v19pdp-snap { scroll-snap-type: x mandatory; }
        .v19pdp-snap > * { scroll-snap-align: center; }
        .v19pdp-noscrollbar::-webkit-scrollbar { display: none; }
        .v19pdp-noscrollbar { scrollbar-width: none; }
      `}</style>

      {/* Sticky header — back + search + cart */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 px-3 h-12">
          <button
            onClick={() => navigate(-1)}
            className="h-9 w-9 -ml-1 flex items-center justify-center rounded-full active:bg-gray-100"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5 text-gray-900" strokeWidth={2.4} />
          </button>
          <Link
            to={storefrontPath(slug, "shop")}
            className="flex-1 flex items-center gap-2 bg-gray-100 rounded-lg px-3 h-9"
          >
            <Search className="h-4 w-4 text-gray-500" strokeWidth={2.5} />
            <span className="text-[12px] text-gray-600 font-medium truncate">
              Search {SEARCH_TERMS[termIdx]}
            </span>
          </Link>
          <button
            onClick={handleShare}
            className="h-9 w-9 flex items-center justify-center rounded-full active:bg-gray-100"
            aria-label="Share"
          >
            <Share2 className="h-4.5 w-4.5 text-gray-700" strokeWidth={2.2} />
          </button>
          <Link
            to={storefrontPath(slug, "cart")}
            className="relative h-9 w-9 flex items-center justify-center rounded-full active:bg-gray-100"
            aria-label="Cart"
          >
            <ShoppingCart className="h-5 w-5 text-gray-900" strokeWidth={2.2} />
            {totalItems > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-[3px] rounded-full text-white text-[9px] font-bold flex items-center justify-center"
                style={{ background: "var(--storefront-primary, #036B52)" }}
              >
                {totalItems}
              </span>
            )}
          </Link>
        </div>
      </header>

      {/* Image gallery — swipeable with snap */}
      <div className="relative bg-white">
        {images.length > 0 && <ZoomHint onClick={() => setZoomOpen(true)} />}
        <div
          ref={galleryRef}
          onScroll={onGalleryScroll}
          className="v19pdp-snap v19pdp-noscrollbar flex overflow-x-auto"
        >
          {(images.length ? images : [null]).map((img, i) => (
            <div key={i} className="flex-shrink-0 w-full aspect-square bg-white flex items-center justify-center">
              {img ? (
                <img
                  src={optimizeImageUrl(img, 800, 90)}
                  alt={`${product.name} ${i + 1}`}
                  className="max-h-full max-w-full object-contain p-6"
                  loading={i === 0 ? "eager" : "lazy"}
                  fetchPriority={i === 0 ? "high" : "auto"}
                />
              ) : (
                <Package className="h-16 w-16 text-gray-300" />
              )}
            </div>
          ))}
        </div>

        {/* Pagination dots */}
        {images.length > 1 && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => scrollToImage(i)}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: i === galleryIdx ? 16 : 6,
                  background: i === galleryIdx ? "var(--storefront-primary, #036B52)" : "#d1d5db",
                }}
                aria-label={`Image ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="px-3 py-3 border-t border-gray-100">
          <div className="v19pdp-noscrollbar flex gap-2 overflow-x-auto">
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => scrollToImage(i)}
                className="flex-shrink-0 h-14 w-14 rounded-lg border-2 overflow-hidden bg-gray-50"
                style={{ borderColor: i === galleryIdx ? "var(--storefront-primary, #036B52)" : "#e5e7eb" }}
              >
                <img
                  src={optimizeImageUrl(img, 120, 80)}
                  alt={`thumb ${i + 1}`}
                  className="h-full w-full object-contain p-1"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Title block */}
      <div className="px-4 pt-2 pb-3">
        <h1 className="text-[18px] font-extrabold text-gray-900 leading-snug">{product.name}</h1>
        {reviews.length > 0 && (
          <div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md" style={{ background: "var(--storefront-primary, #036B52)" }}>
            <span className="text-[12px] font-bold text-white">{avgRating.toFixed(1)}</span>
            <Star className="h-3 w-3 fill-white text-white" />
            <span className="text-[11px] font-bold text-white">({reviews.length})</span>
          </div>
        )}
        <Link
          to={storefrontPath(slug, "shop")}
          className="text-[12px] font-bold mt-1.5 block"
          style={{ color: "var(--storefront-primary, #036B52)" }}
        >
          View all by {store?.name} →
        </Link>
      </div>

      {/* Variant pack-size chips */}
      {product.product_variants && product.product_variants.length > 0 && (
        <div className="px-4 pt-1 pb-3">
          <div className="text-[12px] font-bold text-gray-900 mb-2">Select Pack</div>
          <div className="v19pdp-noscrollbar flex gap-2 overflow-x-auto">
            {product.product_variants
              .filter((v: any) => v.is_active)
              .sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0))
              .map((v: any) => {
                const active = selectedVariantId === v.id;
                const vPrice = v.price ? Number(v.price) : effectivePrice;
                return (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariantId(active ? null : v.id)}
                    className="flex-shrink-0 px-3 py-2 rounded-lg border-2 text-left min-w-[110px] transition-colors"
                    style={{
                      borderColor: active ? "var(--storefront-primary, #036B52)" : "#e5e7eb",
                      background: active
                        ? "linear-gradient(rgba(255,255,255,0.88), rgba(255,255,255,0.88)), var(--storefront-primary, #036B52)"
                        : "#fff",
                    }}
                  >
                    <div className="text-[12px] font-bold text-gray-900">{v.name}</div>
                    <div className="text-[11px] mt-0.5 font-semibold" style={{ color: "var(--storefront-primary, #036B52)" }}>
                      ₹{vPrice.toFixed(0)}
                    </div>
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {/* Price block */}
      <div className="px-4 py-3 border-t border-gray-100">
        <div className="flex items-baseline gap-2">
          <span className="text-[22px] font-black text-gray-900 leading-none">
            ₹{effectivePrice.toFixed(0)}
          </span>
          {showStrike && (
            <span className="text-[13px] text-gray-400 line-through font-semibold">
              MRP ₹{mrpToShow.toFixed(0)}
            </span>
          )}
          {discountPct && (
            <span
              className="text-[10px] font-black px-1.5 py-0.5 rounded text-white uppercase tracking-wide"
              style={{ background: "var(--storefront-primary, #036B52)" }}
            >
              {discountPct}% OFF
            </span>
          )}
        </div>
        <div className="text-[11px] text-gray-500 font-medium mt-1">
          (Inclusive of all taxes)
        </div>
      </div>

      {/* Why shop from us trust strip */}
      <div className="px-4 py-4 border-t border-gray-100">
        <h3 className="text-[14px] font-extrabold text-gray-900 mb-3">
          Why shop from {store?.name}?
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <TrustItem
            iconBg="#FFF3D6"
            icon={<Zap className="h-5 w-5" style={{ color: "#B8860B" }} strokeWidth={2.4} />}
            title="Superfast Delivery"
            desc="Get your order delivered in minutes"
          />
          <TrustItem
            iconBg="color-mix(in srgb, var(--storefront-primary, #036B52) 14%, white)"
            icon={<IndianRupee className="h-5 w-5" style={{ color: "var(--storefront-primary, #036B52)" }} strokeWidth={2.4} />}
            title="Best Prices & Offers"
            desc="Best price destination with offers"
          />
          <TrustItem
            iconBg="#E8F0FF"
            icon={<Package className="h-5 w-5" style={{ color: "#0B57D0" }} strokeWidth={2.4} />}
            title="Wide Assortment"
            desc="Hand-picked range across categories"
          />
        </div>
      </div>

      {/* Highlights / About this item */}
      {product.description && (
        <div className="border-t border-gray-100">
          <button
            onClick={() => setHighlightsOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3.5 active:bg-gray-50"
          >
            <span className="text-[14px] font-extrabold text-gray-900">Highlights</span>
            {highlightsOpen ? (
              <ChevronUp className="h-4 w-4 text-gray-700" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-700" />
            )}
          </button>
          {highlightsOpen && (
            <div className="px-4 pb-4 text-[13px] text-gray-700 leading-relaxed font-medium whitespace-pre-line">
              {product.description}
            </div>
          )}
        </div>
      )}

      {/* Product Details accordion (uses fields that exist on product) */}
      <div className="border-t border-gray-100">
        <button
          onClick={() => setDetailsOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3.5 active:bg-gray-50"
        >
          <span className="text-[14px] font-extrabold text-gray-900">Product Details</span>
          {detailsOpen ? (
            <ChevronUp className="h-4 w-4 text-gray-700" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-700" />
          )}
        </button>
        {detailsOpen && (
          <div className="px-4 pb-4 text-[13px]">
            <table className="w-full">
              <tbody>
                {product.category && (
                  <DetailRow label="Category" value={product.category} />
                )}
                {product.sku && <DetailRow label="SKU" value={product.sku} />}
                <DetailRow label="In stock" value={product.stock_quantity > 0 ? "Yes" : "Out of stock"} />
                <DetailRow label="Sold by" value={store?.name || "—"} />
                {(store as any)?.city && (
                  <DetailRow label="Ships from" value={(store as any).city} />
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reviews section */}
      {reviews.length > 0 && (
        <div className="border-t border-gray-100 pt-4 pb-4 px-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[16px] font-extrabold text-gray-900">Ratings & Reviews</h3>
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md" style={{ background: "var(--storefront-primary, #036B52)" }}>
              <span className="text-[12px] font-bold text-white">{avgRating.toFixed(1)}</span>
              <Star className="h-3 w-3 fill-white text-white" />
            </div>
          </div>
          <div className="space-y-3">
            {reviews.slice(0, 4).map((r: any) => (
              <div key={r.id} className="border-b border-gray-100 pb-3 last:border-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold text-white" style={{ background: "var(--storefront-primary, #036B52)" }}>
                    {r.rating} <Star className="h-2.5 w-2.5 fill-white text-white" />
                  </div>
                  <span className="text-[12px] font-bold text-gray-900">{r.customer_name}</span>
                </div>
                {r.review_text && (
                  <p className="text-[12.5px] text-gray-700 leading-relaxed">{r.review_text}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Similar products carousel */}
      {similarProducts.length > 0 && (
        <div className="border-t border-gray-100 pt-4 pb-4">
          <div className="px-4 mb-3 flex items-center justify-between">
            <h3 className="text-[16px] font-extrabold text-gray-900">Similar products</h3>
            <Link
              to={storefrontPath(slug, "shop")}
              className="text-[12px] font-bold"
              style={{ color: "var(--storefront-primary, #036B52)" }}
            >
              See all →
            </Link>
          </div>
          <div className="v19pdp-noscrollbar flex gap-2.5 overflow-x-auto px-4 pb-1">
            {similarProducts.slice(0, 8).map((p: any) => (
              <div key={p.id} className="flex-shrink-0 w-[44%] max-w-[170px]">
                <V19ProductCard product={p} slug={slug} store={store} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sticky bottom ADD TO CART bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-[16px] font-black text-gray-900 leading-none">
              ₹{effectivePrice.toFixed(0)}
            </span>
            {showStrike && (
              <span className="text-[11px] text-gray-400 line-through font-semibold mt-0.5 leading-none">
                ₹{mrpToShow.toFixed(0)}
              </span>
            )}
            {Number(product.stock_quantity ?? 0) > 0 && Number(product.stock_quantity ?? 0) <= 5 && (
              <span className="text-[10px] font-bold text-orange-600 mt-0.5">Only {product.stock_quantity} left!</span>
            )}
          </div>
          <div className="flex-1" />
          {Number(product.stock_quantity ?? 0) <= 0 && product.stock_quantity !== null ? (
            <button
              disabled
              className="px-7 h-11 rounded-lg text-gray-500 bg-gray-200 text-[14px] font-extrabold uppercase tracking-wide cursor-not-allowed"
            >
              Out of stock
            </button>
          ) : cartQty > 0 ? (
            <div
              className="inline-flex items-center text-white font-extrabold rounded-lg overflow-hidden"
              style={{ background: "var(--storefront-primary, #036B52)", height: 44 }}
            >
              <button
                onClick={() => updateQuantity(product.id, selectedVariantId || undefined, cartQty - 1)}
                className="w-11 h-full flex items-center justify-center active:bg-black/10"
                aria-label="Decrease"
              >
                <Minus className="h-4 w-4" strokeWidth={3} />
              </button>
              <span className="px-3 min-w-[36px] text-center text-[15px]">{cartQty}</span>
              <button
                onClick={() => updateQuantity(product.id, selectedVariantId || undefined, cartQty + 1)}
                className="w-11 h-full flex items-center justify-center active:bg-black/10"
                aria-label="Increase"
              >
                <Plus className="h-4 w-4" strokeWidth={3} />
              </button>
            </div>
          ) : (
            <button
              onClick={handleAdd}
              className="px-7 h-11 rounded-lg text-white text-[14px] font-extrabold uppercase tracking-wide active:scale-[0.98] transition-transform"
              style={{ background: "var(--storefront-primary, #036B52)" }}
            >
              Add to cart
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function TrustItem({
  iconBg, icon, title, desc,
}: { iconBg: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-start">
      <div
        className="h-10 w-10 rounded-full flex items-center justify-center mb-2"
        style={{ background: iconBg }}
      >
        {icon}
      </div>
      <div className="text-[11px] font-extrabold text-gray-900 leading-tight">{title}</div>
      <div className="text-[10px] text-gray-500 font-medium leading-tight mt-0.5">{desc}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | number }) {
  return (
    <tr className="border-b border-gray-100 last:border-0">
      <td className="py-2 pr-3 text-gray-500 font-semibold text-[12px] w-[40%] align-top">{label}</td>
      <td className="py-2 text-gray-900 font-bold text-[12px]">{value}</td>
    </tr>
  );
}
