import { Link, useOutletContext, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/contexts/CartContext";
import { ArrowLeft, Minus, Plus, ShoppingCart, Trash2, MessageCircle, Package, ShoppingBag } from "lucide-react";
import type { StoreData } from "@/layouts/StorefrontLayout";
import { storefrontPath } from "@/lib/subdomain";

export default function CartPage() {
  const store = useOutletContext<StoreData>();
  const navigate = useNavigate();
  const { items, updateQuantity, removeFromCart, clearCart, cartTotal, cartCount } = useCart();
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

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <ShoppingCart className="mx-auto mb-4 h-16 w-16 text-muted-foreground/40" />
        <h1 className="text-2xl font-bold text-foreground">Your cart is empty</h1>
        <p className="mt-2 text-muted-foreground">Add some products to get started.</p>
        <Button asChild className="mt-6">
          <Link to={storefrontPath(store.slug)}>Continue Shopping</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <Link
          to={storefrontPath(store.slug)}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          Continue Shopping
        </Link>
      </div>

      <h1 className="mb-6 text-2xl font-bold text-foreground">Cart ({cartCount} items)</h1>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Items */}
        <div className="space-y-3 lg:col-span-3">
          {items.map((item) => (
            <Card key={`${item.productId}-${item.variantId || ""}`}>
              <CardContent className="flex gap-3 p-4">
                {item.image ? (
                  <img src={item.image} alt={item.name} className="h-20 w-20 rounded-lg border object-cover flex-shrink-0" />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-accent flex-shrink-0">
                    <Package className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex flex-1 flex-col min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{item.name}</p>
                  {item.variantName && <p className="text-xs text-muted-foreground">{item.variantName}</p>}
                  <p className="mt-1 text-sm font-bold text-foreground">{currency} {item.price.toFixed(2)}</p>
                  <div className="mt-auto flex items-center gap-2 pt-2">
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.productId, item.variantId, item.quantity - 1)}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.productId, item.variantId, item.quantity + 1)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="ml-auto h-7 w-7 text-destructive hover:text-destructive" onClick={() => removeFromCart(item.productId, item.variantId)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={clearCart}>
            Clear Cart
          </Button>
        </div>

        {/* Summary */}
        <div className="lg:col-span-2">
          <Card className="sticky top-20">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((item) => (
                <div key={`${item.productId}-${item.variantId || ""}`} className="flex justify-between text-sm">
                  <span className="text-muted-foreground truncate max-w-[60%]">
                    {item.name} x{item.quantity}
                  </span>
                  <span className="font-medium">{currency} {(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
              <Separator />
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">Total</span>
                <span className="text-lg font-bold text-foreground">{currency} {cartTotal.toFixed(2)}</span>
              </div>

              {isWhatsApp ? (
                <button
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#25D366] text-sm font-bold text-white transition-all hover:bg-[#1ebe5d] active:scale-[0.98] disabled:opacity-50"
                  onClick={handleWhatsAppOrder}
                  disabled={!store.whatsapp_number}
                >
                  <svg viewBox="0 0 32 32" fill="white" className="h-5 w-5"><path d="M16.004 3.2C9.056 3.2 3.406 8.848 3.404 15.8c-.001 2.222.58 4.392 1.683 6.303L3.2 28.8l6.867-1.802A12.56 12.56 0 0 0 16 28.398h.005C22.95 28.398 28.6 22.75 28.6 15.8 28.6 8.85 22.95 3.2 16.004 3.2Zm0 22.997h-.004a10.44 10.44 0 0 1-5.318-1.457l-.382-.226-3.955 1.038 1.055-3.858-.249-.395A10.42 10.42 0 0 1 5.54 15.8c.002-5.77 4.697-10.463 10.466-10.463 5.77 0 10.463 4.695 10.463 10.464 0 5.77-4.695 10.465-10.465 10.465v-.069Zm5.74-7.835c-.315-.158-1.863-.92-2.152-1.025-.289-.105-.499-.158-.71.158-.21.315-.815 1.025-.999 1.236-.184.21-.368.236-.683.079-.315-.158-1.33-.49-2.533-1.562-.937-.835-1.568-1.867-1.752-2.182-.184-.315-.02-.486.138-.643.142-.141.315-.368.473-.552.158-.184.21-.315.315-.526.106-.21.053-.394-.026-.552-.079-.158-.71-1.71-.973-2.341-.256-.615-.517-.532-.71-.542-.184-.008-.394-.01-.604-.01s-.552.079-.841.394c-.29.315-1.104 1.078-1.104 2.63 0 1.552 1.13 3.052 1.288 3.262.158.21 2.224 3.396 5.388 4.762.753.326 1.341.52 1.8.665.756.24 1.444.206 1.988.125.607-.09 1.863-.762 2.126-1.498.263-.736.263-1.367.184-1.498-.079-.132-.289-.21-.604-.369Z"/></svg>
                  Order on WhatsApp
                </button>
              ) : (
                <Button className="w-full" size="lg" onClick={() => navigate(storefrontPath(store.slug, "checkout"))}>
                  <ShoppingBag className="mr-2 h-5 w-5" />
                  Proceed to Checkout
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
