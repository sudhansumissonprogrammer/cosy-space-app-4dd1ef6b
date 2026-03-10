import { useState, useCallback, useEffect } from "react";
import Autoplay from "embla-carousel-autoplay";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
} from "@/components/ui/carousel";
import StorefrontProductCard from "./StorefrontProductCard";
import type { StoreData } from "@/layouts/StorefrontLayout";

interface BestSellingCarouselProps {
  products: any[];
  slug: string;
  store: StoreData;
}

export default function BestSellingCarousel({ products, slug, store }: BestSellingCarouselProps) {
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
      <h2 className="mb-4 text-xl font-bold text-foreground">🔥 Best Selling</h2>
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
                className="pl-3 basis-1/2 sm:basis-1/3 md:basis-1/4"
              >
                <StorefrontProductCard
                  product={product}
                  slug={slug}
                  store={store}
                />
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="hidden md:inline-flex -left-2 md:-left-10" />
          <CarouselNext className="hidden md:inline-flex -right-2 md:-right-10" />
        </Carousel>

        {/* Mobile arrows */}
        <div className="flex md:hidden items-center justify-center gap-4 mt-3">
          <button
            onClick={() => api?.scrollPrev()}
            className="h-8 w-8 rounded-full border border-border bg-card flex items-center justify-center text-foreground hover:bg-accent transition-colors"
            aria-label="Previous"
          >
            ‹
          </button>

          {/* Dot indicators */}
          <div className="flex items-center gap-1.5">
            {Array.from({ length: count }).map((_, i) => (
              <button
                key={i}
                onClick={() => api?.scrollTo(i)}
                className={`rounded-full transition-all duration-300 ${
                  i === current
                    ? "w-5 h-2 bg-primary"
                    : "w-2 h-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
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

        {/* Desktop dot indicators */}
        <div className="hidden md:flex items-center justify-center gap-1.5 mt-3">
          {Array.from({ length: count }).map((_, i) => (
            <button
              key={i}
              onClick={() => api?.scrollTo(i)}
              className={`rounded-full transition-all duration-300 ${
                i === current
                  ? "w-5 h-2 bg-primary"
                  : "w-2 h-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
