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
                <Button className="w-full" size="lg" onClick={handleWhatsAppOrder} disabled={!store.whatsapp_number}>
                  <MessageCircle className="mr-2 h-5 w-5" />
                  Order on WhatsApp
                </Button>
              ) : (
                <Button className="w-full" size="lg" onClick={() => navigate(`/store/${store.slug}/checkout`)}>
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
