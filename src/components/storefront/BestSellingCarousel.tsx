import { Link } from "react-router-dom";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from "@/components/ui/carousel";
import StorefrontProductCard from "./StorefrontProductCard";
import type { StoreData } from "@/layouts/StorefrontLayout";

interface BestSellingCarouselProps {
  products: any[];
  slug: string;
  store: StoreData;
}

export default function BestSellingCarousel({ products, slug, store }: BestSellingCarouselProps) {
  if (products.length === 0) return null;

  return (
    <section>
      <h2 className="mb-4 text-xl font-bold text-foreground">🔥 Best Selling</h2>
      <div className="relative px-0 md:px-12">
        <Carousel
          opts={{
            align: "start",
            loop: products.length > 4,
          }}
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
      </div>
    </section>
  );
}
