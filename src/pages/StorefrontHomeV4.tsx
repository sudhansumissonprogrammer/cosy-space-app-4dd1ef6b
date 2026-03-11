import { useState, useMemo, useEffect } from "react";
import { useOutletContext, useParams, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Star, Quote, ArrowRight, Package } from "lucide-react";
import type { StoreData } from "@/layouts/StorefrontLayout";
import StorefrontProductCard from "@/components/storefront/StorefrontProductCard";
import StorefrontSearchOverlay from "@/components/storefront/StorefrontSearchOverlay";
import LazyRender from "@/components/storefront/LazyRender";
import { useStoreJsonLd } from "@/hooks/useJsonLd";
import { Skeleton } from "@/components/ui/skeleton";
import { storefrontPath } from "@/lib/subdomain";
import { optimizeImageUrl } from "@/lib/imageOptimize";

/* ── Full-Screen Hero ── */
function LuxuryHero({ store }: { store: StoreData }) {
  const queryClient = useQueryClient();
  const products = queryClient.getQueryData<any[]>(["storefront-products", store.id]);

  const heroImage = (store as any).banner_url || (store as any).mobile_hero_url || null;
  const bestProduct = products?.find((p: any) => p.is_best_selling && p.image_url);

  return (
    <section className="relative w-full h-[70vh] sm:h-screen" style={{ minHeight: "400px", maxHeight: "900px" }}>
      {heroImage ? (
        <img
          src={optimizeImageUrl(heroImage, 1400)}
          alt={store.name}
          className="absolute inset-0 h-full w-full object-cover"
          loading="eager"
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(135deg, var(--storefront-accent, #1C1C1C), var(--storefront-text, #1C1C1C))` }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/10" />

      <div className="absolute inset-0 flex items-center justify-center text-center">
        <div className="max-w-2xl px-6">
          <div className="mb-4 h-[1px] mx-auto w-12" style={{ backgroundColor: "var(--storefront-primary, #C8A96A)" }} />
          <h1
            className="text-3xl font-light tracking-[0.12em] uppercase text-white sm:text-5xl lg:text-6xl"
            style={{ fontFamily: "var(--storefront-heading-font, 'Playfair Display')" }}
          >
            {store.name}
          </h1>
          <p className="mt-4 text-sm font-light tracking-[0.08em] text-white/70 sm:text-base">
            {store.description || "Curated luxury, timeless elegance"}
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link
              to={storefrontPath(store.slug, "best-sellers")}
              className="inline-flex items-center gap-2 border px-8 py-3 text-[11px] font-medium tracking-[0.2em] uppercase text-white transition-all hover:bg-white hover:text-black"
              style={{ borderColor: "var(--storefront-primary, #C8A96A)" }}
            >
              Explore Collection
            </Link>
          </div>
          <div className="mt-4 h-[1px] mx-auto w-12" style={{ backgroundColor: "var(--storefront-primary, #C8A96A)" }} />
        </div>
      </div>
    </section>
  );
}

/* ── Featured Collection (Editorial Layout) ── */
function FeaturedCollection({ products, slug, store }: { products: any[]; slug: string; store: StoreData }) {
  const featured = products.filter((p: any) => p.is_best_selling).slice(0, 4);
  if (featured.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-20 lg:px-12">
      <div className="text-center mb-12">
        <p className="text-[11px] font-medium tracking-[0.3em] uppercase mb-3" style={{ color: "var(--storefront-primary, #C8A96A)" }}>
          Curated Selection
        </p>
        <h2
          className="text-2xl font-light tracking-[0.1em] uppercase sm:text-3xl"
          style={{ fontFamily: "var(--storefront-heading-font, 'Playfair Display')" }}
        >
          Featured Collection
        </h2>
        <div className="mt-4 mx-auto h-[1px] w-16" style={{ backgroundColor: "var(--storefront-primary, #C8A96A)" }} />
      </div>

      {/* Editorial grid: large + small */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:gap-8">
        {featured.slice(0, 2).map((product, idx) => (
          <Link
            key={product.id}
            to={storefrontPath(slug, `product/${product.slug || product.id}`)}
            className="group relative overflow-hidden"
            style={{ aspectRatio: idx === 0 ? (window.innerWidth < 640 ? "1/1" : "3/4") : "4/3" }}
          >
            {product.image_url ? (
              <img
                src={optimizeImageUrl(product.image_url, 800)}
                alt={product.name}
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center" style={{ backgroundColor: "var(--storefront-primary, #C8A96A)10" }}>
                <Package className="h-16 w-16 opacity-20" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            <div className="absolute bottom-0 left-0 right-0 p-6 translate-y-4 opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
              <p className="text-[10px] font-medium tracking-[0.25em] uppercase text-white/70">{product.category || "Collection"}</p>
              <h3 className="mt-1 text-lg font-light tracking-wide text-white" style={{ fontFamily: "var(--storefront-heading-font, inherit)" }}>
                {product.name}
              </h3>
              <p className="mt-1 text-sm text-white/80">
                ₹{Number(product.sale_price || product.price).toFixed(0)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ── Lookbook Section ── */
function LookbookSection({ products, slug }: { products: any[]; slug: string }) {
  const lookbookItems = products.filter((p: any) => p.image_url).slice(0, 6);
  if (lookbookItems.length < 3) return null;

  return (
    <section className="py-20" style={{ backgroundColor: "var(--storefront-accent, #1C1C1C)" }}>
      <div className="mx-auto max-w-7xl px-6 lg:px-12">
        <div className="text-center mb-12">
          <p className="text-[11px] font-medium tracking-[0.3em] uppercase mb-3" style={{ color: "var(--storefront-primary, #C8A96A)" }}>
            Style Guide
          </p>
          <h2
            className="text-2xl font-light tracking-[0.1em] uppercase sm:text-3xl"
            style={{ fontFamily: "var(--storefront-heading-font, 'Playfair Display')", color: "var(--storefront-bg, #F8F5F0)" }}
          >
            Lookbook
          </h2>
          <div className="mt-4 mx-auto h-[1px] w-16" style={{ backgroundColor: "var(--storefront-primary, #C8A96A)" }} />
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3">
          {lookbookItems.map((product, idx) => (
            <Link
              key={product.id}
              to={storefrontPath(slug, `product/${product.slug || product.id}`)}
              className={`group relative overflow-hidden ${idx === 0 ? "row-span-2" : ""}`}
              style={{ aspectRatio: idx === 0 ? "2/3" : "1/1" }}
            >
              <img
                src={optimizeImageUrl(product.image_url, 600)}
                alt={product.name}
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/0 transition-colors duration-500 group-hover:bg-black/30" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Brand Story ── */
function BrandStory({ store }: { store: StoreData }) {
  return (
    <section className="mx-auto max-w-7xl px-6 py-20 lg:px-12">
      <div className="grid grid-cols-1 items-center gap-12 md:grid-cols-2">
        <div>
          <p className="text-[11px] font-medium tracking-[0.3em] uppercase mb-4" style={{ color: "var(--storefront-primary, #C8A96A)" }}>
            Our Story
          </p>
          <h2
            className="text-2xl font-light tracking-[0.08em] leading-relaxed sm:text-3xl"
            style={{ fontFamily: "var(--storefront-heading-font, 'Playfair Display')" }}
          >
            Crafted with passion,<br />delivered with care
          </h2>
          <div className="mt-4 h-[1px] w-16" style={{ backgroundColor: "var(--storefront-primary, #C8A96A)" }} />
          <p className="mt-6 text-sm leading-relaxed opacity-70">
            {store.description || "Every piece in our collection is carefully curated to bring you the finest quality and timeless design. We believe in the art of craftsmanship and the beauty of simplicity."}
          </p>
          <Link
            to={storefrontPath(store.slug, "contact")}
            className="mt-8 inline-flex items-center gap-2 text-[11px] font-medium tracking-[0.2em] uppercase transition-opacity hover:opacity-60"
            style={{ color: "var(--storefront-primary, #C8A96A)" }}
          >
            Learn More <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="relative" style={{ aspectRatio: "4/5" }}>
          {(store as any).banner_url ? (
            <img
              src={optimizeImageUrl((store as any).banner_url, 800)}
              alt="Brand Story"
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="h-full w-full" style={{ background: `linear-gradient(135deg, var(--storefront-primary, #C8A96A)15, var(--storefront-accent, #1C1C1C)15)` }} />
          )}
          {/* Decorative border */}
          <div className="absolute -bottom-3 -right-3 h-full w-full border-2 -z-10" style={{ borderColor: "var(--storefront-primary, #C8A96A)30" }} />
        </div>
      </div>
    </section>
  );
}

/* ── Customer Reviews ── */
function CustomerReviews() {
  const reviews = [
    { name: "Priya S.", text: "Absolutely stunning quality. The craftsmanship is unmatched. Will definitely order again.", rating: 5 },
    { name: "Arjun M.", text: "The attention to detail is incredible. Received so many compliments on my purchase.", rating: 5 },
    { name: "Neha R.", text: "Premium packaging and fast delivery. The product exceeded my expectations.", rating: 5 },
  ];

  return (
    <section className="mx-auto max-w-7xl px-6 py-20 lg:px-12">
      <div className="text-center mb-12">
        <p className="text-[11px] font-medium tracking-[0.3em] uppercase mb-3" style={{ color: "var(--storefront-primary, #C8A96A)" }}>
          Testimonials
        </p>
        <h2
          className="text-2xl font-light tracking-[0.1em] uppercase sm:text-3xl"
          style={{ fontFamily: "var(--storefront-heading-font, 'Playfair Display')" }}
        >
          What Our Clients Say
        </h2>
        <div className="mt-4 mx-auto h-[1px] w-16" style={{ backgroundColor: "var(--storefront-primary, #C8A96A)" }} />
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {reviews.map((review, idx) => (
          <div key={idx} className="border p-8 text-center" style={{ borderColor: "var(--storefront-text, #1C1C1C)12" }}>
            <Quote className="mx-auto h-6 w-6 mb-4 opacity-20" style={{ color: "var(--storefront-primary, #C8A96A)" }} />
            <p className="text-sm leading-relaxed italic opacity-70">"{review.text}"</p>
            <div className="mt-6 flex items-center justify-center gap-0.5">
              {Array.from({ length: review.rating }).map((_, i) => (
                <Star key={i} className="h-3 w-3 fill-current" style={{ color: "var(--storefront-primary, #C8A96A)" }} />
              ))}
            </div>
            <p className="mt-3 text-[11px] font-medium tracking-[0.15em] uppercase opacity-80">{review.name}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Newsletter ── */
function Newsletter() {
  return (
    <section className="py-20" style={{ backgroundColor: "var(--storefront-accent, #1C1C1C)" }}>
      <div className="mx-auto max-w-xl px-6 text-center">
        <p className="text-[11px] font-medium tracking-[0.3em] uppercase mb-3" style={{ color: "var(--storefront-primary, #C8A96A)" }}>
          Stay Connected
        </p>
        <h2
          className="text-2xl font-light tracking-[0.1em] uppercase sm:text-3xl"
          style={{ fontFamily: "var(--storefront-heading-font, 'Playfair Display')", color: "var(--storefront-bg, #F8F5F0)" }}
        >
          Join Our World
        </h2>
        <p className="mt-3 text-sm opacity-50" style={{ color: "var(--storefront-bg, #F8F5F0)" }}>
          Be the first to know about new collections and exclusive offers.
        </p>
        <div className="mt-8 flex items-center gap-0">
          <input
            type="email"
            placeholder="Your email address"
            className="flex-1 border-b bg-transparent px-4 py-3 text-sm outline-none placeholder:opacity-40"
            style={{
              borderColor: "var(--storefront-primary, #C8A96A)",
              color: "var(--storefront-bg, #F8F5F0)",
            }}
          />
          <button
            className="border-b px-6 py-3 text-[11px] font-medium tracking-[0.15em] uppercase transition-opacity hover:opacity-80"
            style={{
              borderColor: "var(--storefront-primary, #C8A96A)",
              backgroundColor: "var(--storefront-primary, #C8A96A)",
              color: "var(--storefront-btn-text, #fff)",
            }}
          >
            Subscribe
          </button>
        </div>
      </div>
    </section>
  );
}

/* ── Main Home Page ── */
export default function StorefrontHomeV4() {
  const store = useOutletContext<StoreData>();
  const { slug } = useParams<{ slug: string }>();
  const queryClient = useQueryClient();
  const [searchOpen, setSearchOpen] = useState(false);

  useStoreJsonLd({
    storeName: store.name,
    storeSlug: store.slug,
    description: store.description,
    logo: store.logo_url,
    location: store.location,
    whatsappNumber: store.whatsapp_number,
  });

  const products = queryClient.getQueryData<any[]>(["storefront-products", store.id]);

  const allProducts = useMemo(() => {
    if (!products) return [];
    return [...products];
  }, [products]);

  return (
    <>
      {/* Hero */}
      <LuxuryHero store={store} />

      {/* Search (hidden, triggered elsewhere) */}
      <StorefrontSearchOverlay
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        products={products}
        slug={slug!}
      />

      {/* Featured Collection */}
      {products && <FeaturedCollection products={allProducts} slug={slug!} store={store} />}

      {/* Product Grid */}
      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-12">
        <div className="text-center mb-12">
          <p className="text-[11px] font-medium tracking-[0.3em] uppercase mb-3" style={{ color: "var(--storefront-primary, #C8A96A)" }}>
            Shop
          </p>
          <h2
            className="text-2xl font-light tracking-[0.1em] uppercase sm:text-3xl"
            style={{ fontFamily: "var(--storefront-heading-font, 'Playfair Display')" }}
          >
            All Products
          </h2>
          <div className="mt-4 mx-auto h-[1px] w-16" style={{ backgroundColor: "var(--storefront-primary, #C8A96A)" }} />
        </div>

        {!products ? (
          <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:gap-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="border" style={{ borderColor: "var(--storefront-text, #1C1C1C)10" }}>
                <Skeleton className="w-full" style={{ aspectRatio: "3/4" }} />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : allProducts.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:gap-8">
              {allProducts.slice(0, 9).map((product, idx) => (
                <StorefrontProductCard key={product.id} product={product} slug={slug!} store={store} priority={idx < 4} />
              ))}
            </div>
            {allProducts.length > 9 && (
              <LazyRender rootMargin="400px" minHeight={400}>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:gap-8 mt-6 lg:mt-8">
                  {allProducts.slice(9).map((product) => (
                    <StorefrontProductCard key={product.id} product={product} slug={slug!} store={store} />
                  ))}
                </div>
              </LazyRender>
            )}
          </>
        ) : (
          <div className="flex min-h-[200px] items-center justify-center border" style={{ borderColor: "var(--storefront-text, #1C1C1C)10" }}>
            <p className="text-sm opacity-50">No products available yet.</p>
          </div>
        )}
      </section>

      {/* Lookbook */}
      {products && (
        <LazyRender rootMargin="300px" minHeight={400}>
          <LookbookSection products={allProducts} slug={slug!} />
        </LazyRender>
      )}

      {/* Brand Story */}
      <LazyRender rootMargin="300px" minHeight={300}>
        <BrandStory store={store} />
      </LazyRender>

      {/* Customer Reviews */}
      <LazyRender rootMargin="300px" minHeight={300}>
        <CustomerReviews />
      </LazyRender>

      {/* Newsletter */}
      <LazyRender rootMargin="200px" minHeight={200}>
        <Newsletter />
      </LazyRender>
    </>
  );
}
