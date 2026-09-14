import { useEffect, useState } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
} from "@/components/ui/carousel";
import UniversalProductCard from "@/components/storefront/UniversalProductCard";

interface Props {
  title: string;
  items: any[];
  slug: string;
  store: any;
  cardStyle?: string;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  fetchNextPage?: () => void;
}

/**
 * Horizontal product carousel with in-carousel infinite loading.
 * ~6 visible tiles on desktop, 2.2 on mobile. Next page is requested
 * when the shopper reaches the last few snaps (or when dedupe left the
 * visible list too short to fill one screen).
 */
export default function PdpProductCarousel({
  title,
  items,
  slug,
  store,
  cardStyle = "style-1",
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: Props) {
  const [api, setApi] = useState<CarouselApi>();

  // Load more as the shopper approaches the end of the strip.
  useEffect(() => {
    if (!api || !fetchNextPage) return;
    const onSelect = () => {
      const snaps = api.scrollSnapList().length;
      if (snaps === 0) return;
      if (api.selectedScrollSnap() >= snaps - 2 && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    };
    api.on("select", onSelect);
    api.on("reInit", onSelect);
    return () => {
      api.off("select", onSelect);
      api.off("reInit", onSelect);
    };
  }, [api, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Dedupe can leave a page nearly empty — top up until the strip is usable.
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && items.length > 0 && items.length < 6) {
      fetchNextPage?.();
    }
  }, [items.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (items.length === 0) return null;

  return (
    <section className="mt-8">
      <h2
        className="text-base sm:text-lg font-bold mb-3"
        style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}
      >
        {title}
      </h2>
      <div className="relative md:px-10">
        <Carousel setApi={setApi} opts={{ align: "start", dragFree: true, containScroll: "trimSnaps" }} className="w-full">
          <CarouselContent className="-ml-2">
            {items.map((product, i) => (
              <CarouselItem
                key={product.id}
                className="pl-2 basis-[45%] sm:basis-1/3 md:basis-1/4 lg:basis-1/6"
              >
                <UniversalProductCard
                  product={product}
                  slug={slug}
                  store={store}
                  cardStyle={cardStyle}
                  index={i}
                  deferOffscreen={false}
                />
              </CarouselItem>
            ))}
            {isFetchingNextPage && (
              <CarouselItem className="pl-2 basis-[45%] sm:basis-1/3 md:basis-1/4 lg:basis-1/6">
                <div className="w-full aspect-[3/4] rounded-lg bg-muted animate-pulse" />
              </CarouselItem>
            )}
          </CarouselContent>
          <CarouselPrevious className="hidden md:inline-flex -left-2 md:-left-9" />
          <CarouselNext className="hidden md:inline-flex -right-2 md:-right-9" />
        </Carousel>
      </div>
    </section>
  );
}
