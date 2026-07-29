import { Minus, Plus, X, Package } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from "@/components/ui/carousel";
import { formatPrice } from "@/lib/productUtils";
import type { CartItem } from "@/contexts/CartContext";

interface Props {
  items: CartItem[];
  currency: string;
  updateQuantity: (productId: string, variantId: string | undefined, qty: number) => void;
  removeFromCart: (productId: string, variantId?: string) => void;
}

/**
 * Cart line items rendered as a horizontal carousel (GoKwik-style) instead of a
 * tall vertical list — keeps the drawer short so the upsell strips stay visible.
 */
export default function CartItemsCarousel({ items, currency, updateQuantity, removeFromCart }: Props) {
  const multi = items.length > 1;
  return (
    <div className="relative">
      <Carousel opts={{ align: "start", dragFree: true, containScroll: "trimSnaps" }} className="w-full">
        <CarouselContent className="-ml-2">
          {items.map((item) => (
            <CarouselItem
              key={`${item.productId}-${item.variantId || ""}`}
              className={`pl-2 ${multi ? "basis-[72%] sm:basis-[58%]" : "basis-full"}`}
            >
              <div
                className="flex h-full gap-2.5 rounded-xl p-2"
                style={{
                  border: "1px solid color-mix(in srgb, var(--storefront-text, inherit) 10%, transparent)",
                  backgroundColor: "color-mix(in srgb, var(--storefront-text, inherit) 3%, var(--storefront-bg, #fff))",
                }}
              >
                <div className="relative h-[88px] w-[88px] shrink-0">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.name}
                      loading="eager"
                      decoding="async"
                      className="h-[88px] w-[88px] rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-[88px] w-[88px] items-center justify-center rounded-lg bg-muted">
                      <Package className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <button
                    onClick={() => removeFromCart(item.productId, item.variantId)}
                    aria-label="Remove item"
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/75 text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <p
                    className="line-clamp-2 text-[12px] font-semibold leading-tight"
                    style={{ color: "var(--storefront-text, inherit)" }}
                  >
                    {item.name}
                  </p>
                  {item.variantName && (
                    <p className="text-[10px] opacity-60">{item.variantName}</p>
                  )}

                  <div className="mt-auto flex items-center justify-between gap-1 pt-1">
                    <span className="text-[11px] font-extrabold" style={{ color: "var(--storefront-text, inherit)" }}>
                      {formatPrice(item.price * item.quantity, currency)}
                    </span>
                    <div
                      className="flex items-center rounded-md"
                      style={{ border: "1px solid color-mix(in srgb, var(--storefront-text, inherit) 14%, transparent)" }}
                    >
                      <button
                        aria-label="Decrease quantity"
                        onClick={() => updateQuantity(item.productId, item.variantId, item.quantity - 1)}
                        className="flex h-6 w-6 items-center justify-center active:scale-95"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span key={item.quantity} className="qty-bounce w-4 text-center text-[11px] font-bold">
                        {item.quantity}
                      </span>
                      <button
                        aria-label="Increase quantity"
                        onClick={() => updateQuantity(item.productId, item.variantId, item.quantity + 1)}
                        className="flex h-6 w-6 items-center justify-center active:scale-95"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        {multi && (
          <>
            <CarouselPrevious className="left-0 h-7 w-7 -translate-x-1 opacity-90" />
            <CarouselNext className="right-0 h-7 w-7 translate-x-1 opacity-90" />
          </>
        )}
      </Carousel>
    </div>
  );
}
