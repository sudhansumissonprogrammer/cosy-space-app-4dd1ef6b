import { useState, useRef } from "react";
import { useOutletContext, useParams, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ChevronLeft, ChevronRight, Quote, Truck, Shield, RotateCcw } from "lucide-react";
import type { StoreData } from "@/layouts/StorefrontLayout";
import StorefrontProductCard from "@/components/storefront/StorefrontProductCard";
import StorefrontSearchOverlay from "@/components/storefront/StorefrontSearchOverlay";
import LazyRender from "@/components/storefront/LazyRender";
import { useStoreJsonLd } from "@/hooks/useJsonLd";
import { Skeleton } from "@/components/ui/skeleton";
import { storefrontPath } from "@/lib/subdomain";
import { optimizeImageUrl } from "@/lib/imageOptimize";

/* ── Split Hero ── */
function SplitHero({ store }: { store: StoreData }) {
  const queryClient = useQueryClient();
  const products = queryClient.getQueryData<any[]>(["storefront-products", store.id]);
  const heroProduct = products?.find((p: any) => p.image_url) || null;
  const heroImage = heroProduct?.image_url || store.banner_url;

  return (
    <section className="grid grid-cols-1 lg:grid-cols-2 min-h-[50vh] lg:min-h-[70vh]">
      {/* Left: Image */}
      <div className="relative overflow-hidden bg-muted" style={{ backgroundColor: "var(--storefront-text, #1a1a1a)08" }}>
        {heroImage ? (
          <img
            src={optimizeImageUrl(heroImage, 1200)}
            alt={store.name}
            className="h-full w-full object-cover"
            style={{ minHeight: "300px", maxHeight: "80vh" }}
            loading="eager"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ minHeight: "300px", backgroundColor: "var(--storefront-primary, #1a1a1a)08" }}
          >
            <span
              className="text-[120px] font-bold opacity-[0.04]"
              style={{ fontFamily: "var(--storefront-heading-font, 'Playfair Display')" }}
            >
              {store.name.charAt(0)}
            </span>
          </div>
        )}
      </div>

      {/* Right: Text */}
      <div
        className="flex flex-col justify-center px-6 py-12 sm:px-10 lg:px-16 lg:py-20"
        style={{ backgroundColor: "var(--storefront-bg, #ffffff)" }}
      >
        <div className="max-w-lg">
          <p
            className="text-[10px] font-bold tracking-[0.3em] uppercase mb-4"
            style={{ color: "var(--storefront-primary, #1a1a1a)", opacity: 0.6 }}
          >
            New Collection
          </p>
          <h1
            className="text-4xl font-bold leading-[1.05] sm:text-5xl lg:text-6xl xl:text-7xl"
            style={{
              fontFamily: "var(--storefront-heading-font, 'Playfair Display')",
              color: "var(--storefront-text, #1a1a1a)",
            }}
          >
            {store.name}
          </h1>
          <p
            className="mt-5 text-base leading-relaxed sm:text-lg max-w-md"
            style={{ color: "var(--storefront-text, #1a1a1a)", opacity: 0.5 }}
          >
            {store.description || "Curated with intention. Crafted with care. Every piece tells a story worth sharing."}
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              to={storefrontPath(store.slug, "best-sellers")}
              className="inline-flex items-center gap-2.5 px-8 py-4 text-sm font-semibold uppercase tracking-wider transition-all duration-300 hover:opacity-80"
              style={{
                backgroundColor: "var(--storefront-primary, #1a1a1a)",
                color: "var(--storefront-btn-text, #ffffff)",
                borderRadius: "var(--storefront-button-radius, 0px)",
              }}
            >
              Shop Collection <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Horizontal Product Scroll ── */
function HorizontalProductStrip({ store, slug }: { store: StoreData; slug: string }) {
  const queryClient = useQueryClient();
  const products = queryClient.getQueryData<any[]>(["storefront-products", store.id]);
  const scrollRef = useRef<HTMLDivElement>(null);

  if (!products || products.length === 0) return null;

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = 320;
    scrollRef.current.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  return (
    <section className="py-12 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p
              className="text-[10px] font-bold tracking-[0.3em] uppercase mb-2"
              style={{ color: "var(--storefront-primary, #1a1a1a)", opacity: 0.5 }}
            >
              Curated Selection
            </p>
            <h2
              className="text-2xl font-bold sm:text-3xl lg:text-4xl"
              style={{
                fontFamily: "var(--storefront-heading-font, 'Playfair Display')",
                color: "var(--storefront-text, #1a1a1a)",
              }}
            >
              The Edit
            </h2>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={() => scroll("left")}
              className="flex h-10 w-10 items-center justify-center border transition-opacity hover:opacity-60"
              style={{
                borderColor: "var(--storefront-text, #1a1a1a)20",
                color: "var(--storefront-text, #1a1a1a)",
                borderRadius: "var(--storefront-button-radius, 0px)",
              }}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => scroll("right")}
              className="flex h-10 w-10 items-center justify-center border transition-opacity hover:opacity-60"
              style={{
                borderColor: "var(--storefront-text, #1a1a1a)20",
                color: "var(--storefront-text, #1a1a1a)",
                borderRadius: "var(--storefront-button-radius, 0px)",
              }}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide px-4 lg:px-8 pb-4"
        style={{ scrollbarWidth: "none" }}
      >
        {products.slice(0, 12).map((product, idx) => (
          <Link
            key={product.id}
            to={storefrontPath(slug, `product/${product.slug || product.id}`)}
            className="flex-shrink-0 snap-start group"
            style={{ width: "280px" }}
          >
            <div className="overflow-hidden" style={{ aspectRatio: "3/4" }}>
              {product.image_url ? (
                <img
                  src={optimizeImageUrl(product.image_url, 600)}
                  alt={product.name}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  loading={idx < 4 ? "eager" : "lazy"}
                />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center"
                  style={{ backgroundColor: "var(--storefront-primary, #1a1a1a)06" }}
                >
                  <span className="text-4xl font-bold opacity-[0.06]">{product.name.charAt(0)}</span>
                </div>
              )}
            </div>
            <div className="mt-3">
              <h3
                className="text-sm font-medium truncate"
                style={{ color: "var(--storefront-text, #1a1a1a)" }}
              >
                {product.name}
              </h3>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-sm font-semibold" style={{ color: "var(--storefront-text, #1a1a1a)" }}>
                  ₹{(product.sale_price || product.price).toLocaleString("en-IN")}
                </span>
                {product.sale_price && product.sale_price < product.price && (
                  <span className="text-xs line-through opacity-40">
                    ₹{product.price.toLocaleString("en-IN")}
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ── Alternating Editorial Sections ── */
function EditorialSection({
  title,
  subtitle,
  description,
  imageUrl,
  imageRight,
  ctaLabel,
  ctaTo,
}: {
  title: string;
  subtitle: string;
  description: string;
  imageUrl?: string;
  imageRight?: boolean;
  ctaLabel: string;
  ctaTo: string;
}) {
  const textBlock = (
    <div className="flex flex-col justify-center px-6 py-10 sm:px-10 lg:px-16">
      <p
        className="text-[10px] font-bold tracking-[0.3em] uppercase mb-3"
        style={{ color: "var(--storefront-primary, #1a1a1a)", opacity: 0.5 }}
      >
        {subtitle}
      </p>
      <h2
        className="text-2xl font-bold sm:text-3xl lg:text-4xl leading-tight"
        style={{
          fontFamily: "var(--storefront-heading-font, 'Playfair Display')",
          color: "var(--storefront-text, #1a1a1a)",
        }}
      >
        {title}
      </h2>
      <p
        className="mt-4 text-sm leading-relaxed max-w-md sm:text-base"
        style={{ color: "var(--storefront-text, #1a1a1a)", opacity: 0.5 }}
      >
        {description}
      </p>
      <Link
        to={ctaTo}
        className="mt-6 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wider transition-opacity hover:opacity-60"
        style={{ color: "var(--storefront-primary, #1a1a1a)" }}
      >
        {ctaLabel} <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );

  const imageBlock = (
    <div
      className="overflow-hidden"
      style={{ backgroundColor: "var(--storefront-text, #1a1a1a)05", minHeight: "300px" }}
    >
      {imageUrl ? (
        <img
          src={optimizeImageUrl(imageUrl, 800)}
          alt={title}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center" style={{ minHeight: "300px" }}>
          <span className="text-6xl font-bold opacity-[0.03]">{title.charAt(0)}</span>
        </div>
      )}
    </div>
  );

  return (
    <section className="grid grid-cols-1 lg:grid-cols-2">
      {imageRight ? (
        <>
          {textBlock}
          {imageBlock}
        </>
      ) : (
        <>
          {imageBlock}
          {textBlock}
        </>
      )}
    </section>
  );
}

/* ── Category Grid (Magazine Style) ── */
function MagazineCategoryGrid({ categories, slug }: { categories: any[]; slug: string }) {
  if (!categories || categories.length === 0) return null;

  return (
    <section className="py-12 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <p
          className="text-[10px] font-bold tracking-[0.3em] uppercase mb-2"
          style={{ color: "var(--storefront-primary, #1a1a1a)", opacity: 0.5 }}
        >
          Explore
        </p>
        <h2
          className="text-2xl font-bold sm:text-3xl lg:text-4xl mb-8"
          style={{
            fontFamily: "var(--storefront-heading-font, 'Playfair Display')",
            color: "var(--storefront-text, #1a1a1a)",
          }}
        >
          Shop by Category
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.slice(0, 6).map((cat) => (
            <Link
              key={cat.id}
              to={storefrontPath(slug, `category/${cat.slug}`)}
              className="group relative overflow-hidden"
              style={{ aspectRatio: "16/9" }}
            >
              {cat.image_url ? (
                <img
                  src={optimizeImageUrl(cat.image_url, 600)}
                  alt={cat.name}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <div
                  className="h-full w-full"
                  style={{ backgroundColor: "var(--storefront-primary, #1a1a1a)08" }}
                />
              )}
              {/* Overlay */}
              <div className="absolute inset-0 bg-black/30 transition-colors group-hover:bg-black/40" />
              <div className="absolute inset-0 flex items-end p-5">
                <h3
                  className="text-lg font-bold text-white uppercase tracking-wider sm:text-xl"
                  style={{ fontFamily: "var(--storefront-heading-font, 'Playfair Display')" }}
                >
                  {cat.name}
                </h3>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Scrolling Testimonial Strip ── */
function TestimonialStrip() {
  const testimonials = [
    { text: "Absolutely stunning quality. This is my new favourite store.", author: "Ananya K." },
    { text: "The editorial curation is beautiful. Every product feels intentional.", author: "Rohit D." },
    { text: "Fast shipping, gorgeous packaging. A premium experience.", author: "Priya M." },
  ];

  const [current, setCurrent] = useState(0);

  return (
    <section
      className="py-16 sm:py-24 text-center"
      style={{ backgroundColor: "var(--storefront-primary, #1a1a1a)06" }}
    >
      <Quote
        className="mx-auto h-8 w-8 mb-6"
        style={{ color: "var(--storefront-primary, #1a1a1a)", opacity: 0.2 }}
      />
      <div className="mx-auto max-w-2xl px-6">
        <p
          className="text-lg font-medium leading-relaxed sm:text-xl italic"
          style={{
            fontFamily: "var(--storefront-heading-font, 'Playfair Display')",
            color: "var(--storefront-text, #1a1a1a)",
          }}
        >
          "{testimonials[current].text}"
        </p>
        <p
          className="mt-4 text-sm font-semibold uppercase tracking-wider"
          style={{ color: "var(--storefront-text, #1a1a1a)", opacity: 0.4 }}
        >
          — {testimonials[current].author}
        </p>
      </div>
      <div className="mt-6 flex justify-center gap-2">
        {testimonials.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className="h-2 rounded-full transition-all"
            style={{
              width: current === i ? "24px" : "8px",
              backgroundColor:
                current === i
                  ? "var(--storefront-primary, #1a1a1a)"
                  : "var(--storefront-text, #1a1a1a)",
              opacity: current === i ? 1 : 0.15,
            }}
          />
        ))}
      </div>
    </section>
  );
}

/* ── Newsletter Band ── */
function NewsletterBand() {
  return (
    <section
      className="py-14 sm:py-20"
      style={{
        backgroundColor: "var(--storefront-accent, #1a1a1a)",
        color: "var(--storefront-bg, #ffffff)",
      }}
    >
      <div className="mx-auto max-w-xl px-6 text-center">
        <h2
          className="text-2xl font-bold sm:text-3xl"
          style={{ fontFamily: "var(--storefront-heading-font, 'Playfair Display')" }}
        >
          Stay in the Loop
        </h2>
        <p className="mt-3 text-sm opacity-50">
          Subscribe to receive stories, exclusive previews, and early access to new collections.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3 mx-auto max-w-md">
          <input
            type="email"
            placeholder="your@email.com"
            className="flex-1 px-5 py-3.5 text-sm border-0 outline-none"
            style={{
              backgroundColor: "rgba(255,255,255,0.1)",
              color: "var(--storefront-bg, #ffffff)",
              borderRadius: "var(--storefront-button-radius, 0px)",
            }}
          />
          <button
            className="px-6 py-3.5 text-sm font-semibold uppercase tracking-wider transition-opacity hover:opacity-80"
            style={{
              backgroundColor: "var(--storefront-primary, #ffffff)",
              color: "var(--storefront-btn-text, #1a1a1a)",
              borderRadius: "var(--storefront-button-radius, 0px)",
            }}
          >
            Subscribe
          </button>
        </div>
      </div>
    </section>
  );
}

/* ── All Products Grid ── */
function AllProductsGrid({ store, slug }: { store: StoreData; slug: string }) {
  const queryClient = useQueryClient();
  const products = queryClient.getQueryData<any[]>(["storefront-products", store.id]);

  return (
    <section className="py-12 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p
              className="text-[10px] font-bold tracking-[0.3em] uppercase mb-2"
              style={{ color: "var(--storefront-primary, #1a1a1a)", opacity: 0.5 }}
            >
              Full Collection
            </p>
            <h2
              className="text-2xl font-bold sm:text-3xl lg:text-4xl"
              style={{
                fontFamily: "var(--storefront-heading-font, 'Playfair Display')",
                color: "var(--storefront-text, #1a1a1a)",
              }}
            >
              All Products
            </h2>
          </div>
          <Link
            to={storefrontPath(store.slug, "best-sellers")}
            className="text-sm font-medium flex items-center gap-1 transition-opacity hover:opacity-60"
            style={{ color: "var(--storefront-primary, #1a1a1a)" }}
          >
            View All <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {!products ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="w-full" style={{ aspectRatio: "3/4" }} />
                <Skeleton className="mt-3 h-4 w-3/4" />
                <Skeleton className="mt-1.5 h-4 w-1/3" />
              </div>
            ))}
          </div>
        ) : products.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
              {products.slice(0, 12).map((product, idx) => (
                <StorefrontProductCard key={product.id} product={product} slug={slug} store={store} priority={idx < 4} />
              ))}
            </div>
            {products.length > 12 && (
              <LazyRender rootMargin="400px" minHeight={400}>
                <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4 mt-4">
                  {products.slice(12).map((product) => (
                    <StorefrontProductCard key={product.id} product={product} slug={slug} store={store} />
                  ))}
                </div>
              </LazyRender>
            )}
          </>
        ) : (
          <div className="py-20 text-center">
            <p className="text-sm opacity-50">No products available yet. Check back soon!</p>
          </div>
        )}
      </div>
    </section>
  );
}

/* ── Main Home Page ── */
export default function StorefrontHomeV7() {
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
  const storeCategories = queryClient.getQueryData<any[]>(["storefront-categories", store.id]);

  // Pick images for editorial sections
  const editorialImage1 = products?.find((p) => p.image_url)?.image_url || store.banner_url;
  const editorialImage2 = products?.slice(1).find((p) => p.image_url)?.image_url || null;

  return (
    <>
      <StorefrontSearchOverlay
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        products={products}
        slug={slug!}
      />

      {/* Split Hero */}
      <SplitHero store={store} />

      {/* Horizontal Product Carousel */}
      <HorizontalProductStrip store={store} slug={slug!} />

      {/* Editorial Section 1 */}
      <EditorialSection
        title="Our Story"
        subtitle="The Beginning"
        description="Every product in our collection is thoughtfully curated. We believe in quality over quantity — each piece is selected for its craftsmanship, design, and the story it tells."
        imageUrl={editorialImage1 || undefined}
        imageRight={false}
        ctaLabel="Learn More"
        ctaTo={storefrontPath(store.slug, "contact")}
      />

      {/* Category Grid */}
      {storeCategories && storeCategories.length > 0 && (
        <MagazineCategoryGrid categories={storeCategories} slug={slug!} />
      )}

      {/* Editorial Section 2 */}
      <EditorialSection
        title="Bestsellers"
        subtitle="Most Loved"
        description="Discover what our community loves most. These are the pieces that keep coming back — tried, tested, and adored by customers everywhere."
        imageUrl={editorialImage2 || undefined}
        imageRight={true}
        ctaLabel="Shop Bestsellers"
        ctaTo={storefrontPath(store.slug, "best-sellers")}
      />

      {/* All Products */}
      <AllProductsGrid store={store} slug={slug!} />

      {/* Testimonial */}
      <LazyRender rootMargin="200px" minHeight={200}>
        <TestimonialStrip />
      </LazyRender>

      {/* Newsletter */}
      <LazyRender rootMargin="200px" minHeight={200}>
        <NewsletterBand />
      </LazyRender>
    </>
  );
}
