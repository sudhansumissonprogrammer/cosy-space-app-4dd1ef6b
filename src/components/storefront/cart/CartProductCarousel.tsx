import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Check, Star } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
} from "@/components/ui/carousel";
import { storefrontPath } from "@/lib/subdomain";
import { resolveProductImages } from "@/lib/imageOptimize";
import { formatPrice } from "@/lib/productUtils";
import { useCart } from "@/contexts/CartContext";

interface Props {
  title: string;
  items: any[];
  slug: string;
  currency: string;
  /** Red price/title treatment — used for the FLAT-OFF steal-deals strip. */
  highlight?: boolean;
  /** Flat rupee amount knocked off inside the cart only (e.g. 100). */
  flatOff?: number;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  fetchNextPage?: () => void;
}

/**
 * Compact product carousel for the side cart.
 * Differences vs the PDP carousel: rating badge sits ON the image, the price
 * sits inline next to the title, and the whole card is ~40% shorter so two
 * full strips plus a peek of a third fit inside the drawer.
 */
export default function CartProductCarousel({
  title,
  items,
  slug,
  currency,
  highlight = false,
  flatOff = 0,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: Props) {
  const [api, setApi] = useState<CarouselApi>();
  const { addToCart, items: cartItems } = useCart();

  useEffect(() => {
    if (!api || !fetchNextPage) return;
    const onSelect = () => {
      const snaps = api.scrollSnapList().length;
      if (snaps === 0) return;
      if (api.selectedScrollSnap() >= snaps - 2 && hasNextPage && !isFetchingNextPage) fetchNextPage();
    };
    api.on("select", onSelect);
    api.on("reInit", onSelect);
    return () => {
      api.off("select", onSelect);
      api.off("reInit", onSelect);
    };
  }, [api, hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && items.length > 0 && items.length < 6) fetchNextPage?.();
  }, [items.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Products already added stay in the strip but slide to the end, so the
  // next unseen recommendation is always the one in view.
  const ordered = useMemo(() => {
    const inCartIds = new Set(cartItems.map((i) => i.productId));
    const fresh = items.filter((p: any) => !inCartIds.has(p.id));
    const added = items.filter((p: any) => inCartIds.has(p.id));
    return [...fresh, ...added];
  }, [items, cartItems]);

  if (items.length === 0) return null;

  return (
    <section className="mt-2.5">
      <h3
        className="mb-1.5 text-[12.5px] font-bold"
        style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}
      >
        {title}
      </h3>
      <div className="relative">
        <Carousel
          setApi={setApi}
          opts={{ align: "start", dragFree: true, containScroll: "trimSnaps" }}
          className="w-full"
        >
          <CarouselContent className="-ml-2">
            {ordered.map((p: any) => {
              const img = resolveProductImages(p)[0];
              const mrp = Number(p.price) || 0;
              const sale = p.sale_price && Number(p.sale_price) < mrp ? Number(p.sale_price) : mrp;
              // Show exactly what the shopper will be charged. `place-order`
              // always overrides line prices with the DB canonical price
              // (only server-set bundle/upsell rows keep a custom price), so
              // advertising a lower "cart-only" price here would be a
              // price-shown ≠ price-charged mismatch. Genuine savings are
              // still shown via the MRP strike-through below.
              const cartPrice = sale;
              const inCart = cartItems.some((i) => i.productId === p.id && !i.variantId);
              const rating = Number(p.rating || 0);
              const reviews = Number(p.review_count || 0);
              return (
                <CarouselItem key={p.id} className="pl-2 basis-[42%] sm:basis-[33%]">
                  <div
                    className="h-full overflow-hidden rounded-lg"
                    style={{
                      border: "1px solid color-mix(in srgb, var(--storefront-text, inherit) 10%, transparent)",
                      backgroundColor: "var(--storefront-bg, #fff)",
                    }}
                  >
                    <Link to={storefrontPath(slug, `product/${p.slug || p.id}`)} className="block">
                      <div className="relative aspect-square w-full overflow-hidden">
                        {img ? (
                          <img
                            src={img}
                            alt={p.name}
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full bg-muted" />
                        )}
                        {rating > 0 && (
                          <span className="absolute left-1 top-1 flex items-center gap-0.5 rounded bg-black/70 px-1 py-[1px] text-[9px] font-bold text-white">
                            <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                            {rating.toFixed(1)}
                            {reviews > 0 && <span className="opacity-70">({reviews})</span>}
                          </span>
                        )}
                      </div>
                    </Link>
                    <div className="px-1.5 py-1.5">
                      <div className="flex items-start justify-between gap-1">
                        <Link
                          to={storefrontPath(slug, `product/${p.slug || p.id}`)}
                          className={`line-clamp-2 flex-1 text-[10.5px] font-semibold leading-tight ${
                            highlight ? "text-red-600" : ""
                          }`}
                          style={highlight ? undefined : { color: "var(--storefront-text, inherit)" }}
                        >
                          {p.name}
                        </Link>
                        <span className="flex shrink-0 flex-col items-end leading-tight">
                          <span
                            className={`text-[11.5px] font-extrabold ${highlight ? "text-red-600" : ""}`}
                            style={highlight ? undefined : { color: "var(--storefront-text, inherit)" }}
                          >
                            {formatPrice(cartPrice, currency)}
                          </span>
                          {cartPrice < sale && (
                            <span className="text-[9px] font-medium line-through opacity-55">
                              {formatPrice(sale, currency)}
                            </span>
                          )}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          addToCart({
                            productId: p.id,
                            name: p.name,
                            price: sale,
                            image: img,
                            quantity: 1,
                          }, { silent: true })
                        }
                        className="mt-1 flex h-7 w-full items-center justify-center gap-1 rounded-md text-[10.5px] font-bold transition active:scale-[0.97]"
                        style={{
                          backgroundColor: inCart
                            ? "color-mix(in srgb, var(--storefront-primary, hsl(var(--primary))) 12%, transparent)"
                            : "var(--storefront-primary, hsl(var(--primary)))",
                          color: inCart
                            ? "var(--storefront-primary, hsl(var(--primary)))"
                            : "var(--storefront-btn-text, hsl(var(--primary-foreground)))",
                        }}
                      >
                        {inCart ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                        {inCart ? "Added" : "Add"}
                      </button>
                    </div>
                  </div>
                </CarouselItem>
              );
            })}
          </CarouselContent>
          <CarouselPrevious className="left-0 h-7 w-7 -translate-x-1 opacity-90" />
          <CarouselNext className="right-0 h-7 w-7 translate-x-1 opacity-90" />
        </Carousel>
      </div>
    </section>
  );
}
