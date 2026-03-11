import { useState, useMemo } from "react";
import { useOutletContext, useParams, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Truck, Shield, RotateCcw, Star, ArrowRight, Tag } from "lucide-react";
import type { StoreData } from "@/layouts/StorefrontLayout";
import StorefrontProductCard from "@/components/storefront/StorefrontProductCard";
import StorefrontSearchOverlay from "@/components/storefront/StorefrontSearchOverlay";
import LazyRender from "@/components/storefront/LazyRender";
import { useStoreJsonLd } from "@/hooks/useJsonLd";
import { Skeleton } from "@/components/ui/skeleton";
import { storefrontPath } from "@/lib/subdomain";
import { optimizeImageUrl } from "@/lib/imageOptimize";

/* ── Two-Column Hero ── */
function HeroSection({ store }: { store: StoreData }) {
  const queryClient = useQueryClient();
  const products = queryClient.getQueryData<any[]>(["storefront-products", store.id]);
  const heroProduct = products?.find((p: any) => p.image_url) || null;

  return (
    <section className="mx-auto max-w-7xl px-4 lg:px-8 pt-10 pb-10 sm:pt-20 sm:pb-20 lg:pt-[80px] lg:pb-[80px]">
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
        {/* Left text */}
        <div>
          <h1
            className="text-3xl font-bold leading-[1.1] sm:text-5xl lg:text-6xl"
            style={{ fontFamily: "var(--storefront-heading-font, 'Poppins')", color: "var(--storefront-text, #1e293b)" }}
          >
            {store.name}
          </h1>
          <p
            className="mt-5 text-lg leading-relaxed max-w-lg"
            style={{ color: "var(--storefront-text, #1e293b)", opacity: 0.6 }}
          >
            {store.description || "Discover premium products crafted with care. Quality you can trust, style you'll love."}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              to={storefrontPath(store.slug, "best-sellers")}
              className="inline-flex items-center gap-2 px-8 py-4 text-sm font-semibold transition-all duration-300 hover:shadow-lg hover:scale-[1.02]"
              style={{
                backgroundColor: "var(--storefront-primary, #2563EB)",
                color: "var(--storefront-btn-text, #fff)",
                borderRadius: "var(--storefront-button-radius, 0.75rem)",
              }}
            >
              Shop Now <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to={storefrontPath(store.slug, "contact")}
              className="inline-flex items-center gap-2 px-8 py-4 text-sm font-semibold border transition-all duration-300 hover:opacity-70"
              style={{
                borderColor: "var(--storefront-text, #1e293b)20",
                color: "var(--storefront-text, #1e293b)",
                borderRadius: "var(--storefront-button-radius, 0.75rem)",
              }}
            >
              Learn More
            </Link>
          </div>
        </div>

        {/* Right image */}
        <div className="relative">
          {heroProduct?.image_url ? (
            <div className="overflow-hidden" style={{ borderRadius: "24px" }}>
              <img
                src={optimizeImageUrl(heroProduct.image_url, 800)}
                alt={heroProduct.name}
                className="w-full object-cover transition-transform duration-700 hover:scale-105"
                style={{ aspectRatio: "4/5", maxHeight: "560px" }}
                loading="eager"
              />
            </div>
          ) : store.banner_url ? (
            <div className="overflow-hidden" style={{ borderRadius: "24px" }}>
              <img
                src={store.banner_url}
                alt={store.name}
                className="w-full object-cover"
                style={{ aspectRatio: "4/5", maxHeight: "560px" }}
                loading="eager"
              />
            </div>
          ) : (
            <div
              className="flex items-center justify-center"
              style={{
                aspectRatio: "4/5",
                maxHeight: "560px",
                borderRadius: "24px",
                background: `linear-gradient(135deg, var(--storefront-primary, #2563EB)15, var(--storefront-accent, #F97316)10)`,
              }}
            >
              <span className="text-6xl font-bold opacity-10" style={{ fontFamily: "var(--storefront-heading-font, 'Poppins')" }}>
                {store.name.charAt(0)}
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ── Category Section ── */
function CategoryGrid({ categories, slug }: { categories: any[]; slug: string }) {
  if (!categories || categories.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 lg:px-8" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <h2
        className="text-2xl font-bold mb-8 sm:text-3xl"
        style={{ fontFamily: "var(--storefront-heading-font, 'Poppins')", color: "var(--storefront-text, #1e293b)" }}
      >
        Shop by Category
      </h2>
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
        {categories.slice(0, 8).map((cat) => (
          <Link
            key={cat.id}
            to={storefrontPath(slug, `category/${cat.slug}`)}
            className="group overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
            style={{ borderRadius: "16px", border: "1px solid", borderColor: "var(--storefront-text, #1e293b)10" }}
          >
            <div className="overflow-hidden" style={{ aspectRatio: "1/1" }}>
              {cat.image_url ? (
                <img
                  src={cat.image_url}
                  alt={cat.name}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  loading="lazy"
                />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center"
                  style={{ backgroundColor: "var(--storefront-primary, #2563EB)08" }}
                >
                  <Tag className="h-8 w-8" style={{ color: "var(--storefront-primary, #2563EB)", opacity: 0.3 }} />
                </div>
              )}
            </div>
            <div className="p-4 text-center">
              <span
                className="text-sm font-semibold"
                style={{ fontFamily: "var(--storefront-heading-font, 'Poppins')", color: "var(--storefront-text, #1e293b)" }}
              >
                {cat.name}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ── Benefits Section ── */
function BenefitsSection() {
  const benefits = [
    { icon: Truck, title: "Fast Shipping", desc: "Free delivery on orders above ₹999" },
    { icon: Shield, title: "Secure Payments", desc: "256-bit encrypted checkout" },
    { icon: RotateCcw, title: "Easy Returns", desc: "Hassle-free 7-day return policy" },
  ];

  return (
    <section className="mx-auto max-w-7xl px-4 lg:px-8" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {benefits.map((b, idx) => (
          <div
            key={idx}
            className="flex items-start gap-4 p-6 transition-all duration-300 hover:-translate-y-1"
            style={{
              borderRadius: "16px",
              border: "1px solid",
              borderColor: "var(--storefront-text, #1e293b)08",
            }}
          >
            <div
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center"
              style={{
                borderRadius: "12px",
                backgroundColor: "var(--storefront-primary, #2563EB)10",
              }}
            >
              <b.icon className="h-5 w-5" style={{ color: "var(--storefront-primary, #2563EB)" }} />
            </div>
            <div>
              <h3
                className="text-sm font-semibold mb-1"
                style={{ fontFamily: "var(--storefront-heading-font, 'Poppins')", color: "var(--storefront-text, #1e293b)" }}
              >
                {b.title}
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: "var(--storefront-text, #1e293b)", opacity: 0.5 }}>
                {b.desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Testimonials ── */
function TestimonialsSection() {
  const reviews = [
    { name: "Ananya K.", text: "The quality exceeded my expectations. Will definitely order again!", rating: 5, avatar: "AK" },
    { name: "Rohit D.", text: "Amazing shopping experience. Fast delivery and great packaging.", rating: 5, avatar: "RD" },
    { name: "Priya M.", text: "Love the attention to detail. Customer service was outstanding.", rating: 5, avatar: "PM" },
  ];

  return (
    <section className="mx-auto max-w-7xl px-4 lg:px-8" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <h2
        className="text-2xl font-bold mb-8 sm:text-3xl"
        style={{ fontFamily: "var(--storefront-heading-font, 'Poppins')", color: "var(--storefront-text, #1e293b)" }}
      >
        What Our Customers Say
      </h2>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {reviews.map((review, idx) => (
          <div
            key={idx}
            className="p-6 transition-all duration-300 hover:-translate-y-1"
            style={{
              borderRadius: "16px",
              border: "1px solid",
              borderColor: "var(--storefront-text, #1e293b)08",
            }}
          >
            <div className="flex gap-0.5 mb-4">
              {Array.from({ length: review.rating }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-current" style={{ color: "var(--storefront-primary, #2563EB)" }} />
              ))}
            </div>
            <p
              className="text-sm leading-relaxed mb-6"
              style={{ color: "var(--storefront-text, #1e293b)", opacity: 0.7 }}
            >
              "{review.text}"
            </p>
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold"
                style={{ backgroundColor: "var(--storefront-primary, #2563EB)", color: "var(--storefront-btn-text, #fff)" }}
              >
                {review.avatar}
              </div>
              <span className="text-sm font-medium" style={{ color: "var(--storefront-text, #1e293b)" }}>
                {review.name}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Newsletter ── */
function NewsletterSection() {
  return (
    <section className="mx-auto max-w-7xl px-4 lg:px-8" style={{ paddingBottom: "80px" }}>
      <div
        className="text-center p-10 sm:p-16"
        style={{
          borderRadius: "24px",
          backgroundColor: "var(--storefront-primary, #2563EB)08",
          border: "1px solid",
          borderColor: "var(--storefront-primary, #2563EB)15",
        }}
      >
        <h2
          className="text-2xl font-bold sm:text-3xl"
          style={{ fontFamily: "var(--storefront-heading-font, 'Poppins')", color: "var(--storefront-text, #1e293b)" }}
        >
          Stay Updated
        </h2>
        <p className="mt-3 text-sm max-w-md mx-auto" style={{ color: "var(--storefront-text, #1e293b)", opacity: 0.6 }}>
          Subscribe to get special offers, exclusive deals, and the latest news.
        </p>
        <div className="mt-6 mx-auto max-w-md flex items-center gap-3">
          <input
            type="email"
            placeholder="Enter your email"
            className="flex-1 px-5 py-3.5 text-sm border outline-none transition-colors focus:border-current"
            style={{
              borderRadius: "var(--storefront-button-radius, 0.75rem)",
              borderColor: "var(--storefront-text, #1e293b)15",
              backgroundColor: "var(--storefront-bg, #F8FAFC)",
              color: "var(--storefront-text, #1e293b)",
            }}
          />
          <button
            className="px-6 py-3.5 text-sm font-semibold transition-all duration-300 hover:shadow-lg hover:scale-[1.02]"
            style={{
              backgroundColor: "var(--storefront-primary, #2563EB)",
              color: "var(--storefront-btn-text, #fff)",
              borderRadius: "var(--storefront-button-radius, 0.75rem)",
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
export default function StorefrontHomeV6() {
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

  return (
    <>
      {/* Hero */}
      <HeroSection store={store} />

      {/* Search */}
      <StorefrontSearchOverlay
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        products={products}
        slug={slug!}
      />

      {/* Categories */}
      {storeCategories && storeCategories.length > 0 && (
        <CategoryGrid categories={storeCategories} slug={slug!} />
      )}

      {/* Featured Products */}
      <section className="mx-auto max-w-7xl px-4 lg:px-8" style={{ paddingBottom: "80px" }}>
        <div className="flex items-center justify-between mb-8">
          <h2
            className="text-2xl font-bold sm:text-3xl"
            style={{ fontFamily: "var(--storefront-heading-font, 'Poppins')", color: "var(--storefront-text, #1e293b)" }}
          >
            Featured Products
          </h2>
          <Link
            to={storefrontPath(store.slug, "best-sellers")}
            className="text-sm font-medium flex items-center gap-1 transition-opacity hover:opacity-70"
            style={{ color: "var(--storefront-primary, #2563EB)" }}
          >
            View All <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {!products ? (
          <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="overflow-hidden" style={{ borderRadius: "16px", border: "1px solid", borderColor: "var(--storefront-text, #1e293b)08" }}>
                <Skeleton className="w-full" style={{ aspectRatio: "4/5" }} />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-10 w-full rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
              {products.slice(0, 12).map((product, idx) => (
                <StorefrontProductCard key={product.id} product={product} slug={slug!} store={store} priority={idx < 4} />
              ))}
            </div>
            {products.length > 12 && (
              <LazyRender rootMargin="400px" minHeight={400}>
                <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4 mt-6">
                  {products.slice(12).map((product) => (
                    <StorefrontProductCard key={product.id} product={product} slug={slug!} store={store} />
                  ))}
                </div>
              </LazyRender>
            )}
          </>
        ) : (
          <div className="py-20 text-center">
            <p className="text-sm" style={{ color: "var(--storefront-text, #1e293b)", opacity: 0.5 }}>
              No products available yet. Check back soon!
            </p>
          </div>
        )}
      </section>

      {/* Benefits */}
      <BenefitsSection />

      {/* Testimonials */}
      <LazyRender rootMargin="200px" minHeight={300}>
        <TestimonialsSection />
      </LazyRender>

      {/* Newsletter */}
      <LazyRender rootMargin="200px" minHeight={200}>
        <NewsletterSection />
      </LazyRender>
    </>
  );
}
