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
      <SheetContent side="right" className="storefront-font flex w-[85vw] max-w-md flex-col p-0 sm:w-[400px]">
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
                <button
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] text-sm font-bold text-white transition-all hover:bg-[#1ebe5d] active:scale-[0.98] disabled:opacity-50"
                  onClick={handleWhatsAppOrder}
                  disabled={!store.whatsapp_number}
                >
                  <svg viewBox="0 0 32 32" fill="white" className="h-5 w-5"><path d="M16.004 3.2C9.056 3.2 3.406 8.848 3.404 15.8c-.001 2.222.58 4.392 1.683 6.303L3.2 28.8l6.867-1.802A12.56 12.56 0 0 0 16 28.398h.005C22.95 28.398 28.6 22.75 28.6 15.8 28.6 8.85 22.95 3.2 16.004 3.2Zm0 22.997h-.004a10.44 10.44 0 0 1-5.318-1.457l-.382-.226-3.955 1.038 1.055-3.858-.249-.395A10.42 10.42 0 0 1 5.54 15.8c.002-5.77 4.697-10.463 10.466-10.463 5.77 0 10.463 4.695 10.463 10.464 0 5.77-4.695 10.465-10.465 10.465v-.069Zm5.74-7.835c-.315-.158-1.863-.92-2.152-1.025-.289-.105-.499-.158-.71.158-.21.315-.815 1.025-.999 1.236-.184.21-.368.236-.683.079-.315-.158-1.33-.49-2.533-1.562-.937-.835-1.568-1.867-1.752-2.182-.184-.315-.02-.486.138-.643.142-.141.315-.368.473-.552.158-.184.21-.315.315-.526.106-.21.053-.394-.026-.552-.079-.158-.71-1.71-.973-2.341-.256-.615-.517-.532-.71-.542-.184-.008-.394-.01-.604-.01s-.552.079-.841.394c-.29.315-1.104 1.078-1.104 2.63 0 1.552 1.13 3.052 1.288 3.262.158.21 2.224 3.396 5.388 4.762.753.326 1.341.52 1.8.665.756.24 1.444.206 1.988.125.607-.09 1.863-.762 2.126-1.498.263-.736.263-1.367.184-1.498-.079-.132-.289-.21-.604-.369Z"/></svg>
                  Order on WhatsApp
                </button>
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
