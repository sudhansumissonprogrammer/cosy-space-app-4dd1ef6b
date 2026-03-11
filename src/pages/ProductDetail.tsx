import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, Link, useOutletContext, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft, Package, ChevronLeft, ChevronRight, ShoppingBag, ShoppingCart,
  Share2, Copy, Facebook, Twitter, X, ZoomIn, Star, Shield, Truck, RotateCcw,
  Clock, Eye, Flame, Heart, Minus, Plus, Check, ChevronDown, CreditCard, ThumbsUp
} from "lucide-react";
import { toast } from "sonner";
import { useMetaTags } from "@/hooks/useMetaTags";
import { useProductJsonLd } from "@/hooks/useJsonLd";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
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

/* ── Fake but consistent social proof from product ID ── */
function getProductStats(productId: string) {
  let hash = 0;
  for (let i = 0; i < productId.length; i++) {
    hash = ((hash << 5) - hash) + productId.charCodeAt(i);
    hash |= 0;
  }
  const abs = Math.abs(hash);
  const ratings = [4.2, 4.3, 4.4, 4.5, 4.5, 4.6, 4.6, 4.7, 4.7, 4.8, 4.8, 4.9];
  const rating = ratings[abs % ratings.length];
  const reviewCount = 12 + (abs % 188);
  const viewers = 3 + (abs % 18);
  const soldRecently = 15 + (abs % 85);
  return { rating, reviewCount, viewers, soldRecently };
}

function getDeliveryDate() {
  const d = new Date();
  d.setDate(d.getDate() + 3 + Math.floor(Math.random() * 3));
  return d.toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" });
}

/* ── Fake customer reviews ── */
const reviewerNames = [
  "Priya S.", "Rahul M.", "Anita K.", "Vikram R.", "Sneha D.",
  "Arjun P.", "Meera T.", "Karthik N.", "Divya L.", "Amit B.",
  "Pooja G.", "Rohit V.", "Swati J.", "Nikhil W.", "Kavita C.",
];
const reviewTexts = [
  "Absolutely love this product! Quality exceeded my expectations. Will definitely buy again. 🙌",
  "Great value for money. Arrived well-packed and exactly as described. Highly recommended!",
  "Perfect fit and premium quality material. My friends keep asking where I got it from! ⭐",
  "Fast delivery and amazing quality. This is now my go-to store for shopping.",
  "Superb product! The color and quality are just as shown in the photos. Very happy with my purchase.",
  "Ordered this for my sister's birthday — she loved it! Great packaging too. 🎁",
  "Better than expected. The attention to detail is impressive. Five stars from me!",
  "This is my third order from this store. Never disappointed. Excellent customer service too.",
  "Wow, the quality is top-notch! Feels very premium. Will be ordering more for sure.",
  "Received it in just 3 days. Product is exactly as shown. Very satisfied customer here! 😊",
];
const reviewDaysAgo = [1, 2, 3, 5, 7, 10, 12, 14, 18, 21, 25, 30];

function getFakeReviews(productId: string) {
  let hash = 0;
  for (let i = 0; i < productId.length; i++) {
    hash = ((hash << 5) - hash) + productId.charCodeAt(i);
    hash |= 0;
  }
  const abs = Math.abs(hash);
  const count = 3 + (abs % 3); // 3-5 reviews
  const reviews = [];
  for (let i = 0; i < count; i++) {
    const idx = (abs + i * 7) % reviewerNames.length;
    const textIdx = (abs + i * 13) % reviewTexts.length;
    const daysIdx = (abs + i * 3) % reviewDaysAgo.length;
    const rating = 4 + ((abs + i) % 2); // 4 or 5 stars
    reviews.push({
      id: `review-${i}`,
      name: reviewerNames[idx],
      rating,
      text: reviewTexts[textIdx],
      daysAgo: reviewDaysAgo[daysIdx],
      verified: true,
      helpful: 2 + ((abs + i * 5) % 15),
      avatar: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(reviewerNames[idx])}&backgroundColor=c0aede,d1d4f9,b6e3f4,ffd5dc,ffdfbf`,
    });
  }
  return reviews;
}

export default function ProductDetail() {
  const store = useOutletContext<StoreData>();
  const { productSlug } = useParams<{ productSlug: string }>();
  const navigate = useNavigate();
  const { addToCart, items } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const queryClient = useQueryClient();

  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const [cartBounce, setCartBounce] = useState(false);
  const [openAccordion, setOpenAccordion] = useState<string | null>("description");

  const deliveryDate = useMemo(() => getDeliveryDate(), []);

  const getCachedProduct = () => {
    const cached = queryClient.getQueryData<any[]>(["storefront-products", store.id]);
    if (!cached) return undefined;
    return cached.find((p: any) => p.slug === productSlug || p.id === productSlug) || undefined;
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
  const discountPct = hasDiscount
    ? Math.round(((product.price - product.sale_price!) / product.price) * 100)
    : 0;
  const currency = product.currency || "USD";
  const basePrice = hasDiscount ? product.sale_price! : product.price;
  const variantPrice = selectedVariant?.price ?? basePrice;
  const orderMode = (store as any).order_mode || "whatsapp";
  const showWhatsApp = orderMode === "whatsapp" || orderMode === "both";
  const showBuyNow = orderMode === "website" || orderMode === "both";
  const stats = getProductStats(product.id);
  const wishlisted = isWishlisted(product.id);
  const isLowStock = product.stock_quantity > 0 && product.stock_quantity <= 10;
  const isOutOfStock = product.stock_quantity <= 0;
  const fakeReviews = useMemo(() => getFakeReviews(product.id), [product.id]);

  const handleAddToCart = () => {
    addToCart({
      productId: product.id,
      variantId: selectedVariant?.id,
      name: product.name,
      variantName: selectedVariant?.name,
      price: variantPrice,
      image: product.image_url || undefined,
      quantity,
    });
    setJustAdded(true);
    setCartBounce(true);
    toast.success(`${product.name} added to cart`);
    setTimeout(() => setJustAdded(false), 1500);
    setTimeout(() => setCartBounce(false), 600);
  };

  const handleBuyNow = () => {
    addToCart({
      productId: product.id,
      variantId: selectedVariant?.id,
      name: product.name,
      variantName: selectedVariant?.name,
      price: variantPrice,
      image: product.image_url || undefined,
      quantity,
    });
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
    toast.success(wishlisted ? "Removed from wishlist" : "Added to wishlist");
  };

  const toggleAccordion = (key: string) => {
    setOpenAccordion(openAccordion === key ? null : key);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-4 sm:py-8">
      {/* Breadcrumb */}
      <nav className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link to={storefrontPath(store.slug)} className="hover:text-primary transition-colors">
          Home
        </Link>
        <span>/</span>
        {product.category && (
          <>
            <Link to={storefrontPath(store.slug, `category/${product.category}`)} className="hover:text-primary transition-colors">
              {product.category}
            </Link>
            <span>/</span>
          </>
        )}
        <span className="text-foreground font-medium line-clamp-1">{product.name}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-2 lg:gap-10">
        {/* Image Gallery */}
        <ImageGallery images={allImages} productName={product.name} hasDiscount={hasDiscount} discountPct={discountPct} />

        {/* Product Info */}
        <div className="flex flex-col">
          {/* Category badge */}
          {product.category && (
            <Badge variant="secondary" className="mb-2 w-fit text-[10px] uppercase tracking-wider font-bold">
              {product.category}
            </Badge>
          )}

          {/* Title */}
          <h1 className="text-2xl font-bold text-foreground leading-tight sm:text-3xl">{product.name}</h1>

          {/* Rating & Social Proof */}
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`h-3.5 w-3.5 ${i < Math.floor(stats.rating) ? "fill-amber-400 text-amber-400" : i < stats.rating ? "fill-amber-400/50 text-amber-400" : "text-muted-foreground/30"}`}
                />
              ))}
              <span className="ml-1 text-sm font-bold text-foreground">{stats.rating}</span>
            </div>
            <span className="text-[10px] text-muted-foreground">|</span>
            <span className="text-xs text-success font-semibold flex items-center gap-1">
              <Flame className="h-3 w-3" /> {stats.soldRecently}+ sold recently
            </span>
          </div>

          {/* Price Block */}
          <div className="mt-4 rounded-xl bg-accent/50 p-3 sm:p-4">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-3xl font-extrabold text-foreground sm:text-4xl">
                {currency} {Number(variantPrice).toFixed(2)}
              </span>
              {hasDiscount && (
                <>
                  <span className="text-base text-muted-foreground line-through">
                    {currency} {Number(product.price).toFixed(2)}
                  </span>
                  <Badge className="bg-success text-success-foreground text-xs font-bold border-0">
                    {discountPct}% OFF
                  </Badge>
                </>
              )}
            </div>
            {hasDiscount && (
              <p className="mt-1 text-xs font-semibold text-success">
                You save {currency} {(product.price - product.sale_price!).toFixed(2)} on this order
              </p>
            )}
            <p className="mt-1 text-[10px] text-muted-foreground">Inclusive of all taxes</p>
          </div>

          {/* Live viewers */}
          <div className="mt-3 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
            </span>
            <span className="text-xs text-muted-foreground">
              <Eye className="inline h-3 w-3 mr-0.5" />
              <strong className="text-foreground">{stats.viewers} people</strong> viewing this right now
            </span>
          </div>

          {/* Stock Status */}
          {isOutOfStock ? (
            <div className="mt-3 rounded-lg bg-destructive/10 px-3 py-2">
              <p className="text-sm font-bold text-destructive">Out of Stock</p>
            </div>
          ) : isLowStock ? (
            <div className="mt-3 rounded-lg bg-warning/10 px-3 py-2 flex items-center gap-2">
              <Clock className="h-4 w-4 text-warning" />
              <p className="text-sm font-semibold text-warning">
                Hurry! Only {product.stock_quantity} left in stock
              </p>
            </div>
          ) : null}

          {/* Variant Selector — Visual Swatches */}
          {(variants || []).length > 0 && (
            <div className="mt-5 space-y-2.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Select: <span className="text-foreground normal-case tracking-normal">{selectedVariant?.name || "None"}</span>
              </Label>
              <div className="flex flex-wrap gap-2.5">
                {(variants || []).map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelectedVariant(selectedVariant?.id === v.id ? null : v)}
                    disabled={v.stock_quantity <= 0}
                    className={`relative rounded-xl border-2 px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
                      selectedVariant?.id === v.id
                        ? "border-primary bg-primary/10 text-primary shadow-md shadow-primary/10"
                        : "border-border text-foreground hover:border-primary/40 hover:bg-accent/50"
                    } ${v.stock_quantity <= 0 ? "opacity-30 cursor-not-allowed" : "active:scale-95"}`}
                  >
                    {/* Selected checkmark */}
                    {selectedVariant?.id === v.id && (
                      <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                        <Check className="h-2.5 w-2.5 text-primary-foreground" strokeWidth={3} />
                      </span>
                    )}
                    {v.name}
                    {v.price !== null && v.price !== basePrice && (
                      <span className="ml-1 text-xs opacity-70">
                        ({currency} {Number(v.price).toFixed(2)})
                      </span>
                    )}
                    {v.stock_quantity <= 0 && (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="h-px w-full bg-muted-foreground/50 rotate-[-15deg]" />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity Selector */}
          {!isOutOfStock && (
            <div className="mt-5 flex items-center gap-3">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Qty</Label>
              <div className="flex items-center rounded-xl border border-border overflow-hidden">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="flex h-10 w-10 items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors active:scale-90"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-12 text-center text-sm font-bold text-foreground">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="flex h-10 w-10 items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors active:scale-90"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* CTA Buttons */}
          {!isOutOfStock && (
            <div className="mt-6 flex flex-col gap-3">
              {/* Primary: Add to Cart — Animated */}
              <button
                className={`relative flex w-full items-center justify-center gap-2 rounded-xl text-sm font-extrabold uppercase tracking-widest overflow-hidden transition-all duration-300 active:scale-[0.97] ${
                  justAdded
                    ? "bg-success text-success-foreground"
                    : "btn-gold hover:brightness-110"
                }`}
                onClick={handleAddToCart}
                style={{ minHeight: "54px" }}
              >
                {justAdded ? (
                  <span className="flex items-center gap-2 animate-fade-in">
                    <Check className="h-5 w-5" strokeWidth={3} />
                    Added to Cart!
                  </span>
                ) : (
                  <span className={`flex items-center gap-2 ${cartBounce ? "animate-bounce-once" : ""}`}>
                    <ShoppingCart className="h-5 w-5" />
                    Add to Cart — {currency} {(variantPrice * quantity).toFixed(2)}
                  </span>
                )}
              </button>

              {/* Buy Now */}
              {showBuyNow && (
                <Button
                  className="h-[54px] w-full rounded-xl text-sm font-extrabold uppercase tracking-widest"
                  onClick={handleBuyNow}
                >
                  <ShoppingBag className="mr-2 h-5 w-5" />
                  Buy Now
                </Button>
              )}

              {/* WhatsApp */}
              {showWhatsApp && store.whatsapp_number && (
                <button
                  className="flex h-[54px] w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] text-sm font-extrabold uppercase tracking-widest text-white transition-all hover:bg-[#1ebe5d] active:scale-[0.97]"
                  onClick={() => {
                    const phone = store.whatsapp_number!.replace(/[^0-9+]/g, "");
                    const variantInfo = selectedVariant ? ` (${selectedVariant.name})` : "";
                    const productUrl = `${window.location.origin}${window.location.pathname}`;
                    const text = `Hi ${store.name}! 👋\n\nI want to buy *${product.name}${variantInfo}* x${quantity}\n\n💰 Price: ${currency} ${(variantPrice * quantity).toFixed(0)}\n\n🔗 ${productUrl}\n\nPlease share availability, delivery time & payment options.`;
                    window.open(`https://wa.me/${encodeURIComponent(phone)}?text=${encodeURIComponent(text)}`, "_blank");
                  }}
                >
                  <svg viewBox="0 0 32 32" fill="white" className="h-5 w-5"><path d="M16.004 3.2C9.056 3.2 3.406 8.848 3.404 15.8c-.001 2.222.58 4.392 1.683 6.303L3.2 28.8l6.867-1.802A12.56 12.56 0 0 0 16 28.398h.005C22.95 28.398 28.6 22.75 28.6 15.8 28.6 8.85 22.95 3.2 16.004 3.2Zm0 22.997h-.004a10.44 10.44 0 0 1-5.318-1.457l-.382-.226-3.955 1.038 1.055-3.858-.249-.395A10.42 10.42 0 0 1 5.54 15.8c.002-5.77 4.697-10.463 10.466-10.463 5.77 0 10.463 4.695 10.463 10.464 0 5.77-4.695 10.465-10.465 10.465v-.069Zm5.74-7.835c-.315-.158-1.863-.92-2.152-1.025-.289-.105-.499-.158-.71.158-.21.315-.815 1.025-.999 1.236-.184.21-.368.236-.683.079-.315-.158-1.33-.49-2.533-1.562-.937-.835-1.568-1.867-1.752-2.182-.184-.315-.02-.486.138-.643.142-.141.315-.368.473-.552.158-.184.21-.315.315-.526.106-.21.053-.394-.026-.552-.079-.158-.71-1.71-.973-2.341-.256-.615-.517-.532-.71-.542-.184-.008-.394-.01-.604-.01s-.552.079-.841.394c-.29.315-1.104 1.078-1.104 2.63 0 1.552 1.13 3.052 1.288 3.262.158.21 2.224 3.396 5.388 4.762.753.326 1.341.52 1.8.665.756.24 1.444.206 1.988.125.607-.09 1.863-.762 2.126-1.498.263-.736.263-1.367.184-1.498-.079-.132-.289-.21-.604-.369Z"/></svg>
                  Order on WhatsApp
                </button>
              )}
            </div>
          )}

          {/* Payment Icons + Wishlist row */}
          <div className="mt-4 flex items-center justify-between">
            <button
              onClick={handleWishlist}
              className={`flex items-center gap-2 text-sm transition-all duration-200 ${
                wishlisted ? "text-destructive font-semibold" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Heart className={`h-4 w-4 transition-transform duration-200 ${wishlisted ? "fill-destructive text-destructive scale-110" : ""}`} />
              {wishlisted ? "Saved" : "Wishlist"}
            </button>

            {/* Payment method icons */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground mr-1">We accept</span>
              <PaymentIcons />
            </div>
          </div>

          {/* Delivery & Trust Badges */}
          <div className="mt-5 rounded-xl border border-border p-3 space-y-2.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Truck className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">Free Delivery</p>
                <p className="text-[10px] text-muted-foreground">Get it by <strong className="text-foreground">{deliveryDate}</strong></p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <RotateCcw className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">Easy Returns</p>
                <p className="text-[10px] text-muted-foreground">7-day hassle-free return policy</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Shield className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">Secure Checkout</p>
                <p className="text-[10px] text-muted-foreground">100% secure payment processing</p>
              </div>
            </div>
          </div>

          {/* Accordion Sections */}
          <div className="mt-6 divide-y divide-border border border-border rounded-xl overflow-hidden">
            {product.description && (
              <AccordionItem
                title="Product Description"
                isOpen={openAccordion === "description"}
                onToggle={() => toggleAccordion("description")}
              >
                <p className="leading-relaxed text-sm text-muted-foreground whitespace-pre-line">
                  {product.description}
                </p>
              </AccordionItem>
            )}
            <AccordionItem
              title="Shipping Information"
              isOpen={openAccordion === "shipping"}
              onToggle={() => toggleAccordion("shipping")}
            >
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li>• Standard delivery: 3-7 business days</li>
                <li>• Express delivery available at checkout</li>
                <li>• Free shipping on all orders</li>
                <li>• Order tracking provided via SMS/email</li>
              </ul>
            </AccordionItem>
            <AccordionItem
              title="Returns & Exchange"
              isOpen={openAccordion === "returns"}
              onToggle={() => toggleAccordion("returns")}
            >
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li>• 7-day easy return policy</li>
                <li>• Product must be unused and in original packaging</li>
                <li>• Refund processed within 5-7 business days</li>
              </ul>
            </AccordionItem>
          </div>

          {/* Share Buttons */}
          <ShareButtons productName={product.name} />
        </div>
      </div>

      {/* Customer Reviews Section removed — only star rating shown inline */}

      {/* Related Products */}
      <RelatedProducts
        storeId={store.id}
        storeSlug={store.slug}
        currentProductId={product.id}
        currentCategory={product.category}
        store={store}
      />

      {/* Sticky Mobile CTA */}
      {!isOutOfStock && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-md p-3 flex items-center gap-3 sm:hidden safe-area-bottom">
          <div className="flex-1 min-w-0">
            <p className="text-lg font-extrabold text-foreground leading-tight">
              {currency} {(variantPrice * quantity).toFixed(2)}
            </p>
            {hasDiscount && (
              <p className="text-[10px] text-success font-semibold">{discountPct}% OFF</p>
            )}
          </div>
          <button
            className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all active:scale-[0.97] ${
              justAdded ? "bg-success text-success-foreground" : "btn-gold"
            }`}
            onClick={handleAddToCart}
          >
            {justAdded ? (
              <span className="flex items-center gap-1 animate-fade-in">
                <Check className="h-4 w-4" strokeWidth={3} />
                Added!
              </span>
            ) : (
              <>
                <ShoppingCart className="h-4 w-4" />
                Add to Cart
              </>
            )}
          </button>
          {showBuyNow && (
            <Button
              className="h-11 flex-1 rounded-xl text-xs font-extrabold uppercase tracking-wider"
              onClick={handleBuyNow}
            >
              Buy Now
            </Button>
          )}
        </div>
      )}
      {!isOutOfStock && <div className="h-20 sm:hidden" />}
    </div>
  );
}

/* ── Payment Icons ── */
function PaymentIcons() {
  return (
    <div className="flex items-center gap-1">
      {/* Visa */}
      <div className="flex h-6 w-9 items-center justify-center rounded border border-border bg-card">
        <svg viewBox="0 0 48 32" className="h-4 w-7">
          <rect width="48" height="32" rx="4" fill="#1A1F71"/>
          <text x="24" y="20" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold" fontFamily="sans-serif">VISA</text>
        </svg>
      </div>
      {/* Mastercard */}
      <div className="flex h-6 w-9 items-center justify-center rounded border border-border bg-card">
        <svg viewBox="0 0 48 32" className="h-4 w-7">
          <rect width="48" height="32" rx="4" fill="#252525"/>
          <circle cx="19" cy="16" r="8" fill="#EB001B"/>
          <circle cx="29" cy="16" r="8" fill="#F79E1B"/>
          <path d="M24 10.3a8 8 0 010 11.4 8 8 0 000-11.4z" fill="#FF5F00"/>
        </svg>
      </div>
      {/* UPI */}
      <div className="flex h-6 w-9 items-center justify-center rounded border border-border bg-card">
        <svg viewBox="0 0 48 32" className="h-4 w-7">
          <rect width="48" height="32" rx="4" fill="#fff"/>
          <text x="24" y="20" textAnchor="middle" fill="#5f259f" fontSize="10" fontWeight="bold" fontFamily="sans-serif">UPI</text>
        </svg>
      </div>
      {/* COD */}
      <div className="flex h-6 w-9 items-center justify-center rounded border border-border bg-card">
        <svg viewBox="0 0 48 32" className="h-4 w-7">
          <rect width="48" height="32" rx="4" fill="#f5f5f5"/>
          <text x="24" y="20" textAnchor="middle" fill="#333" fontSize="8" fontWeight="bold" fontFamily="sans-serif">COD</text>
        </svg>
      </div>
    </div>
  );
}

/* ── Customer Reviews Section ── */
function CustomerReviews({
  reviews,
  rating,
  reviewCount,
}: {
  reviews: ReturnType<typeof getFakeReviews>;
  rating: number;
  reviewCount: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? reviews : reviews.slice(0, 3);

  return (
    <section className="mt-12 pt-8 border-t border-border">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Customer Reviews</h2>
          <div className="mt-1 flex items-center gap-2">
            <div className="flex items-center gap-0.5">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`h-4 w-4 ${i < Math.floor(rating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/20"}`}
                />
              ))}
            </div>
            <span className="text-sm font-bold text-foreground">{rating}</span>
            <span className="text-sm text-muted-foreground">based on {reviewCount} reviews</span>
          </div>
        </div>
      </div>

      {/* Rating bars */}
      <div className="mb-6 space-y-1.5">
        {[5, 4, 3, 2, 1].map((stars) => {
          const pct = stars === 5 ? 68 : stars === 4 ? 22 : stars === 3 ? 7 : stars === 2 ? 2 : 1;
          return (
            <div key={stars} className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground w-3">{stars}</span>
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              <div className="flex-1 h-2 rounded-full bg-accent overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-400 transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground w-8 text-right">{pct}%</span>
            </div>
          );
        })}
      </div>

      {/* Review cards */}
      <div className="space-y-4">
        {displayed.map((review) => (
          <div
            key={review.id}
            className="rounded-xl border border-border p-4 transition-all hover:shadow-sm"
          >
            <div className="flex items-start gap-3">
              {/* Avatar */}
              <img
                src={review.avatar}
                alt={review.name}
                className="h-10 w-10 rounded-full bg-accent"
                loading="lazy"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground">{review.name}</span>
                    {review.verified && (
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 font-bold gap-0.5">
                        <Check className="h-2.5 w-2.5" /> Verified
                      </Badge>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {review.daysAgo === 1 ? "Yesterday" : `${review.daysAgo} days ago`}
                  </span>
                </div>
                {/* Stars */}
                <div className="flex items-center gap-0.5 mt-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-3 w-3 ${i < review.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/20"}`}
                    />
                  ))}
                </div>
                {/* Text */}
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{review.text}</p>
                {/* Helpful */}
                <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
                  <ThumbsUp className="h-3 w-3" />
                  <span>{review.helpful} people found this helpful</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {reviews.length > 3 && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-4 text-sm font-semibold text-primary hover:underline"
        >
          View all {reviews.length} reviews →
        </button>
      )}
    </section>
  );
}

/* ── Accordion Item ── */
function AccordionItem({
  title,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-bold text-foreground hover:bg-accent/30 transition-colors"
      >
        {title}
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
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

/* ── Image Gallery with Swipe + Dots on Mobile ── */
function ImageGallery({ images, productName, hasDiscount, discountPct }: { images: string[]; productName: string; hasDiscount: number | boolean | null; discountPct: number }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const touchStart = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStart.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    // Only swipe if horizontal movement > vertical
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx < 0 && activeIndex < images.length - 1) setActiveIndex(i => i + 1);
      if (dx > 0 && activeIndex > 0) setActiveIndex(i => i - 1);
    }
    touchStart.current = null;
    touchStartY.current = null;
  };

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
      <div className="space-y-3 lg:sticky lg:top-4">
        {/* Main image */}
        <div
          className="relative overflow-hidden rounded-2xl bg-accent cursor-zoom-in select-none"
          onClick={() => setLightboxOpen(true)}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Discount badge on image */}
          {hasDiscount && discountPct > 0 && (
            <div className="absolute left-3 top-3 z-10">
              <Badge className="bg-destructive text-destructive-foreground text-xs font-bold border-0 shadow-lg">
                -{discountPct}% OFF
              </Badge>
            </div>
          )}

          {/* Wishlist on image - mobile only */}
          <div className="absolute right-3 top-3 z-10 sm:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-card/80 backdrop-blur-sm shadow">
              <Heart className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          <img
            src={images[activeIndex]}
            alt={productName}
            className="aspect-square w-full object-contain transition-transform duration-300"
            decoding="async"
            fetchPriority="high"
            draggable={false}
          />

          {/* Zoom hint */}
          <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-background/80 px-2.5 py-1 text-[10px] font-semibold text-foreground shadow backdrop-blur-sm">
            <ZoomIn className="h-3.5 w-3.5" /> Tap to zoom
          </div>

          {/* Desktop arrows */}
          {images.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveIndex((i) => (i - 1 + images.length) % images.length); }}
                className="absolute left-2 top-1/2 -translate-y-1/2 hidden sm:flex rounded-full bg-background/80 p-1.5 shadow backdrop-blur-sm hover:bg-background transition-all"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveIndex((i) => (i + 1) % images.length); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 hidden sm:flex rounded-full bg-background/80 p-1.5 shadow backdrop-blur-sm hover:bg-background transition-all"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}
        </div>

        {/* Mobile: Dot indicators */}
        {images.length > 1 && (
          <div className="flex justify-center gap-1.5 sm:hidden">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveIndex(i)}
                className={`rounded-full transition-all duration-300 ${
                  i === activeIndex
                    ? "w-6 h-2 bg-primary"
                    : "w-2 h-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                }`}
              />
            ))}
          </div>
        )}

        {/* Desktop: Thumbnail strip */}
        {images.length > 1 && (
          <div className="hidden sm:flex gap-2 overflow-x-auto scrollbar-hide">
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => setActiveIndex(i)}
                className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                  i === activeIndex ? "border-primary ring-2 ring-primary/20" : "border-transparent hover:border-muted-foreground/30"
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
    if (scale > 1) {
      resetZoom();
    } else {
      setScale(2.5);
      setTranslate({ x: 0, y: 0 });
    }
  };

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

      {/* Dot indicators in lightbox */}
      {images.length > 1 && (
        <div className="flex justify-center gap-2 px-4 py-3">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => { setActiveIndex(i); resetZoom(); }}
              className={`rounded-full transition-all duration-300 ${
                i === activeIndex
                  ? "w-6 h-2 bg-white"
                  : "w-2 h-2 bg-white/40 hover:bg-white/60"
              }`}
            />
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
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-4 w-48" />
          <div className="mt-4 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
          <div className="mt-6 flex flex-col gap-3">
            <Skeleton className="h-[54px] w-full rounded-xl" />
            <Skeleton className="h-[54px] w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
