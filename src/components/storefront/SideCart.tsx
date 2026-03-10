import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/contexts/CartContext";
import { Minus, Plus, Trash2, ShoppingCart, ShoppingBag, MessageCircle, Package, X } from "lucide-react";
import type { StoreData } from "@/layouts/StorefrontLayout";
import { storefrontPath } from "@/lib/subdomain";

interface SideCartProps {
  store: StoreData;
}

export default function SideCart({ store }: SideCartProps) {
  const { items, updateQuantity, removeFromCart, clearCart, cartTotal, cartCount, isCartOpen, closeCart } = useCart();
  const currency = store.currency || "USD";
  const isWhatsApp = (store as any).order_mode === "whatsapp";

  const handleWhatsAppOrder = () => {
    if (!store.whatsapp_number) return;
    const phone = store.whatsapp_number.replace(/[^0-9+]/g, "");
    const itemLines = items
      .map((i, idx) => `${idx + 1}. ${i.name}${i.variantName ? ` (${i.variantName})` : ""} x${i.quantity} — ${currency} ${(i.price * i.quantity).toFixed(2)}`)
      .join("\n");
    const text = `Hello, I want to order from ${store.name}:\n\n${itemLines}\n\nTotal: ${currency} ${cartTotal.toFixed(2)}`;
    window.open(`https://wa.me/${encodeURIComponent(phone)}?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <Sheet open={isCartOpen} onOpenChange={(open) => !open && closeCart()}>
      <SheetContent side="right" className="flex w-[85vw] max-w-md flex-col p-0 sm:w-[400px]">
        {/* Header */}
        <SheetHeader className="border-b px-4 py-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 text-lg font-bold">
              <ShoppingCart className="h-5 w-5" />
              Cart ({cartCount})
            </SheetTitle>
          </div>
        </SheetHeader>

        {/* Items */}
        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4">
            <ShoppingCart className="h-16 w-16 text-muted-foreground/30" />
            <p className="text-lg font-semibold text-foreground">Your cart is empty</p>
            <p className="text-sm text-muted-foreground">Add products to get started</p>
            <Button variant="outline" onClick={closeCart} className="mt-2">
              Continue Shopping
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-3">
              <div className="space-y-3">
                {items.map((item) => (
                  <div
                    key={`${item.productId}-${item.variantId || ""}`}
                    className="flex gap-3 rounded-xl border border-border bg-card p-3"
                  >
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="h-20 w-20 shrink-0 rounded-lg border object-cover"
                      />
                    ) : (
                      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-accent">
                        <Package className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex flex-1 flex-col min-w-0">
                      <p className="text-sm font-semibold text-foreground line-clamp-2">{item.name}</p>
                      {item.variantName && (
                        <p className="text-xs text-muted-foreground">{item.variantName}</p>
                      )}
                      <p className="mt-0.5 text-sm font-bold text-foreground">
                        {currency} {(item.price * item.quantity).toFixed(2)}
                      </p>
                      <div className="mt-auto flex items-center gap-2 pt-1.5">
                        <div className="flex items-center rounded-lg border border-border">
                          <button
                            onClick={() => updateQuantity(item.productId, item.variantId, item.quantity - 1)}
                            className="flex h-7 w-7 items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-7 text-center text-xs font-semibold">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.productId, item.variantId, item.quantity + 1)}
                            className="flex h-7 w-7 items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <button
                          onClick={() => removeFromCart(item.productId, item.variantId)}
                          className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {items.length > 0 && (
                <button
                  onClick={clearCart}
                  className="mt-3 text-xs font-medium text-destructive hover:underline"
                >
                  Clear Cart
                </button>
              )}
            </div>

            {/* Footer / Checkout */}
            <div className="border-t bg-card px-4 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Subtotal</span>
                <span className="text-lg font-bold text-foreground">
                  {currency} {cartTotal.toFixed(2)}
                </span>
              </div>
              <Separator />
              {isWhatsApp ? (
                <Button
                  className="h-12 w-full rounded-xl text-sm font-bold"
                  onClick={handleWhatsAppOrder}
                  disabled={!store.whatsapp_number}
                >
                  <MessageCircle className="mr-2 h-5 w-5" />
                  Order on WhatsApp
                </Button>
              ) : (
                <Button
                  className="h-12 w-full rounded-xl text-sm font-bold"
                  asChild
                  onClick={closeCart}
                >
                  <Link to={storefrontPath(store.slug, "checkout")}>
                    <ShoppingBag className="mr-2 h-5 w-5" />
                    Proceed to Checkout
                  </Link>
                </Button>
              )}
              <Button
                variant="ghost"
                className="w-full text-sm"
                onClick={closeCart}
              >
                Continue Shopping
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
