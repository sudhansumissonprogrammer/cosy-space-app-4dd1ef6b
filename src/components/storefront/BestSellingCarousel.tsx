import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Autoplay from "embla-carousel-autoplay";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
} from "@/components/ui/carousel";
import UniversalProductCard from "./UniversalProductCard";
import type { StoreData } from "@/layouts/StorefrontLayout";
import { storefrontPath } from "@/lib/subdomain";

interface BestSellingCarouselProps {
  products: any[];
  slug: string;
  store: StoreData;
  cardStyle?: string;
}

export default function BestSellingCarousel({ products, slug, store, cardStyle = "style-1" }: BestSellingCarouselProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!api) return;
    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap());
    api.on("select", () => setCurrent(api.selectedScrollSnap()));
  }, [api]);

  if (products.length === 0) return null;

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>🔥 Best Selling</h2>
        <Link
          to={storefrontPath(slug, "shop")}
          className="inline-flex items-center gap-1 text-xs font-semibold hover:underline"
          style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}
        >
          View All <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="relative px-0 md:px-12">
        <Carousel
          setApi={setApi}
          opts={{
            align: "start",
            loop: products.length > 4,
          }}
          plugins={[
            Autoplay({ delay: 3000, stopOnInteraction: true, stopOnMouseEnter: true }),
          ]}
          className="w-full"
        >
          <CarouselContent className="-ml-3">
            {products.map((product) => (
              <CarouselItem
                key={product.id}
                className="pl-3 basis-1/2 sm:basis-1/3 md:basis-1/4 lg:basis-1/5"
              >
                <UniversalProductCard
                  product={product}
                  slug={slug}
                  store={store}
                  cardStyle={cardStyle}
                />
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="hidden md:inline-flex -left-2 md:-left-10" />
          <CarouselNext className="hidden md:inline-flex -right-2 md:-right-10" />
        </Carousel>

        {/* Mobile arrows + dots */}
        <div className="flex md:hidden items-center justify-center gap-4 mt-3">
          <button
            onClick={() => api?.scrollPrev()}
            className="h-8 w-8 rounded-full border border-border bg-card flex items-center justify-center text-foreground hover:bg-accent transition-colors"
            aria-label="Previous"
          >
            ‹
          </button>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: count }).map((_, i) => (
              <button
                key={i}
                onClick={() => api?.scrollTo(i)}
                className={`h-2 w-2 rounded-full transition-opacity duration-300 ${
                  i === current
                    ? "bg-foreground opacity-100"
                    : "bg-muted-foreground/30 opacity-100 hover:bg-muted-foreground/50"
                }`}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
          <button
            onClick={() => api?.scrollNext()}
            className="h-8 w-8 rounded-full border border-border bg-card flex items-center justify-center text-foreground hover:bg-accent transition-colors"
            aria-label="Next"
          >
            ›
          </button>
        </div>

        {/* Desktop dots */}
        <div className="hidden md:flex items-center justify-center gap-1.5 mt-3">
          {Array.from({ length: count }).map((_, i) => (
            <button
              key={i}
              onClick={() => api?.scrollTo(i)}
              className={`h-2 w-2 rounded-full transition-opacity duration-300 ${
                i === current
                  ? "bg-foreground opacity-100"
                  : "bg-muted-foreground/30 opacity-100 hover:bg-muted-foreground/50"
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
