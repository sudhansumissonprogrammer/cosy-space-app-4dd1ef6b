import { useState } from "react";
import { useParams, Link, useOutletContext } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, MessageCircle, Package, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import type { StoreData } from "@/layouts/StorefrontLayout";

export default function ProductDetail() {
  const store = useOutletContext<StoreData>();
  const { productSlug } = useParams<{ productSlug: string }>();

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
    enabled: !!store.id && !!productSlug,
  });

  // Fetch additional images
  const { data: extraImages } = useQuery({
    queryKey: ["product-images", product?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("product_images")
        .select("*")
        .eq("product_id", product!.id)
        .order("display_order");
      if (error) throw error;
      return data as { id: string; image_url: string; display_order: number }[];
    },
    enabled: !!product?.id,
  });

  // Build full image list: main image + extras
  const allImages = (() => {
    const imgs: string[] = [];
    if (product?.image_url) imgs.push(product.image_url);
    if (extraImages) imgs.push(...extraImages.map((i) => i.image_url));
    return imgs;
  })();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16">
        <div className="flex flex-col items-center gap-4 text-center">
          <Package className="h-12 w-12 text-muted-foreground" />
          <h1 className="text-2xl font-semibold text-foreground">Product not found</h1>
          <p className="text-muted-foreground">This product doesn't exist or is no longer available.</p>
          <Button asChild variant="outline">
            <Link to={`/store/${store.slug}`}>
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

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <Link
          to={`/store/${store.slug}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to {store.name}
        </Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Product Image Gallery */}
        <ImageGallery images={allImages} productName={product.name} />

        {/* Product Info */}
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
                  ${Number(product.sale_price).toFixed(2)}
                </span>
                <span className="text-lg text-muted-foreground line-through">
                  ${Number(product.price).toFixed(2)}
                </span>
                <Badge variant="destructive" className="text-xs">
                  -{discountPct}%
                </Badge>
              </>
            ) : (
              <span className="text-3xl font-bold text-foreground">
                ${Number(product.price).toFixed(2)}
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

          {store.whatsapp_number && (
            <WhatsAppOrderButton store={store} product={product} hasDiscount={!!hasDiscount} />
          )}
        </div>
      </div>
    </div>
  );
}

function ImageGallery({ images, productName }: { images: string[]; productName: string }) {
  const [activeIndex, setActiveIndex] = useState(0);

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
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl bg-accent">
        <img
          src={images[activeIndex]}
          alt={productName}
          className="aspect-square w-full object-cover"
          loading="lazy"
        />
        {images.length > 1 && (
          <>
            <button
              onClick={() => setActiveIndex((i) => (i - 1 + images.length) % images.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-1.5 shadow backdrop-blur-sm hover:bg-background"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setActiveIndex((i) => (i + 1) % images.length)}
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
  );
}

function WhatsAppOrderButton({
  store,
  product,
  hasDiscount,
}: {
  store: StoreData;
  product: { id: string; name: string; price: number; sale_price: number | null };
  hasDiscount: boolean;
}) {
  const [ordering, setOrdering] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  const finalPrice = hasDiscount ? product.sale_price! : product.price;

  const handleOrder = async () => {
    if (!customerPhone.trim()) {
      toast.error("Please enter your phone number");
      return;
    }

    setOrdering(true);
    try {
      const { data } = await supabase.from("whatsapp_orders").insert({
        store_id: store.id,
        product_id: product.id,
        product_name: product.name,
        product_price: finalPrice,
        customer_phone: customerPhone.trim(),
        customer_name: customerName.trim() || null,
        quantity: 1,
      }).select("id").single();

      // Fire order notification (non-blocking)
      if (data?.id) {
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        if (projectId) {
          fetch(`https://${projectId}.supabase.co/functions/v1/notify-order`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ order_id: data.id }),
          }).catch(() => {});
        }
      }
    } catch {
      // Don't block the WhatsApp redirect on DB errors
    }
    setOrdering(false);

    const phone = store.whatsapp_number!.replace(/[^0-9+]/g, "");
    const text = `Hello, I want to order:\n\nProduct: ${product.name}\nPrice: $${Number(finalPrice).toFixed(2)}\nStore: ${store.name}\n\nName: ${customerName.trim() || "—"}\nPhone: ${customerPhone.trim()}`;
    window.open(
      `https://wa.me/${encodeURIComponent(phone)}?text=${encodeURIComponent(text)}`,
      "_blank"
    );
  };

  return (
    <div className="mt-8 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="customer-name" className="text-xs">Your Name</Label>
          <Input
            id="customer-name"
            placeholder="John Doe"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            maxLength={100}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="customer-phone" className="text-xs">Your Phone *</Label>
          <Input
            id="customer-phone"
            placeholder="+1234567890"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            maxLength={20}
          />
        </div>
      </div>
      <Button size="lg" className="w-full sm:w-auto" onClick={handleOrder} disabled={ordering}>
        {ordering ? (
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        ) : (
          <MessageCircle className="mr-2 h-5 w-5" />
        )}
        Order on WhatsApp
      </Button>
    </div>
  );
}
