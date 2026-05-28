import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { createPortal } from "react-dom";
import { useParams, Link, useOutletContext, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getProductStats as getProductStatsUtil, getDiscountPercent, formatPrice } from "@/lib/productUtils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  ArrowLeft, Package, ChevronLeft, ChevronRight, ShoppingBag, ShoppingCart,
  Share2, Copy, Facebook, Twitter, X, ZoomIn, Star, Shield, Truck, RotateCcw,
  Clock, Eye, Flame, Heart, Minus, Plus, Check, ChevronDown, CreditCard, ThumbsUp,
  Lock, Timer, Zap, ShieldCheck, Maximize2
} from "lucide-react";
import { toast } from "sonner";
import { useMetaTags } from "@/hooks/useMetaTags";
import { useProductJsonLd } from "@/hooks/useJsonLd";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import type { StoreData } from "@/layouts/StorefrontLayout";
import { storefrontPath } from "@/lib/subdomain";
import { optimizeImageUrl, splitImageUrls } from "@/lib/imageOptimize";
import UniversalProductCard from "@/components/storefront/UniversalProductCard";
import { VariantCountProvider } from "@/hooks/useVariantCounts";
import { useStorefrontThemeConfig } from "@/hooks/useStorefrontThemeConfig";
import type { Tables } from "@/integrations/supabase/types";
import { fbPixelTrack, generateEventId } from "@/hooks/useFacebookPixel";
import { fireMetaCAPI } from "@/lib/metaCapi";
import { lazy, Suspense } from "react";
import { fetchPdpEdge } from "@/lib/storefrontEdgeApi";
import DeferUntilVisible from "@/components/storefront/DeferUntilVisible";

const PRODUCT_SUFFIX_RE = /-[a-z0-9]{4}$/i;

const BuyNowPhoneModal = lazy(() => import("@/components/storefront/BuyNowPhoneModal"));
const FrequentlyBoughtTogether = lazy(() => import("@/components/storefront/pdp/FrequentlyBoughtTogether"));
const CustomerReviews = lazy(() => import("@/components/storefront/pdp/CustomerReviews"));
const RelatedProducts = lazy(() => import("@/components/storefront/pdp/RelatedProducts"));


import DeliveryTimeline from "@/components/storefront/DeliveryTimeline";

interface Variant {
  id: string;
  name: string;
  price: number | null;
  stock_quantity: number;
  sku: string | null;
}

/* ── Social proof from shared utility ── */
function getProductStats(productId: string) {
  const stats = getProductStatsUtil(productId);
  return {
    rating: stats.rating,
    reviewCount: stats.reviewCount,
    baseViewers: 8 + (Math.abs((() => { let h = 0; for (let i = 0; i < productId.length; i++) { h = ((h << 5) - h) + productId.charCodeAt(i); h |= 0; } return h; })()) % 10),
    soldRecently: stats.soldThisWeek,
  };
}

function getDeliveryDate() {
  const d = new Date();
  d.setDate(d.getDate() + 3 + Math.floor(Math.random() * 3));
  return d.toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" });
}

/* ── Countdown timer seed from product ID ── */
function getCountdownSeed(productId: string) {
  let hash = 0;
  for (let i = 0; i < productId.length; i++) {
    hash = ((hash << 5) - hash) + productId.charCodeAt(i);
    hash |= 0;
  }
  const abs = Math.abs(hash);
  return {
    hours: 1 + (abs % 5),
    minutes: 10 + (abs % 49),
  };
}

/* ── Social proof names for toasts ── */
const socialProofCities = [
  "Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai", "Pune", "Kolkata",
  "Jaipur", "Ahmedabad", "Lucknow", "Chandigarh", "Indore", "Nagpur", "Kochi",
];

/* ── Fake customer reviews ── */
const reviewerNames = [
  "Priya S.", "Rahul M.", "Anita K.", "Vikram R.", "Sneha D.",
  "Arjun P.", "Meera T.", "Karthik N.", "Divya L.", "Amit B.",
  "Pooja G.", "Rohit V.", "Swati J.", "Nikhil W.", "Kavita C.",
];
const reviewTexts = [
  "Really happy with my order. Looks nice and the quality feels good for the price. Delivery was on time too. 🙌",
  "Loved it! Exactly as shown in the pictures. Packaging was neat and it arrived quickly. Will order again.",
  "Good experience overall. Product feels well made and the finish is clean. Worth the money. ⭐",
  "Nice quality and fast delivery. Got lots of compliments already. Definitely recommend this store.",
  "Very satisfied with my purchase. Looks even better in person. Smooth checkout and quick shipping. 😊",
  "Great product for the price. Just as described and packed properly. Would happily buy from here again.",
  "Exactly what I was looking for. Quality is solid and it arrived sooner than expected. Five stars!",
  "Honestly better than I expected. Looks classy and feels durable. Already planning my next order. 🎁",
];
const reviewDaysAgo = [2, 3, 5, 7, 10, 12, 14, 18, 21, 25];

function getFakeReviews(productId: string) {
  let hash = 0;
  for (let i = 0; i < productId.length; i++) {
    hash = ((hash << 5) - hash) + productId.charCodeAt(i);
    hash |= 0;
  }
  const abs = Math.abs(hash);
  const idx = abs % reviewerNames.length;
  const textIdx = abs % reviewTexts.length;
  const daysIdx = abs % reviewDaysAgo.length;
  return [{
    id: `review-0`,
    name: reviewerNames[idx],
    rating: 5,
    text: reviewTexts[textIdx],
    daysAgo: reviewDaysAgo[daysIdx],
    verified: true,
    helpful: 4 + (abs % 12),
    avatar: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(reviewerNames[idx])}&backgroundColor=c0aede,d1d4f9,b6e3f4,ffd5dc,ffdfbf`,
  }];
}

export default function ProductDetail() {
  const store = useOutletContext<StoreData>();
  const { productSlug } = useParams<{ productSlug: string }>();
  const navigate = useNavigate();
  const canonicalProductSlug = useMemo(() => productSlug?.trim() || "", [productSlug]);
  const productSlugPrefix = useMemo(
    () => (canonicalProductSlug ? canonicalProductSlug.replace(PRODUCT_SUFFIX_RE, "") : ""),
    [canonicalProductSlug],
  );

  const { addToCart, items, cartTotal, closeCart, openCart } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const queryClient = useQueryClient();
  const mainThemeConfig = useStorefrontThemeConfig(store?.id);
  const bilingualCta = ((store as any)?.theme === "theme-16" || (store as any)?.theme === "theme-21") && !!(mainThemeConfig as any)?.bilingual_cta;

  // Fetch store shipping config for free shipping threshold
  const { data: shippingConfig } = useQuery({
    queryKey: ["storefront-shipping-config", store.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("store_shipping_config")
        .select("free_shipping_above, flat_rate, is_active")
        .eq("store_id", store.id)
        .maybeSingle();
      return data;
    },
    enabled: !!store.id,
    staleTime: 10 * 60 * 1000,
  });

  const FREE_SHIPPING_THRESHOLD = shippingConfig?.free_shipping_above ?? 499;

  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const [cartBounce, setCartBounce] = useState(false);
  const [openAccordion, setOpenAccordion] = useState<string | null>("description");
  const [buyNowModalOpen, setBuyNowModalOpen] = useState(false);
  const [variantPromptOpen, setVariantPromptOpen] = useState(false);
  const [stickyBarVisible, setStickyBarVisible] = useState(false);
  const inlineCtaRef = useRef<HTMLDivElement>(null);


  const deliveryDate = useMemo(() => getDeliveryDate(), []);

  // Reset ALL state when navigating between products
  useEffect(() => {
    setSelectedVariant(null);
    setQuantity(1);
    setJustAdded(false);
    setCartBounce(false);
    setOpenAccordion("description");
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    });
    // Clear the route-transition preload now that the real PDP is mounted.
    import("@/lib/pdpPreload").then(m => m.clearPdpPreload()).catch(() => {});
  }, [productSlug]);

  const getCachedProduct = () => {
    const cached = queryClient.getQueryData<any[]>(["storefront-products", store.id]);
    if (!cached) return undefined;
    return cached.find((p: any) => p.slug === canonicalProductSlug || p.id === canonicalProductSlug || (productSlugPrefix && p.slug?.startsWith(`${productSlugPrefix}-`))) || undefined;
  };

  const existingData = queryClient.getQueryData(["storefront-product", store.id, canonicalProductSlug]);

  // ── Worker-inlined PDP payload (Phase A): { product, images, variants, shipping_config } ──
  const getInlinePdp = () => {
    try {
      const inline = (window as any).__PRODUCT_INLINE__;
      if (inline && inline.product && (inline.product.slug === canonicalProductSlug || (productSlugPrefix && inline.product.slug?.startsWith(`${productSlugPrefix}-`)))) return inline;
    } catch { /* ignore */ }
    return null;
  };

  const { data: product, isLoading } = useQuery({
    queryKey: ["storefront-product", store.id, canonicalProductSlug],
    queryFn: async () => {
      // Phase A: try Worker edge cache first (KV + CF cache)
      let edge = await fetchPdpEdge(canonicalProductSlug);
      if (!edge && productSlugPrefix && productSlugPrefix !== canonicalProductSlug) edge = await fetchPdpEdge(productSlugPrefix);

      let rpc = edge ?? (await (supabase as any).rpc("get_product_page", {
        _store_slug: store.slug,
        _product_slug: canonicalProductSlug,
      })).data;

      if (!rpc?.product && productSlugPrefix && productSlugPrefix !== canonicalProductSlug) {
        rpc = (await (supabase as any).rpc("get_product_page", {
          _store_slug: store.slug,
          _product_slug: productSlugPrefix,
        })).data;
      }

      if (rpc?.product) {
        // Hydrate sibling queries so they don't refetch
        if (rpc.images) queryClient.setQueryData(["product-images", rpc.product.id], rpc.images);
        if (rpc.variants) queryClient.setQueryData(["product-variants", rpc.product.id], rpc.variants);
        if (rpc.shipping_config) queryClient.setQueryData(["storefront-shipping-config", store.id], rpc.shipping_config);
        return rpc.product;
      }

      // Fallback: legacy direct query (covers UUID-as-slug case + RPC failures)
      const { PRODUCT_PDP_FIELDS } = await import("@/lib/productSelectors");
      let { data, error } = await supabase
        .from("products")
        .select(PRODUCT_PDP_FIELDS)
        .eq("store_id", store.id)
            .eq("slug", canonicalProductSlug)
        .eq("is_active", true)
        .maybeSingle();

      if (!data && !error && productSlugPrefix) {
        const legacyResult = await supabase
          .from("products")
          .select(PRODUCT_PDP_FIELDS)
          .eq("store_id", store.id)
          .ilike("slug", `${productSlugPrefix}-%`)
          .eq("is_active", true)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        data = legacyResult.data;
        error = legacyResult.error;
      }

      if (!data && !error) {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(canonicalProductSlug)) {
          if (error) throw error;
          return data;
        }
        const result = await supabase
          .from("products")
          .select(PRODUCT_PDP_FIELDS)
          .eq("store_id", store.id)
          .eq("id", canonicalProductSlug)
          .eq("is_active", true)
          .maybeSingle();
        data = result.data;
        error = result.error;
      }

      if (error) throw error;
      return data;
    },
    initialData: () => {
      if (existingData) return undefined as any;
      const inline = getInlinePdp();
      if (inline?.product) {
        // Seed sibling caches from inline payload too
        if (inline.images) queryClient.setQueryData(["product-images", inline.product.id], inline.images);
        if (inline.variants) queryClient.setQueryData(["product-variants", inline.product.id], inline.variants);
        if (inline.shipping_config) queryClient.setQueryData(["storefront-shipping-config", store.id], inline.shipping_config);
        return inline.product;
      }
      return getCachedProduct();
    },
    enabled: !!store.id && !!canonicalProductSlug,
    staleTime: 2 * 60 * 1000,
  });

  const contentReadyRef = useRef(false);

  useEffect(() => {
    contentReadyRef.current = false;
  }, [productSlug]);

  useEffect(() => {
    if (contentReadyRef.current || isLoading) return;
    contentReadyRef.current = true;
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event("storefront:content-ready"));
    });
  }, [isLoading, productSlug]);

  // Show sticky bar when inline CTA scrolls out of view (works on all screens)
  // Re-run after loading completes so the ref is attached to the DOM
  useEffect(() => {
    if (isLoading) return;
    const raf = requestAnimationFrame(() => {
      const el = inlineCtaRef.current;
      if (!el) return;
      const observer = new IntersectionObserver(
        ([entry]) => setStickyBarVisible(!entry.isIntersecting),
        { threshold: 0 }
      );
      observer.observe(el);
      (inlineCtaRef as any)._observer = observer;
    });
    return () => {
      cancelAnimationFrame(raf);
      (inlineCtaRef as any)._observer?.disconnect();
    };
  }, [productSlug, isLoading]);

  const productId = product?.id;

  // Use cached product_images from RPC data as initialData
  const getCachedImages = () => {
    const cached = getCachedProduct();
    if (cached?.product_images && Array.isArray(cached.product_images)) {
      return cached.product_images as { id: string; image_url: string; display_order: number }[];
    }
    return undefined;
  };

  const { data: extraImages } = useQuery({
    queryKey: ["product-images", productId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("product_images")
        .select("id, image_url, display_order")
        .eq("product_id", productId!)
        .order("display_order");
      if (error) throw error;
      return data as { id: string; image_url: string; display_order: number }[];
    },
    initialData: getCachedImages,
    enabled: !!productId,
    staleTime: 5 * 60 * 1000,
  });

  // Use cached product_variants from RPC data as initialData
  const getCachedVariants = () => {
    const cached = getCachedProduct();
    if (cached?.product_variants && Array.isArray(cached.product_variants)) {
      return cached.product_variants as Variant[];
    }
    return undefined;
  };

  const { data: variants } = useQuery({
    queryKey: ["product-variants", productId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("product_variants")
        .select("id, name, price, sku, stock_quantity, display_order")
        .eq("product_id", productId!)
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data as Variant[];
    },
    initialData: getCachedVariants,
    enabled: !!productId,
    staleTime: 5 * 60 * 1000,
  });

  useMetaTags({
    title: product ? `${product.name} — ${store.name}` : undefined,
    description: product?.description || undefined,
    ogImage: product?.image_url || undefined,
    storeSlug: store.slug,
    customDomain: (store as any)?.custom_domain,
    canonicalPath: product ? `product/${product.slug || product.id}` : undefined,
  });

  useEffect(() => {
    if (!product) return;
    const eid = generateEventId();
    const eventData = {
      content_name: product.name,
      content_ids: [product.id],
      content_type: "product",
      value: product.sale_price && product.sale_price < product.price ? product.sale_price : product.price,
      currency: product.currency || store.currency || "INR",
    };
    fbPixelTrack("ViewContent", eventData, eid);
    fireMetaCAPI({
      storeId: store.id,
      eventName: "ViewContent",
      eventId: eid,
      customData: {
        content_ids: [product.id],
        content_name: product.name,
        content_type: "product",
        value: Number(eventData.value),
        currency: eventData.currency,
      },
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
      extraImages: extraImages?.map(i => i.image_url) || [],
    } : { name: "", price: 0, id: "", currency: "INR" },
    storeSlug: store.slug,
    storeName: store.name,
    customDomain: (store as any)?.custom_domain,
  });

  /* ── Live viewers — fluctuate between 8-20 ── */
  const [liveViewers, setLiveViewers] = useState(() => 8 + Math.floor(Math.random() * 13));
  useEffect(() => {
    if (!product) return;
    const timer = setInterval(() => {
      setLiveViewers(8 + Math.floor(Math.random() * 13)); // 8-20
    }, 5000 + Math.random() * 3000);
    return () => clearInterval(timer);
  }, [product?.id]);

  /* Social-proof "X from Y just purchased" popup removed per user request */
  const socialProof = null as null | { name: string; city: string; visible: boolean };

  const allImages = (() => {
    const imgs: string[] = [];
    if (product?.image_url) imgs.push(...splitImageUrls(product.image_url));
    if (extraImages) imgs.push(...extraImages.map((i) => i.image_url));
    return imgs;
  })();

  const fakeReviews = useMemo(() => product ? getFakeReviews(product.id) : [], [product?.id]);

  // Fetch real reviews
  const { data: realReviews, refetch: refetchReviews } = useQuery({
    queryKey: ["product-reviews", product?.id],
    queryFn: async () => {
      const { PRODUCT_REVIEW_FIELDS } = await import("@/lib/productSelectors");
      const { data } = await supabase
        .from("product_reviews")
        .select(PRODUCT_REVIEW_FIELDS)
        .eq("product_id", product!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      return (data || []) as { id: string; customer_name: string; rating: number; review_text: string | null; is_verified: boolean; created_at: string }[];
    },
    enabled: !!product?.id,
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading) return <ProductDetailSkeleton />;

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
  const discountPct = getDiscountPercent(product.price, product.sale_price) || 0;
  const currency = product.currency || "USD";
  const basePrice = hasDiscount ? product.sale_price! : product.price;
  const variantPrice = basePrice; // variants no longer override price
  const orderMode = (store as any).order_mode || "whatsapp";
  const showWhatsApp = (orderMode === "whatsapp" || orderMode === "both") && (store as any)?.billing_mode !== "commission";
  const showBuyNow = orderMode === "website" || orderMode === "both";
  const stats = getProductStats(product.id);
  const wishlisted = isWishlisted(product.id);
  const isUnlimitedStock = product.stock_quantity >= 999999;
  const isLowStock = !isUnlimitedStock && product.stock_quantity > 0 && product.stock_quantity <= 10;
  const isOutOfStock = !isUnlimitedStock && product.stock_quantity <= 0;

  const hasVariants = (variants || []).length > 0;

  const handleAddToCart = (e?: React.MouseEvent) => {
    if (hasVariants && !selectedVariant) {
      toast.error("Please select a variant first"); setVariantPromptOpen(true);
      document.getElementById("variant-picker")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    addToCart({
      productId: product.id,
      variantId: selectedVariant?.id,
      name: product.name,
      variantName: selectedVariant?.name,
      price: variantPrice,
      image: product.image_url || undefined,
      quantity,
    }, { silent: true });

    // Fly-to-cart animation only — do not auto-open the SideCart.
    import("@/lib/flyToCart").then(({ flyToCart }) => {
      const source = (e?.currentTarget as Element) || null;
      flyToCart(source, { imageUrl: product.image_url || undefined });
    });

    setJustAdded(true);
    setCartBounce(true);
    setTimeout(() => setJustAdded(false), 1500);
    setTimeout(() => setCartBounce(false), 600);
  };


  const handleBuyNow = () => {
    if (hasVariants && !selectedVariant) {
      toast.error("Please select a variant first"); setVariantPromptOpen(true);
      document.getElementById("variant-picker")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    // Theme 16 / 21: show phone modal instead of direct checkout
    if ((store as any).theme === "theme-16" || (store as any).theme === "theme-21") {
      // Add to cart first so checkout has the item
      addToCart({
        productId: product.id,
        variantId: selectedVariant?.id,
        name: product.name,
        variantName: selectedVariant?.name,
        price: variantPrice,
        image: product.image_url || undefined,
        quantity,
      });
      closeCart();
      setBuyNowModalOpen(true);
      return;
    }

    addToCart({
      productId: product.id,
      variantId: selectedVariant?.id,
      name: product.name,
      variantName: selectedVariant?.name,
      price: variantPrice,
      image: product.image_url || undefined,
      quantity,
    });
    closeCart();
    navigate(storefrontPath(store.slug, "checkout"));
  };


  const handleWishlist = () => {
    toggleWishlist({
      productId: product.id,
      name: product.name,
      price: Number(product.price),
      salePrice: product.sale_price ? Number(product.sale_price) : undefined,
      image: product.image_url || undefined,
      slug: product.slug || product.id,
      category: product.category || undefined,
    });
    toast.success(wishlisted ? "Removed from wishlist" : "Added to wishlist", { dismissible: true });
  };

  const toggleAccordion = (key: string) => {
    setOpenAccordion(openAccordion === key ? null : key);
  };

  const shippingProgress = FREE_SHIPPING_THRESHOLD ? Math.min(100, (cartTotal / FREE_SHIPPING_THRESHOLD) * 100) : 100;
  const shippingRemaining = FREE_SHIPPING_THRESHOLD ? Math.max(0, FREE_SHIPPING_THRESHOLD - cartTotal) : 0;

  const isV18 = (store as any).theme === "theme-18";
  const v18Text = isV18 ? { color: "var(--storefront-text, #ffffff)" } : {};
  const v18Muted = isV18 ? { color: "color-mix(in srgb, var(--storefront-text, #ffffff) 60%, transparent)" } : {};
  const v18Font: React.CSSProperties = isV18 ? { fontFamily: "var(--storefront-body-font, 'Inter'), sans-serif" } : {};

  return (
    <div className="mx-auto max-w-6xl lg:max-w-7xl px-0 sm:px-4 pt-0 sm:pt-8 pb-3 sm:pb-8" style={isV18 ? { backgroundColor: "var(--storefront-bg, #0a0a0a)", color: "var(--storefront-text, #ffffff)" } : {}}>
      {/* Breadcrumb */}
      <nav className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground px-4 sm:px-0" aria-label="Breadcrumb" style={isV18 ? { display: "none" } : {}}>
        <Link to={storefrontPath(store.slug)} className="hover:text-foreground transition-colors">Home</Link>
        <span>/</span>
        <Link to={storefrontPath(store.slug, "shop")} className="hover:text-foreground transition-colors">Shop</Link>
        <span>/</span>
        <span className="text-foreground font-medium line-clamp-1">{product.name}</span>
      </nav>

      <div className="grid gap-2 sm:gap-6 lg:grid-cols-2 lg:gap-10">
        {/* Image Gallery */}
        <ImageGallery
          key={product.id}
          images={allImages}
          productName={product.name}
          hasDiscount={hasDiscount}
          discountPct={discountPct}
          onShare={async () => {
            const storeHost = (store as any).custom_domain
              ? `https://${(store as any).custom_domain}`
              : `https://${store.slug}.shopbanao.in`;
            const shareUrl = `${storeHost}/product/${product.slug || product.id}`;
            if (navigator.share) {
              try { await navigator.share({ title: product.name, url: shareUrl }); } catch {}
            } else {
              try { await navigator.clipboard.writeText(shareUrl); toast.success("Link copied!"); } catch { toast.error("Failed to copy"); }
            }
          }}
        />

        {/* Product Info */}
        <div className="flex flex-col gap-0 px-4 sm:px-0 lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto lg:scrollbar-hide">

          {/* Product Title — right under image */}
          <h1 className="text-xl font-semibold leading-snug sm:text-2xl lg:text-[1.7rem]" style={{ fontFamily: "var(--storefront-heading-font, 'Alegreya SC'), serif", ...(isV18 ? { color: "#ffffff", fontWeight: 400, letterSpacing: "0.01em" } : { color: undefined }) }}>
            {product.name}
          </h1>

          {/* Rating & Social Proof */}
          <div className="mt-2 flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-0.5">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`h-3.5 w-3.5 ${i < Math.floor(stats.rating) ? "fill-amber-400 text-amber-400" : i < stats.rating ? "fill-amber-400/50 text-amber-400" : isV18 ? "text-white/20" : "text-muted-foreground/20"}`}
                />
              ))}
              {isV18 ? (
                <span className="ml-1 text-sm" style={{ color: "#ffffff", ...v18Font }}>{stats.reviewCount} reviews</span>
              ) : (
                <span className="ml-1 text-sm font-bold text-foreground">{stats.rating}</span>
              )}
            </div>
            {!isV18 && (
              <>
                <span className="text-muted-foreground/30">|</span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Flame className="h-3 w-3 text-orange-400" /> {stats.soldRecently}+ sold recently
                </span>
              </>
            )}
          </div>

          {/* Price — simple, no border/background */}
          <div className="mt-4">
            <div className="flex items-baseline gap-2.5 flex-wrap">
              <span className={`text-2xl font-extrabold sm:text-3xl ${isV18 ? '' : 'text-foreground'}`} style={isV18 ? { color: "#ffffff", ...v18Font, fontWeight: 400 } : {}}>
                {isV18 ? `Rs. ${Number(variantPrice).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `${formatPrice(Number(variantPrice), currency)}`}
              </span>
              {hasDiscount && (
                <>
                  <span className={`text-sm line-through ${isV18 ? '' : 'text-muted-foreground'}`} style={isV18 ? { color: "#666666", ...v18Font } : {}}>
                    {isV18 ? `Rs. ${Number(product.price).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `${formatPrice(Number(product.price), currency)}`}
                  </span>
                  {!isV18 && (
                    <Badge className="bg-emerald-600 text-white text-[11px] font-bold border-0 px-2 py-0.5">
                      {discountPct}% OFF
                    </Badge>
                  )}
                </>
              )}
            </div>
            {isV18 && (
              <p className="mt-2 text-sm italic" style={{ color: "#999999", ...v18Font }}>Inclusive of all taxes</p>
            )}
            {!isV18 && hasDiscount && (
              <p className="mt-1 text-xs font-semibold text-emerald-600">
                You save {formatPrice((product.price - product.sale_price!), currency)} on this order
              </p>
           )}
          </div>



          {/* Live viewers — removed per merchant request */}

          {/* Stock Status */}
          {isOutOfStock ? (
            <div className="mt-3 rounded-lg bg-destructive/10 px-3 py-2">
              <p className="text-sm font-bold text-destructive">Out of Stock</p>
            </div>
          ) : isLowStock ? (
            <div className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600" />
              <p className="text-sm font-semibold text-amber-700">
                Hurry! Only {product.stock_quantity} left in stock
              </p>
            </div>
          ) : null}

          {/* Variant Selector */}
          {(variants || []).length > 0 && (
            <div id="variant-picker" className="mt-5 space-y-2 scroll-mt-24" style={isV18 ? { borderTop: "1px solid #333", paddingTop: 16 } : {}}>
              <Label className={isV18 ? "text-xs font-bold uppercase tracking-wider" : "text-sm font-bold uppercase tracking-wider text-muted-foreground"} style={isV18 ? { color: "#ffffff", ...v18Font } : {}}>
                {isV18 ? `SIZE: ${selectedVariant?.name || ""}` : <>Select Variant<span className="text-destructive ml-0.5">*</span>: <span className="text-foreground normal-case tracking-normal">{selectedVariant?.name || "None"}</span></>}
              </Label>
              <div className="flex flex-wrap gap-2">
                {(variants || []).map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelectedVariant(selectedVariant?.id === v.id ? null : v)}
                    className={`transition-all duration-200 active:scale-95 ${
                      isV18
                        ? `flex h-10 w-10 items-center justify-center border text-sm ${
                            selectedVariant?.id === v.id
                              ? "border-white bg-white text-black"
                              : "border-white/40 text-white hover:border-white"
                          }`
                        : `relative rounded-2xl border-2 px-6 py-3.5 text-base font-bold min-w-[64px] ${
                            selectedVariant?.id === v.id
                              ? "border-primary bg-primary/10 text-primary shadow-md"
                              : "border-border text-foreground hover:border-primary/40 hover:bg-accent/50"
                          }`
                    }`}
                    style={isV18 ? v18Font : {}}
                  >
                    {!isV18 && selectedVariant?.id === v.id && (
                      <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                        <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />
                      </span>
                    )}
                    {v.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity Selector */}
          {!isOutOfStock && (
            <div className="mt-5 flex items-center gap-3">
              {!isV18 && <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Qty</Label>}
              <div className={`flex items-center overflow-hidden ${isV18 ? 'border border-white/40' : 'rounded-xl border border-border'}`}>
                <button
                  onClick={(e) => {
                    setQuantity(Math.max(1, quantity - 1));
                    const el = e.currentTarget.parentElement?.querySelector<HTMLSpanElement>("[data-qty-value]");
                    if (el) { el.classList.remove("qty-bounce"); void el.offsetWidth; el.classList.add("qty-bounce"); }
                  }}
                  className={`flex items-center justify-center transition-colors active:scale-90 ${isV18 ? 'h-11 w-11 text-white hover:bg-white/10' : 'h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-accent'}`}
                >
                  <Minus className={isV18 ? "h-4 w-4" : "h-3.5 w-3.5"} />
                </button>
                <span data-qty-value className={`text-center text-sm font-bold tabular-nums ${isV18 ? 'w-12' : 'w-10'}`} style={isV18 ? { color: "#ffffff", ...v18Font } : {}}>{quantity}</span>
                <button
                  onClick={(e) => {
                    setQuantity(quantity + 1);
                    const el = e.currentTarget.parentElement?.querySelector<HTMLSpanElement>("[data-qty-value]");
                    if (el) { el.classList.remove("qty-bounce"); void el.offsetWidth; el.classList.add("qty-bounce"); }
                  }}
                  className={`flex items-center justify-center transition-colors active:scale-90 ${isV18 ? 'h-11 w-11 text-white hover:bg-white/10' : 'h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-accent'}`}
                >
                  <Plus className={isV18 ? "h-4 w-4" : "h-3.5 w-3.5"} />
                </button>
              </div>
            </div>
          )}


          {/* CTA Buttons */}
          {!isOutOfStock && (
            <div className="mt-5 flex flex-col gap-3">
              {isV18 ? (
                /* V18 Sagacity-style: full-width stacked buttons */
                <>
                  <button
                    className={`flex h-12 w-full items-center justify-center text-sm font-bold uppercase tracking-widest transition-all active:scale-[0.97] ${
                      justAdded ? "bg-emerald-600 text-white" : "bg-white text-black hover:bg-white/90"
                    }`}
                    style={v18Font}
                    onClick={handleAddToCart}
                  >
                    {justAdded ? "ADDED!" : "ADD TO CART"}
                  </button>
                  {showBuyNow && (
                    <button
                      className="flex h-12 w-full items-center justify-center border text-sm font-bold uppercase tracking-widest transition-all active:scale-[0.97] hover:bg-white hover:text-black"
                      style={{ borderColor: "#ffffff", color: "#ffffff", ...v18Font }}
                      onClick={handleBuyNow}
                    >
                      BUY IT NOW
                    </button>
                  )}
                </>
              ) : (
                /* Default style */
                <div ref={inlineCtaRef} className="grid grid-cols-2 gap-3">
                  <button
                    className={`btn-press relative flex h-12 items-center justify-center gap-2 rounded-xl text-xs font-bold uppercase tracking-wider overflow-hidden transition-all duration-300 ${
                      justAdded ? "bg-emerald-600 text-white" : "btn-gold hover:brightness-110"
                    }`}
                    onClick={handleAddToCart}
                  >
                    {justAdded ? (
                      <span className="flex items-center gap-2 animate-fade-in">
                        <Check className="h-4 w-4" strokeWidth={3} />
                        Added!
                      </span>
                    ) : (
                      <span className={`flex items-center gap-2 ${cartBounce ? "animate-bounce-once" : ""}`}>
                        <ShoppingCart className="h-4 w-4" />
                        {bilingualCta ? "Add / जोड़ें" : "Add to Cart"}
                      </span>
                    )}
                  </button>

                  {showBuyNow && (
                    <button
                      className="btn-press flex h-12 w-full items-center justify-center gap-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all animate-[vibrate_0.8s_ease-in-out_infinite_3s]"
                      style={{ backgroundColor: "var(--storefront-accent, hsl(var(--primary)))", color: "var(--storefront-bg, hsl(var(--primary-foreground)))" }}
                      onClick={handleBuyNow}
                    >
                      <span className="flex items-center gap-1.5">
                        <ShoppingBag className="h-4 w-4" />
                        {bilingualCta ? "Buy Now / अभी खरीदें" : "Buy Now"}
                      </span>
                      <span className="flex items-center -space-x-1">
                        <img src="/icons/gpay-round.webp" alt="GPay" width={16} height={16} loading="lazy" decoding="async" className="h-4 w-4 rounded-full ring-1 ring-white bg-white object-contain" />
                        <img src="/icons/phonepe-round.webp" alt="PhonePe" width={16} height={16} loading="lazy" decoding="async" className="h-4 w-4 rounded-full ring-1 ring-white bg-white object-contain" />
                        <img src="/icons/paytm-round.webp" alt="Paytm" width={16} height={16} loading="lazy" decoding="async" className="h-4 w-4 rounded-full ring-1 ring-white bg-white object-contain" />
                      </span>
                    </button>
                  )}
                </div>
              )}

              {/* WhatsApp Order */}
              {showWhatsApp && store.whatsapp_number && (
                <button
                  className="group relative flex w-full items-center justify-center gap-3 rounded-2xl px-6 py-4 text-white font-extrabold text-base uppercase tracking-wide transition-all duration-200 hover:shadow-2xl hover:brightness-110 active:scale-[0.98]"
                  style={{ backgroundColor: "#25D366", boxShadow: "0 6px 24px rgba(37, 211, 102, 0.35)" }}
                  onClick={() => {
                    if (hasVariants && !selectedVariant) {
                      toast.error("Please select a variant first"); setVariantPromptOpen(true);
                      document.getElementById("variant-picker")?.scrollIntoView({ behavior: "smooth", block: "center" });
                      return;
                    }
                    const phone = store.whatsapp_number!.replace(/[^0-9+]/g, "");
                    const variantInfo = selectedVariant ? ` (${selectedVariant.name})` : "";
                    const productUrl = `${window.location.origin}${window.location.pathname}`;
                    const text = `Hi ${store.name}! 👋\n\nI want to buy *${product.name}${variantInfo}* x${quantity}\n\n💰 Price: ${formatPrice((variantPrice * quantity), currency)}\n\n🔗 ${productUrl}\n\nPlease share availability, delivery time & payment options.`;
                    window.open(`https://wa.me/${encodeURIComponent(phone)}?text=${encodeURIComponent(text)}`, "_blank");
                  }}
                >
                  <svg viewBox="0 0 32 32" fill="white" className="h-7 w-7 shrink-0 transition-transform group-hover:scale-110">
                    <path d="M16.004 3.2C9.056 3.2 3.406 8.848 3.404 15.8c-.001 2.222.58 4.392 1.683 6.303L3.2 28.8l6.867-1.802A12.56 12.56 0 0 0 16 28.398h.005C22.95 28.398 28.6 22.75 28.6 15.8 28.6 8.85 22.95 3.2 16.004 3.2Zm0 22.997h-.004a10.44 10.44 0 0 1-5.318-1.457l-.382-.226-3.955 1.038 1.055-3.858-.249-.395A10.42 10.42 0 0 1 5.54 15.8c.002-5.77 4.697-10.463 10.466-10.463 5.77 0 10.463 4.695 10.463 10.464 0 5.77-4.695 10.465-10.465 10.465v-.069Zm5.74-7.835c-.315-.158-1.863-.92-2.152-1.025-.289-.105-.499-.158-.67.15-.21.315-.815 1.025-.999 1.236-.184.21-.368.236-.683.079-.315-.158-1.33-.49-2.533-1.562-.937-.835-1.568-1.867-1.752-2.182-.184-.315-.02-.486.138-.643.142-.141.315-.368.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.71-1.71-.973-2.341-.256-.615-.517-.532-.71-.542-.184-.008-.394-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                  </svg>
                  Order on WhatsApp
                </button>
              )}
            </div>
          )}

          {/* Delivery timeline (Order → Shipping → Delivery) */}
          {!isOutOfStock && <DeliveryTimeline />}

          {/* Checkout Trust Block — hidden in V18 */}
          {!isV18 && !isOutOfStock && (
            <div className="mt-5 rounded-2xl border border-border overflow-hidden">
              <div className="flex items-center justify-center gap-2 py-2.5 border-b border-border bg-muted/30">
                <ShieldCheck className="h-4 w-4 text-foreground" />
                <span className="text-[11px] font-bold text-foreground uppercase tracking-widest">Guaranteed Safe Checkout</span>
              </div>
              <div className="px-4 py-3"><RealPaymentLogos /></div>
              <div className="border-t border-border px-4 py-3 space-y-2.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0"><Truck className="h-4 w-4 text-primary" /></div>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-foreground">Estimated Delivery by {deliveryDate}</span>
                    <span className="text-[10px] text-muted-foreground">Order within 2 hours for fastest delivery</span>
                  </div>
                </div>
                {hasDiscount && (
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 shrink-0"><Timer className="h-4 w-4 text-amber-600" /></div>
                    <div className="flex flex-col">
                      <CountdownTimerInline productId={product.id} />
                      <span className="text-[10px] text-muted-foreground">Limited time offer — don't miss out</span>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted shrink-0"><CreditCard className="h-4 w-4 text-muted-foreground" /></div>
                  <span className="text-xs text-muted-foreground">Inclusive of all taxes</span>
                </div>
              </div>
            </div>
          )}

          {/* Wishlist — hidden in V18 */}
          {!isV18 && (
            <div className="mt-4">
              <button onClick={handleWishlist} className={`flex items-center gap-2 text-sm transition-all duration-200 ${wishlisted ? "text-destructive font-semibold" : "text-muted-foreground hover:text-foreground"}`}>
                <Heart className={`h-4 w-4 transition-transform duration-200 ${wishlisted ? "fill-destructive text-destructive scale-110" : ""}`} />
                {wishlisted ? "Saved" : "Add to Wishlist"}
              </button>
            </div>
          )}

          {/* Trust Badges — hidden in V18 */}
          {!isV18 && (
            <div className="mt-6 grid grid-cols-3 gap-3 text-center">
              <div className="flex flex-col items-center gap-2 py-4 rounded-xl border border-border">
                <svg viewBox="0 0 64 64" className="h-12 w-12 text-foreground" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="18" width="34" height="24" rx="2" /><path d="M38 26h10l8 10v6h-18V26z" /><circle cx="16" cy="44" r="4" /><circle cx="48" cy="44" r="4" /><path d="M20 44h20" /><path d="M4 44h8" /><path d="M52 44h8" /><text x="14" y="35" fontSize="9" fontWeight="bold" fill="currentColor" stroke="none">FREE</text></svg>
                <span className="text-xs font-semibold text-foreground">Free Shipping</span>
              </div>
              <div className="flex flex-col items-center gap-2 py-4 rounded-xl border border-border">
                <svg viewBox="0 0 64 64" className="h-12 w-12 text-foreground" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M32 6l6 3 7-1 4 6 6 3 1 7 3 6-3 6-1 7-6 4-3 6-7 1-6 3-6-3-7 1-4-6-6-3-1-7-3-6 3-6 1-7 6-4 3-6 7-1z" /><path d="M22 33l7 7 13-14" strokeWidth="3" /></svg>
                <span className="text-xs font-semibold text-foreground">7 Days Return Policy</span>
              </div>
              <div className="flex flex-col items-center gap-2 py-4 rounded-xl border border-border">
                <svg viewBox="0 0 64 64" className="h-12 w-12 text-foreground" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="32" cy="28" r="10" /><path d="M22 28c0-5.5 4.5-10 10-10s10 4.5 10 10" /><path d="M18 28v6a4 4 0 004 4h0" /><path d="M46 28v6a4 4 0 01-4 4h0" /><rect x="14" y="26" width="6" height="12" rx="3" /><rect x="44" y="26" width="6" height="12" rx="3" /><path d="M42 38v4a6 6 0 01-6 6h-4" /><path d="M24 52h8" /><text x="23" y="60" fontSize="7" fontWeight="bold" fill="currentColor" stroke="none">SUPPORT</text></svg>
                <span className="text-xs font-semibold text-foreground">Devoted Help Desk</span>
              </div>
            </div>
          )}

          {/* Frequently Bought Together — removed per user request */}

          {/* V18: SKU & Categories */}
          {isV18 && (
            <div className="mt-5 space-y-1 text-sm" style={{ color: "#999", ...v18Font, borderTop: "1px solid #333", paddingTop: 16 }}>
              {product.sku && <p><span style={{ color: "#fff", fontWeight: 700 }}>SKU:</span> {product.sku}</p>}
              {product.category && <p><span style={{ color: "#fff", fontWeight: 700 }}>Categories:</span> {product.category}</p>}
            </div>
          )}

          {/* Accordion Sections */}
          <div className={`mt-6 divide-y overflow-hidden ${isV18 ? 'divide-[#333] border-y border-[#333]' : 'divide-border border border-border rounded-xl'}`}>
            {product.description && (
              <AccordionItem
                title={isV18 ? "Description" : "Product Description"}
                icon={isV18 ? undefined : <Package className="h-3.5 w-3.5 text-primary" />}
                isOpen={openAccordion === "description"}
                onToggle={() => toggleAccordion("description")}
                isV18={isV18}
              >
                <p className={`leading-relaxed text-sm whitespace-pre-line ${isV18 ? '' : 'text-muted-foreground'}`} style={isV18 ? { color: "#999", ...v18Font } : {}}>
                  {product.description}
                </p>
              </AccordionItem>
            )}
            <AccordionItem
              title={isV18 ? "Reviews" : "Shipping Information"}
              icon={isV18 ? undefined : <Truck className="h-3.5 w-3.5 text-primary" />}
              isOpen={openAccordion === (isV18 ? "reviews" : "shipping")}
              onToggle={() => toggleAccordion(isV18 ? "reviews" : "shipping")}
              isV18={isV18}
            >
              {isV18 ? (
                <p className="text-sm" style={{ color: "#999", ...v18Font }}>Customer reviews will appear here.</p>
              ) : (
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  <li>• Standard delivery: 3-7 business days</li>
                  <li>• Express delivery available at checkout</li>
                  <li>• Free shipping on all orders</li>
                  <li>• Order tracking provided via SMS/email</li>
                </ul>
              )}
            </AccordionItem>
            {!isV18 && (
              <AccordionItem
                title="Returns & Exchange"
                icon={<RotateCcw className="h-3.5 w-3.5 text-primary" />}
                isOpen={openAccordion === "returns"}
                onToggle={() => toggleAccordion("returns")}
              >
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  <li>• 7-day easy return policy</li>
                  <li>• Product must be unused and in original packaging</li>
                  <li>• Refund processed within 5-7 business days</li>
                </ul>
              </AccordionItem>
            )}
          </div>

        </div>
      </div>


      <div className="px-4 sm:px-0">
        {/* Complete the Look — deferred until near viewport */}
        <DeferUntilVisible rootMargin="600px" minHeight={320}>
          <Suspense fallback={null}>
            <RelatedProducts
              storeId={store.id}
              storeSlug={store.slug}
              currentProductId={product.id}
              currentCategory={product.category}
              store={store}
              addToCart={addToCart}
              currency={currency}
            />
          </Suspense>
        </DeferUntilVisible>

        {/* Customer Reviews — deferred until near viewport */}
        <DeferUntilVisible rootMargin="600px" minHeight={240}>
          <Suspense fallback={null}>
            <CustomerReviews reviews={fakeReviews} realReviews={realReviews || []} rating={stats.rating} reviewCount={stats.reviewCount} productId={product.id} storeId={store.id} onReviewSubmitted={refetchReviews} />
          </Suspense>
        </DeferUntilVisible>
      </div>

      {/* Portal: render fixed elements outside PageTransition animation container */}
      {createPortal(
        <>
          {/* Social proof notification — above sticky bar on mobile */}
          {/* Recent purchase social-proof popup removed per user request */}

          {/* Sticky CTA bar — visible on ALL screens when inline CTA scrolls out (hidden for Theme 18) */}
          {!isOutOfStock && (store as any)?.theme !== "theme-18" && (
            <div
              className={`fixed left-0 right-0 bottom-0 z-50 border-t border-border bg-card/95 backdrop-blur-md transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                stickyBarVisible ? "translate-y-0" : "translate-y-full"
              }`}
              style={{
                paddingBottom: "env(safe-area-inset-bottom)",
                fontFamily: "var(--storefront-body-font, inherit)",
              }}
            >
              <div className="mx-auto max-w-6xl p-3">
                <div className="flex items-center gap-3">
                  {/* Product info — desktop only */}
                  <div className="hidden sm:flex items-center gap-3 flex-1 min-w-0">
                    {product.image_url && (
                      <img
                        src={optimizeImageUrl(product.image_url, 40)}
                        alt=""
                        className="h-10 w-10 rounded-lg object-cover"
                      />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate" style={{ fontFamily: "var(--storefront-heading-font, inherit)" }}>{product.name}</p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-extrabold text-foreground" style={{ fontFamily: "var(--storefront-heading-font, inherit)" }}>{formatPrice((variantPrice * quantity), currency)}</span>
                        {hasDiscount && (
                          <span className="text-[10px] text-emerald-600 font-semibold">{discountPct}% OFF</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Mobile price */}
                  <div className="flex sm:hidden flex-col items-start shrink-0 min-w-0 leading-tight">
                    <p className="text-sm font-extrabold text-foreground whitespace-nowrap" style={{ fontFamily: "var(--storefront-heading-font, inherit)" }}>
                      {formatPrice((variantPrice * quantity), currency)}
                    </p>
                    {hasDiscount && discountPct > 0 && (
                      <div className="flex items-center gap-1 -mt-0.5">
                        <span className="text-[10px] text-muted-foreground line-through whitespace-nowrap">
                          {formatPrice((Number(product.price) * quantity), currency)}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-600 whitespace-nowrap">{discountPct}% OFF</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 sm:flex-none gap-2">
                    <button
                      className={`btn-press flex h-10 sm:h-11 flex-1 sm:flex-none sm:px-8 items-center justify-center gap-1.5 rounded-xl text-[11px] sm:text-xs font-semibold uppercase tracking-wider transition-all ${
                        justAdded ? "bg-emerald-600 text-white" : "btn-gold"
                      }`}
                      style={{ fontFamily: "var(--storefront-heading-font, inherit)" }}
                      onClick={handleAddToCart}
                    >
                      {justAdded ? (
                        <span className="flex items-center gap-1 animate-fade-in">
                          <Check className="h-3.5 w-3.5" strokeWidth={3} />
                          Added!
                        </span>
                      ) : (
                        <>
                          <ShoppingCart className="h-3.5 w-3.5" />
                          {bilingualCta ? "Add / जोड़ें" : "Add to Cart"}
                        </>
                      )}
                    </button>
                    <button
                      className="btn-press flex h-10 sm:h-11 flex-1 sm:flex-none sm:px-8 items-center justify-center gap-2 rounded-xl text-[11px] sm:text-xs font-semibold uppercase tracking-wider transition-all"
                      style={{ backgroundColor: "var(--storefront-accent, hsl(var(--primary)))", color: "var(--storefront-btn-text, hsl(var(--primary-foreground)))", fontFamily: "var(--storefront-heading-font, inherit)" }}
                      onClick={handleBuyNow}
                    >
                      <span className="flex items-center gap-1.5">
                        <ShoppingBag className="h-3.5 w-3.5" />
                        {bilingualCta ? "Buy / खरीदें" : "Buy Now"}
                      </span>
                      <span className="flex items-center -space-x-1">
                        <img src="/icons/gpay-round.webp" alt="GPay" width={14} height={14} loading="lazy" decoding="async" className="h-3.5 w-3.5 rounded-full ring-1 ring-white bg-white object-contain" />
                        <img src="/icons/phonepe-round.webp" alt="PhonePe" width={14} height={14} loading="lazy" decoding="async" className="h-3.5 w-3.5 rounded-full ring-1 ring-white bg-white object-contain" />
                        <img src="/icons/paytm-round.webp" alt="Paytm" width={14} height={14} loading="lazy" decoding="async" className="h-3.5 w-3.5 rounded-full ring-1 ring-white bg-white object-contain" />
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Express Checkout Sticky Bar for returning users */}
          {!isOutOfStock && showBuyNow && (() => {
            try {
              const saved = JSON.parse(localStorage.getItem(`express_checkout_${store.id}`) || "{}");
              if (saved.fullName && saved.phone && saved.streetAddress && saved.pincode) {
                return (
                  <div className="fixed bottom-0 left-0 right-0 z-50 sm:hidden bg-card/95 backdrop-blur-lg border-t border-border px-4 py-3 safe-area-bottom">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-muted-foreground truncate">
                          <Zap className="inline h-3 w-3 text-warning mr-0.5" />
                          Deliver to <strong className="text-foreground">{saved.fullName}</strong> · {saved.pincode}
                        </p>
                        <p className="text-lg font-extrabold text-foreground">{formatPrice((variantPrice * quantity), currency)}</p>
                      </div>
                      <button
                        onClick={() => {
                          if (hasVariants && !selectedVariant) {
                            toast.error("Please select a variant first"); setVariantPromptOpen(true);
                            document.getElementById("variant-picker")?.scrollIntoView({ behavior: "smooth", block: "center" });
                            return;
                          }
                          navigate(storefrontPath(store.slug, `checkout?product=${product.id}${selectedVariant ? `&variant=${selectedVariant.id}` : ""}`));
                        }}
                        className="flex h-12 items-center gap-2 rounded-xl px-5 text-xs font-extrabold uppercase tracking-wider transition-all active:scale-[0.97]"
                        style={{ backgroundColor: "var(--storefront-primary, hsl(var(--primary)))", color: "var(--storefront-bg, hsl(var(--primary-foreground)))" }}
                      >
                        <Zap className="h-4 w-4" />
                        Express Buy
                      </button>
                    </div>
                  </div>
                );
              }
            } catch {}
            return null;
          })()}

        </>,
        document.body
      )}

      {/* Theme 16 / 21 Buy Now Phone Modal */}
      {((store as any).theme === "theme-16" || (store as any).theme === "theme-21") && (
        <Suspense fallback={null}>
          <BuyNowPhoneModal
            open={buyNowModalOpen}
            onOpenChange={setBuyNowModalOpen}
            storeSlug={store.slug}
            storeId={store.id}
            productId={product?.id}
            productName={product?.name}
            source="quick_buy_pdp"
          />
        </Suspense>
      )}

      {/* Variant required prompt */}
      <Dialog open={variantPromptOpen} onOpenChange={setVariantPromptOpen}>
        <DialogContent className="max-w-sm z-[200]">
          <DialogHeader>
            <DialogTitle className="text-lg">Please select a variant</DialogTitle>
            <DialogDescription>
              Choose an option (size / pack / color) before continuing.
            </DialogDescription>
          </DialogHeader>
          {hasVariants && (
            <div className="flex flex-wrap gap-2 pt-2">
              {(variants || []).map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    setSelectedVariant(v);
                    setVariantPromptOpen(false);
                  }}
                  className="rounded-xl border-2 border-border px-4 py-2.5 text-sm font-bold hover:border-primary hover:bg-primary/10 transition-all"
                >
                  {v.name}
                </button>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setVariantPromptOpen(false);
                setTimeout(() => {
                  document.getElementById("variant-picker")?.scrollIntoView({ behavior: "smooth", block: "center" });
                }, 100);
              }}
            >
              Go to options
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── CRO #5: Countdown Timer Component ── */
function CountdownTimer({ productId }: { productId: string }) {
  const seed = useMemo(() => getCountdownSeed(productId), [productId]);
  const [timeLeft, setTimeLeft] = useState(() => {
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    const remainMs = endOfDay.getTime() - now.getTime();
    const totalSec = Math.floor(remainMs / 1000);
    const h = Math.min(seed.hours, Math.floor(totalSec / 3600));
    const m = Math.min(seed.minutes, Math.floor((totalSec % 3600) / 60));
    const s = totalSec % 60;
    return { hours: h, minutes: m, seconds: s };
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        const totalSec = prev.hours * 3600 + prev.minutes * 60 + prev.seconds - 1;
        if (totalSec <= 0) return { hours: seed.hours, minutes: seed.minutes, seconds: 0 };
        return {
          hours: Math.floor(totalSec / 3600),
          minutes: Math.floor((totalSec % 3600) / 60),
          seconds: totalSec % 60,
        };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [seed]);

  return (
    <div className="mt-2.5 flex items-center gap-2 rounded-lg px-3 py-1.5" style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.08), rgba(239,68,68,0.06))", border: "1px solid rgba(245,158,11,0.2)" }}>
      <Timer className="h-3.5 w-3.5 text-amber-600 animate-pulse" />
      <span className="text-[11px] font-bold text-amber-700">Offer ends in</span>
      <div className="flex items-center gap-0.5">
        {[
          { val: timeLeft.hours, label: "h" },
          { val: timeLeft.minutes, label: "m" },
          { val: timeLeft.seconds, label: "s" },
        ].map((t, i) => (
          <span key={i} className="flex items-center gap-0.5">
            {i > 0 && <span className="text-[10px] font-bold text-amber-500 mx-0.5">:</span>}
            <span className="inline-flex min-w-[26px] items-center justify-center rounded bg-gradient-to-b from-amber-500 to-orange-600 px-1 py-0.5 text-[10px] font-extrabold text-white tabular-nums">
              {String(t.val).padStart(2, "0")}{t.label}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Inline countdown for trust block ── */
function CountdownTimerInline({ productId }: { productId: string }) {
  const seed = useMemo(() => getCountdownSeed(productId), [productId]);
  const [timeLeft, setTimeLeft] = useState(() => {
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    const remainMs = endOfDay.getTime() - now.getTime();
    const totalSec = Math.floor(remainMs / 1000);
    const h = Math.min(seed.hours, Math.floor(totalSec / 3600));
    const m = Math.min(seed.minutes, Math.floor((totalSec % 3600) / 60));
    const s = totalSec % 60;
    return { hours: h, minutes: m, seconds: s };
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        const totalSec = prev.hours * 3600 + prev.minutes * 60 + prev.seconds - 1;
        if (totalSec <= 0) return { hours: seed.hours, minutes: seed.minutes, seconds: 0 };
        return {
          hours: Math.floor(totalSec / 3600),
          minutes: Math.floor((totalSec % 3600) / 60),
          seconds: totalSec % 60,
        };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [seed]);

  return (
    <span className="text-xs font-semibold text-foreground">
      Offer ends in{" "}
      <span className="font-bold text-amber-600 tabular-nums">
        {String(timeLeft.hours).padStart(2, "0")}h : {String(timeLeft.minutes).padStart(2, "0")}m : {String(timeLeft.seconds).padStart(2, "0")}s
      </span>
    </span>
  );
}

/* ── Real Payment Logos ── */
function RealPaymentLogos() {
  return (
    <div className="flex items-center justify-center gap-1.5 flex-wrap">
      <div className="flex h-7 w-11 items-center justify-center rounded border border-border bg-white">
        <svg viewBox="0 0 256 83" className="h-3.5 w-7"><path d="M132.916 2.214l-14.08 53.896h-15.07L118.06 2.214h14.856zm60.166 34.79l7.928-21.86 4.562 21.86h-12.49zm16.81 19.106h13.926L211.36 2.214h-12.854c-2.894 0-5.336 1.682-6.42 4.27L170.98 56.11h14.94l2.968-8.2h18.244l1.722 8.2h-.002zm-37.164-17.588c.062-14.134-19.548-14.912-19.412-21.224.042-1.92 1.872-3.966 5.876-4.486 1.988-.26 7.472-.46 13.694 2.4l2.438-11.386C171.668 2.614 167.09 1.47 161.482 1.47c-14.066 0-23.964 7.478-24.044 18.178-.088 7.918 7.066 12.332 12.454 14.966 5.538 2.696 7.398 4.426 7.376 6.836-.04 3.694-4.42 5.324-8.508 5.388-7.148.11-11.296-1.932-14.604-3.474l-2.576 12.042c3.32 1.526 9.456 2.858 15.818 2.924 14.94 0 24.72-7.38 24.766-18.824l.004-.002zm-58.96-36.308L97.834 56.11H82.71L66.994 14.872c-.956-3.752-1.786-5.132-4.688-6.716C58.086 5.786 51.4 3.532 45.46 2.12L45.8 2.214h24.14c3.444 0 6.538 2.294 7.326 6.262l5.978 31.758 14.762-38.02h14.762z" fill="#1A1F71"/></svg>
      </div>
      <div className="flex h-7 w-11 items-center justify-center rounded border border-border bg-white">
        <svg viewBox="0 0 48 32" className="h-4 w-7"><circle cx="19" cy="16" r="10" fill="#EB001B"/><circle cx="29" cy="16" r="10" fill="#F79E1B"/><path d="M24 8.6a10 10 0 010 14.8 10 10 0 000-14.8z" fill="#FF5F00"/></svg>
      </div>
      <div className="flex h-7 w-11 items-center justify-center rounded border border-border bg-white overflow-hidden px-0.5">
        <img src="/icons/gpay.svg" alt="Google Pay" className="h-4 object-contain" />
      </div>
      <div className="flex h-7 w-11 items-center justify-center rounded border border-border bg-white overflow-hidden">
        <img src="/icons/phonepe.png" alt="PhonePe" className="h-5 object-contain" />
      </div>
      <div className="flex h-7 w-11 items-center justify-center rounded border border-border bg-white overflow-hidden">
        <img src="/icons/upi.png" alt="UPI" className="h-4 object-contain" />
      </div>
    </div>
  );
}



/* ── Accordion Item ── */
function AccordionItem({
  title,
  icon,
  isOpen,
  onToggle,
  children,
  isV18,
}: {
  title: string;
  icon?: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  isV18?: boolean;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className={`flex w-full items-center justify-between px-4 py-3 text-sm font-bold transition-colors ${isV18 ? 'hover:bg-white/5' : 'text-foreground hover:bg-accent/30'}`}
        style={isV18 ? { color: "#ffffff", fontFamily: "var(--storefront-heading-font, 'Alegreya SC'), serif" } : {}}
      >
        <span className="flex items-center gap-2">{icon}{title}</span>
        {isV18 ? (
          <Plus className={`h-4 w-4 transition-transform duration-200 ${isOpen ? "rotate-45" : ""}`} style={{ color: "#ffffff" }} />
        ) : (
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
        )}
      </button>
      {isOpen && (
        <div className="px-4 pb-3 animate-in slide-in-from-top-1 duration-200">
          {children}
        </div>
      )}
    </div>
  );
}



/* ── Share Buttons ── */
function ShareButtons({ productName, storeSlug, productSlugOrId }: { productName: string; storeSlug: string; productSlugOrId: string }) {
  const shareUrl = `https://${storeSlug}.shopbanao.in/product/${productSlugOrId}`;
  const text = `Check out ${productName}!`;
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(shareUrl); toast.success("Link copied!"); } catch { toast.error("Failed to copy"); }
  };

  return (
    <div className="mt-6 flex items-center gap-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Share</span>
      <Button variant="outline" size="icon" className="h-8 w-8" onClick={copyLink} title="Copy link"><Copy className="h-3.5 w-3.5" /></Button>
      <Button variant="outline" size="icon" className="h-8 w-8" asChild title="Share on WhatsApp">
        <a href={`https://wa.me/?text=${encodeURIComponent(text + " " + shareUrl)}`} target="_blank" rel="noopener noreferrer">
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 0 1-4.243-1.213l-.304-.181-2.868.852.852-2.868-.181-.304A8 8 0 1 1 12 20z"/></svg>
        </a>
      </Button>
      <Button variant="outline" size="icon" className="h-8 w-8" asChild title="Share on Facebook"><a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener noreferrer"><Facebook className="h-3.5 w-3.5" /></a></Button>
      <Button variant="outline" size="icon" className="h-8 w-8" asChild title="Share on X"><a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer"><Twitter className="h-3.5 w-3.5" /></a></Button>
    </div>
  );
}

/* ── Image Gallery with Zoom Icon + Dots Inside Image ── */
function ImageGallery({ images, productName, hasDiscount, discountPct, onShare }: { images: string[]; productName: string; hasDiscount: number | boolean | null; discountPct: number; onShare?: () => void }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [imageLoaded, setImageLoaded] = useState<Record<number, boolean>>({});
  const len = images.length;
  const canLoop = len > 1;

  const [emblaRef, embla] = useEmblaCarousel({
    loop: canLoop,
    align: "center",
    skipSnaps: false,
    dragFree: false,
    duration: 22,
  });

  // Sync activeIndex with Embla
  useEffect(() => {
    if (!embla) return;
    const onSelect = () => setActiveIndex(embla.selectedScrollSnap());
    embla.on("select", onSelect);
    embla.on("reInit", onSelect);
    onSelect();
    return () => {
      embla.off("select", onSelect);
      embla.off("reInit", onSelect);
    };
  }, [embla]);

  // Re-init on image-list change — only reset loaded state when URLs actually change
  const imagesKey = images.join("|");
  useEffect(() => {
    if (embla) embla.reInit();
    setImageLoaded({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imagesKey, embla]);

  // Smart preload: only active + 2 neighbours (handles big galleries)
  useEffect(() => {
    if (len === 0) return;
    const want = new Set<number>([activeIndex]);
    if (len > 1) {
      want.add((activeIndex + 1) % len);
      want.add((activeIndex - 1 + len) % len);
    }
    want.forEach((idx) => {
      if (imageLoaded[idx]) return;
      const img = new Image();
      img.onload = () => setImageLoaded((prev) => (prev[idx] ? prev : { ...prev, [idx]: true }));
      img.src = optimizeImageUrl(images[idx], 800);
    });
  }, [activeIndex, imagesKey, len, imageLoaded]);

  const scrollTo = useCallback((i: number) => embla?.scrollTo(i), [embla]);
  const scrollPrev = useCallback(() => embla?.scrollPrev(), [embla]);
  const scrollNext = useCallback(() => embla?.scrollNext(), [embla]);

  if (len === 0) {
    return (
      <div className="overflow-hidden rounded-2xl bg-accent">
        <div className="flex aspect-[3/4] sm:aspect-square w-full items-center justify-center">
          <Package className="h-16 w-16 text-muted-foreground/30" />
        </div>
      </div>
    );
  }

  // For single-image products, render a fake 2-slide loop so user can still swipe and see same image cycle
  const renderImages = len === 1 ? [images[0], images[0]] : images;

  return (
    <>
      <div className="space-y-1 sm:space-y-2 lg:sticky lg:top-4">
        <div className="relative -mx-4 sm:mx-0 px-2 pt-2 pb-1 sm:p-0">
          {/* Discount badge */}
          {hasDiscount && discountPct > 0 && (
            <div className="absolute left-3 top-3 z-10">
              <Badge className="bg-emerald-600 text-white text-[11px] font-bold border-0 shadow-lg px-2 py-0.5">
                -{discountPct}%
              </Badge>
            </div>
          )}

          {/* Share button */}
          {onShare && (
            <button
              onClick={(e) => { e.stopPropagation(); onShare(); }}
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm text-white shadow-lg transition-all hover:bg-black/70 active:scale-90"
              aria-label="Share product"
            >
              <Share2 className="h-4 w-4" />
            </button>
          )}

          {/* Embla viewport */}
          <div
            ref={emblaRef}
            className="overflow-hidden rounded-none sm:rounded-2xl bg-background cursor-zoom-in select-none"
          >
            <div className="flex touch-pan-y">
              {renderImages.map((src, i) => {
                const realIdx = len === 1 ? 0 : i;
                const loaded = imageLoaded[realIdx];
                return (
                  <div
                    key={`${i}-${src}`}
                    className="relative flex-[0_0_100%] min-w-0"
                    onClick={() => setLightboxOpen(true)}
                  >
                    {!loaded && <Skeleton className="aspect-[4/5] sm:aspect-square w-full rounded-none" />}
                    <img
                      src={optimizeImageUrl(src, 800)}
                      alt={productName}
                      className={`w-full h-auto max-h-[80vh] object-contain bg-muted/30 transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0 absolute inset-0'}`}
                      decoding="async"
                      fetchPriority={realIdx === 0 ? "high" : "auto"}
                      draggable={false}
                      ref={(el) => {
                        if (el && el.complete && el.naturalWidth > 0 && !imageLoaded[realIdx]) {
                          setImageLoaded((prev) => (prev[realIdx] ? prev : { ...prev, [realIdx]: true }));
                          embla?.reInit();
                        }
                      }}
                      onLoad={() => {
                        setImageLoaded((prev) => (prev[realIdx] ? prev : { ...prev, [realIdx]: true }));
                        embla?.reInit();
                      }}
                      onError={() => setImageLoaded((prev) => (prev[realIdx] ? prev : { ...prev, [realIdx]: true }))}
                    />

                  </div>
                );
              })}
            </div>
          </div>

          {/* Zoom/enlarge icon */}
          <button
            onClick={(e) => { e.stopPropagation(); setLightboxOpen(true); }}
            className="absolute bottom-3 left-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm text-white shadow-lg transition-all hover:bg-black/70 active:scale-90"
            aria-label="Enlarge image"
          >
            <Maximize2 className="h-4 w-4" />
          </button>

          {/* Counter (mobile) */}
          {len > 1 && (
            <div className="absolute bottom-3 right-3 z-10 sm:hidden rounded-full bg-black/50 backdrop-blur-sm px-2.5 py-1 text-[10px] font-bold text-white tabular-nums">
              {activeIndex + 1}/{len}
            </div>
          )}

          {/* Dots */}
          {len > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex gap-1.5 rounded-full bg-black/30 backdrop-blur-sm px-2.5 py-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); scrollTo(i); }}
                  className={`rounded-full transition-all duration-300 ${
                    i === activeIndex ? "w-5 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/50 hover:bg-white/70"
                  }`}
                  aria-label={`View image ${i + 1}`}
                />
              ))}
            </div>
          )}

          {/* Desktop arrows */}
          {len > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); scrollPrev(); }}
                className="absolute left-2 top-1/2 -translate-y-1/2 hidden sm:flex rounded-full bg-white/80 p-1.5 shadow backdrop-blur-sm hover:bg-white transition-all"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); scrollNext(); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 hidden sm:flex rounded-full bg-white/80 p-1.5 shadow backdrop-blur-sm hover:bg-white transition-all"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}
        </div>

        {/* Thumbnail strip — desktop only */}
        {len > 1 && (
          <div className="hidden sm:flex gap-2 overflow-x-auto scrollbar-hide px-0.5 py-1">
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => scrollTo(i)}
                className={`h-14 w-14 sm:h-16 sm:w-16 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                  i === activeIndex ? "border-primary ring-2 ring-primary/20" : "border-transparent hover:border-muted-foreground/30"
                }`}
              >
                <img src={optimizeImageUrl(img, 120)} alt="" className="h-full w-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </div>

      {lightboxOpen && createPortal(
        <FullscreenLightbox
          images={images}
          productName={productName}
          initialIndex={activeIndex}
          onClose={() => setLightboxOpen(false)}
        />,
        document.body
      )}
    </>
  );
}

/* ── Lightbox image with optimized URL + raw fallback + loading state ── */
function LightboxImage({
  src,
  alt,
  translate,
  scale,
}: {
  src: string;
  alt: string;
  translate: { x: number; y: number };
  scale: number;
}) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const [useRaw, setUseRaw] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setErrored(false);
    setUseRaw(false);
  }, [src]);

  // First try the optimized URL (matches the gallery thumbs that we know load).
  // If the optimizer URL fails (CDN hiccup / unsupported source), fall back to the raw URL.
  const displaySrc = useRaw ? src : optimizeImageUrl(src, 1600, 92);

  return (
    <>
      {!loaded && !errored && (
        <div className="absolute inset-0 flex items-center justify-center text-white/60 text-sm">
          Loading…
        </div>
      )}
      {errored && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-neutral-600 text-sm px-6 text-center">
          <span>Image couldn't be loaded.</span>
          <span className="text-xs opacity-60 break-all">{src}</span>
        </div>
      )}
      <img
        src={displaySrc}
        alt={alt}
        className="absolute inset-0 m-auto max-h-full max-w-full w-auto h-auto object-contain transition-transform duration-100"
        style={{
          transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
          opacity: loaded ? 1 : 0,
        }}
        draggable={false}
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (!useRaw) {
            // optimizer failed → retry with raw original URL
            setUseRaw(true);
          } else {
            setErrored(true);
          }
        }}
      />
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

  const handleDoubleClick = () => {
    if (scale > 1) { resetZoom(); } else { setScale(2.5); setTranslate({ x: 0, y: 0 }); }
  };

  const swipeStart = useRef<number | null>(null);
  const handleSwipeStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && scale <= 1) swipeStart.current = e.touches[0].clientX;
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
    <div className="fixed inset-0 z-[9999] flex flex-col bg-black animate-in fade-in duration-200" role="dialog" aria-modal="true">
      <div className="flex items-center justify-between px-4 py-3 text-white bg-black">
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

      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden bg-black touch-none select-none p-0 sm:p-4"
        onTouchStart={(e) => { handleTouchStart(e); handleSwipeStart(e); }}
        onTouchMove={handleTouchMove}
        onTouchEnd={(e) => { handleTouchEnd(); handleSwipeEnd(e); }}
        onDoubleClick={handleDoubleClick}
        style={{ cursor: scale > 1 ? "grab" : "default" }}
      >
        <div className="relative flex items-center justify-center w-full h-full overflow-hidden bg-black">
          <LightboxImage
            src={images[activeIndex]}
            alt={productName}
            translate={translate}
            scale={scale}
          />
        </div>
      </div>

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

      {images.length > 1 && (
        <div className="flex justify-center gap-2 px-4 py-3">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => { setActiveIndex(i); resetZoom(); }}
              className={`rounded-full transition-all duration-300 ${
                i === activeIndex ? "w-6 h-2 bg-white" : "w-2 h-2 bg-white/40 hover:bg-white/60"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}


/* ── Product Detail Skeleton ── */
export function ProductDetailSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Skeleton className="mb-4 h-4 w-48" />
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-3">
          <Skeleton className="aspect-square w-full rounded-2xl" />
          <div className="flex justify-center gap-1.5 sm:hidden">
            {[1, 2, 3].map((i) => (<Skeleton key={i} className="h-2 w-2 rounded-full" />))}
          </div>
          <div className="hidden sm:flex gap-2">
            {[1, 2, 3].map((i) => (<Skeleton key={i} className="h-16 w-16 rounded-lg" />))}
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-4 w-48" />
          <div className="mt-4 space-y-2">
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
