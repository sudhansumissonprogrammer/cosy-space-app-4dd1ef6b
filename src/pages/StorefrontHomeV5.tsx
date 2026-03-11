import { useState, useMemo, useEffect } from "react";
import { useOutletContext, useParams, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Sparkles, Zap, Shield, Truck, Star, ArrowRight, Package, ChevronLeft, ChevronRight, Quote } from "lucide-react";
import type { StoreData } from "@/layouts/StorefrontLayout";
import StorefrontProductCard from "@/components/storefront/StorefrontProductCard";
import StorefrontSearchOverlay from "@/components/storefront/StorefrontSearchOverlay";
import LazyRender from "@/components/storefront/LazyRender";
import { useStoreJsonLd } from "@/hooks/useJsonLd";
import { Skeleton } from "@/components/ui/skeleton";
import { storefrontPath } from "@/lib/subdomain";
import { optimizeImageUrl } from "@/lib/imageOptimize";

/* ── Gradient Hero with Floating Cards ── */
function GradientHero({ store }: { store: StoreData }) {
  const queryClient = useQueryClient();
  const products = queryClient.getQueryData<any[]>(["storefront-products", store.id]);
  const floatingProducts = products?.filter((p: any) => p.image_url).slice(0, 3) || [];

  return (
    <section className="relative w-full overflow-hidden" style={{ minHeight: "70vh" }}>
      {/* Gradient background */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 50% -20%, var(--storefront-primary, #6366F1)40, transparent),
            radial-gradient(ellipse 60% 50% at 80% 80%, var(--storefront-accent, #22C55E)25, transparent),
            radial-gradient(ellipse 50% 40% at 20% 60%, var(--storefront-primary, #6366F1)15, transparent),
            var(--storefront-bg, #0F172A)
          `,
        }}
      />

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Content */}
      <div className="relative mx-auto max-w-7xl px-4 pt-24 pb-16 sm:px-6 sm:pt-32 sm:pb-20 lg:px-12 lg:pt-40">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
          {/* Left: Text */}
          <div className="animate-fade-in">
            <div
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-md px-4 py-1.5 mb-6"
            >
              <Sparkles className="h-3.5 w-3.5" style={{ color: "var(--storefront-accent, #22C55E)" }} />
              <span className="text-[11px] font-medium tracking-wide opacity-80">New Collection Available</span>
            </div>

            <h1
              className="text-3xl font-bold leading-[1.1] sm:text-5xl lg:text-6xl"
              style={{ fontFamily: "var(--storefront-heading-font, 'Space Grotesk')" }}
            >
              {store.name}
            </h1>
            <p className="mt-5 text-base leading-relaxed opacity-60 max-w-md">
              {store.description || "Discover premium products crafted for the modern generation."}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to={storefrontPath(store.slug, "best-sellers")}
                className="inline-flex items-center gap-2 px-7 py-3.5 text-sm font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg"
                style={{
                  background: `linear-gradient(135deg, var(--storefront-primary, #6366F1), var(--storefront-accent, #22C55E))`,
                  color: "#fff",
                  borderRadius: "var(--storefront-button-radius, 0.75rem)",
                  boxShadow: "0 4px 20px var(--storefront-primary, #6366F1)40",
                }}
              >
                Shop Now <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to={storefrontPath(store.slug, "contact")}
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 backdrop-blur-md px-7 py-3.5 text-sm font-semibold transition-all duration-300 hover:bg-white/10"
              >
                Learn More
              </Link>
            </div>
          </div>

          {/* Right: Floating product cards */}
          <div className="relative hidden lg:block" style={{ height: "420px" }}>
            {floatingProducts.map((product, idx) => {
              const positions = [
                { top: "0%", right: "10%", rotate: "3deg", delay: "0s" },
                { top: "35%", right: "0%", rotate: "-2deg", delay: "0.15s" },
                { top: "15%", right: "40%", rotate: "1deg", delay: "0.3s" },
              ];
              const pos = positions[idx];
              return (
                <Link
                  key={product.id}
                  to={storefrontPath(store.slug, `product/${product.slug || product.id}`)}
                  className="absolute w-44 overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl transition-all duration-500 hover:scale-110 hover:border-white/20 animate-fade-in"
                  style={{
                    top: pos.top,
                    right: pos.right,
                    transform: `rotate(${pos.rotate})`,
                    animationDelay: pos.delay,
                  }}
                >
                  <img
                    src={optimizeImageUrl(product.image_url, 400)}
                    alt={product.name}
                    className="w-full object-cover"
                    style={{ aspectRatio: "4/5" }}
                    loading="eager"
                  />
                  <div className="p-3">
                    <p className="text-xs font-semibold line-clamp-1">{product.name}</p>
                    <p className="text-xs mt-0.5 opacity-60">₹{Number(product.sale_price || product.price).toFixed(0)}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Category Tabs ── */
function CategoryTabs({
  categories,
  activeCategory,
  onSelect,
}: {
  categories: any[];
  activeCategory: string;
  onSelect: (cat: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
      <button
        onClick={() => onSelect("all")}
        className="flex-shrink-0 rounded-xl px-5 py-2.5 text-sm font-medium transition-all duration-300"
        style={{
          background: activeCategory === "all"
            ? "linear-gradient(135deg, var(--storefront-primary, #6366F1), var(--storefront-accent, #22C55E))"
            : "rgba(255,255,255,0.05)",
          color: activeCategory === "all" ? "#fff" : "inherit",
          border: activeCategory === "all" ? "none" : "1px solid rgba(255,255,255,0.08)",
        }}
      >
        All
      </button>
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onSelect(cat.slug)}
          className="flex-shrink-0 rounded-xl px-5 py-2.5 text-sm font-medium transition-all duration-300 whitespace-nowrap"
          style={{
            background: activeCategory === cat.slug
              ? "linear-gradient(135deg, var(--storefront-primary, #6366F1), var(--storefront-accent, #22C55E))"
              : "rgba(255,255,255,0.05)",
            color: activeCategory === cat.slug ? "#fff" : "inherit",
            border: activeCategory === cat.slug ? "none" : "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {cat.name}
        </button>
      ))}
    </div>
  );
}

/* ── Benefits Section ── */
function BenefitsSection() {
  const benefits = [
    { icon: Zap, title: "Lightning Fast", desc: "Same-day dispatch on all orders" },
    { icon: Shield, title: "Secure Payments", desc: "256-bit encrypted checkout" },
    { icon: Truck, title: "Free Shipping", desc: "On orders above ₹999" },
    { icon: Sparkles, title: "Premium Quality", desc: "Handpicked, curated products" },
  ];

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16 lg:px-12">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
        {benefits.map((b, idx) => (
          <div
            key={idx}
            className="group rounded-2xl border border-white/8 bg-white/[0.03] backdrop-blur-sm p-4 sm:p-6 text-center transition-all duration-300 hover:bg-white/[0.06] hover:border-white/15 hover:scale-[1.02]"
          >
            <div
              className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl mb-4 transition-transform duration-300 group-hover:scale-110"
              style={{ background: `linear-gradient(135deg, var(--storefront-primary, #6366F1)20, var(--storefront-accent, #22C55E)20)` }}
            >
              <b.icon className="h-5 w-5" style={{ color: "var(--storefront-primary, #6366F1)" }} />
            </div>
            <h3 className="text-sm font-semibold mb-1" style={{ fontFamily: "var(--storefront-heading-font, 'Space Grotesk')" }}>
              {b.title}
            </h3>
            <p className="text-xs opacity-50">{b.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Testimonials Slider ── */
function TestimonialsSlider() {
  const [current, setCurrent] = useState(0);
  const reviews = [
    { name: "Ananya K.", text: "The quality blew me away. Packaging was premium and delivery was super fast!", rating: 5, avatar: "AK" },
    { name: "Rohit D.", text: "Best online shopping experience. The UI is so smooth and products are exactly as shown.", rating: 5, avatar: "RD" },
    { name: "Priya M.", text: "I've ordered 3 times now. Consistent quality and amazing customer service.", rating: 5, avatar: "PM" },
  ];

  useEffect(() => {
    const timer = setInterval(() => setCurrent((c) => (c + 1) % reviews.length), 4000);
    return () => clearInterval(timer);
  }, []);

  const review = reviews[current];

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16 lg:px-12">
      <div className="text-center mb-10">
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[11px] font-medium mb-4"
          style={{ color: "var(--storefront-accent, #22C55E)" }}
        >
          <Star className="h-3 w-3 fill-current" /> Customer Love
        </span>
        <h2
          className="text-2xl font-bold sm:text-3xl"
          style={{ fontFamily: "var(--storefront-heading-font, 'Space Grotesk')" }}
        >
          What People Say
        </h2>
      </div>

      <div className="mx-auto max-w-2xl">
        <div
          className="rounded-2xl border border-white/8 bg-white/[0.03] backdrop-blur-sm p-8 md:p-10 text-center transition-all duration-500"
        >
          <div className="flex justify-center gap-1 mb-4">
            {Array.from({ length: review.rating }).map((_, i) => (
              <Star key={i} className="h-4 w-4 fill-current" style={{ color: "var(--storefront-accent, #22C55E)" }} />
            ))}
          </div>
          <p className="text-base leading-relaxed opacity-80 italic">"{review.text}"</p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold"
              style={{ background: `linear-gradient(135deg, var(--storefront-primary, #6366F1), var(--storefront-accent, #22C55E))`, color: "#fff" }}
            >
              {review.avatar}
            </div>
            <span className="text-sm font-medium">{review.name}</span>
          </div>
        </div>

        {/* Dots */}
        <div className="flex justify-center gap-2 mt-6">
          {reviews.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className="h-2 rounded-full transition-all duration-300"
              style={{
                width: i === current ? "24px" : "8px",
                background: i === current
                  ? `linear-gradient(135deg, var(--storefront-primary, #6366F1), var(--storefront-accent, #22C55E))`
                  : "rgba(255,255,255,0.15)",
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Newsletter ── */
function GradientNewsletter() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16 lg:px-12">
      <div
        className="relative overflow-hidden rounded-3xl p-6 sm:p-8 md:p-12 text-center"
        style={{
          background: `linear-gradient(135deg, var(--storefront-primary, #6366F1), var(--storefront-accent, #22C55E))`,
        }}
      >
        {/* Glass overlay */}
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative z-10">
          <h2 className="text-2xl font-bold text-white sm:text-3xl" style={{ fontFamily: "var(--storefront-heading-font, 'Space Grotesk')" }}>
            Stay in the Loop
          </h2>
          <p className="mt-2 text-sm text-white/70 max-w-md mx-auto">Get exclusive deals, early access, and product drops straight to your inbox.</p>
          <div className="mt-6 mx-auto max-w-md flex items-center gap-2">
            <input
              type="email"
              placeholder="your@email.com"
              className="flex-1 rounded-xl border-0 bg-white/20 backdrop-blur-md px-5 py-3 text-sm text-white placeholder:text-white/50 outline-none focus:bg-white/30 transition-colors"
            />
            <button className="rounded-xl bg-white px-6 py-3 text-sm font-semibold transition-all duration-300 hover:scale-105" style={{ color: "var(--storefront-primary, #6366F1)" }}>
              Subscribe
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Main Home Page ── */
export default function StorefrontHomeV5() {
  const store = useOutletContext<StoreData>();
  const { slug } = useParams<{ slug: string }>();
  const queryClient = useQueryClient();
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");

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

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    if (activeCategory === "all") return products;
    return products.filter((p: any) => p.category?.toLowerCase() === activeCategory.toLowerCase());
  }, [products, activeCategory]);

  return (
    <>
      {/* Hero */}
      <GradientHero store={store} />

      {/* Search */}
      <StorefrontSearchOverlay
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        products={products}
        slug={slug!}
      />

      {/* Benefits */}
      <BenefitsSection />

      {/* Products with Category Tabs */}
      <section className="mx-auto max-w-7xl px-6 py-12 lg:px-12">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-medium mb-2"
              style={{ color: "var(--storefront-accent, #22C55E)" }}
            >
              <Sparkles className="h-3 w-3" /> Curated for You
            </span>
            <h2
              className="text-2xl font-bold sm:text-3xl"
              style={{ fontFamily: "var(--storefront-heading-font, 'Space Grotesk')" }}
            >
              Our Products
            </h2>
          </div>
        </div>

        {/* Category Tabs */}
        {storeCategories && storeCategories.length > 0 && (
          <div className="mb-8">
            <CategoryTabs
              categories={storeCategories}
              activeCategory={activeCategory}
              onSelect={setActiveCategory}
            />
          </div>
        )}

        {/* Product Grid */}
        {!products ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-white/8 bg-white/[0.03] overflow-hidden">
                <Skeleton className="w-full opacity-20" style={{ aspectRatio: "4/5" }} />
                <div className="p-3 space-y-2">
                  <Skeleton className="h-3 w-16 opacity-20" />
                  <Skeleton className="h-4 w-full opacity-20" />
                  <Skeleton className="h-8 w-full rounded-xl opacity-20" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredProducts.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
              {filteredProducts.slice(0, 12).map((product, idx) => (
                <StorefrontProductCard key={product.id} product={product} slug={slug!} store={store} priority={idx < 4} />
              ))}
            </div>
            {filteredProducts.length > 12 && (
              <LazyRender rootMargin="400px" minHeight={400}>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-6 mt-6">
                  {filteredProducts.slice(12).map((product) => (
                    <StorefrontProductCard key={product.id} product={product} slug={slug!} store={store} />
                  ))}
                </div>
              </LazyRender>
            )}
          </>
        ) : (
          <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-white/8 bg-white/[0.03]">
            <p className="text-sm opacity-50">No products in this category.</p>
          </div>
        )}
      </section>

      {/* Testimonials */}
      <LazyRender rootMargin="300px" minHeight={300}>
        <TestimonialsSlider />
      </LazyRender>

      {/* Newsletter */}
      <LazyRender rootMargin="200px" minHeight={200}>
        <GradientNewsletter />
      </LazyRender>
    </>
  );
}
