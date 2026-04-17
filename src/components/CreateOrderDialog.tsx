import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Search, Plus, Minus, Trash2, Package, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface CreateOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  storeCurrency?: string;
}

type CartLine = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string | null;
  stock?: number;
};

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
];

export default function CreateOrderDialog({ open, onOpenChange, storeId, storeCurrency = "INR" }: CreateOrderDialogProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setStateField] = useState("");
  const [pincode, setPincode] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "razorpay">("cod");
  const [status, setStatus] = useState<string>("confirmed");
  const [submitting, setSubmitting] = useState(false);

  const symbol = storeCurrency === "INR" ? "₹" : storeCurrency === "USD" ? "$" : storeCurrency;

  // Search products in this store
  const { data: products = [], isFetching } = useQuery({
    queryKey: ["create-order-products", storeId, search],
    enabled: open && !!storeId,
    staleTime: 60_000,
    queryFn: async () => {
      let q = supabase
        .from("products")
        .select("id, name, price, sale_price, image_url, stock_quantity")
        .eq("store_id", storeId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(30);
      if (search.trim()) q = q.ilike("name", `%${search.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const subtotal = useMemo(
    () => cart.reduce((sum, l) => sum + l.price * l.quantity, 0),
    [cart]
  );

  const addToCart = (p: any) => {
    const price = Number(p.sale_price ?? p.price);
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.productId === p.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [
        ...prev,
        { productId: p.id, name: p.name, price, quantity: 1, imageUrl: p.image_url, stock: p.stock_quantity },
      ];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) => (l.productId === productId ? { ...l, quantity: Math.max(0, l.quantity + delta) } : l))
        .filter((l) => l.quantity > 0)
    );
  };

  const removeLine = (productId: string) => {
    setCart((prev) => prev.filter((l) => l.productId !== productId));
  };

  const resetForm = () => {
    setSearch("");
    setCart([]);
    setCustomerName("");
    setCustomerPhone("");
    setStreetAddress("");
    setCity("");
    setStateField("");
    setPincode("");
    setNotes("");
    setPaymentMethod("cod");
    setStatus("confirmed");
  };

  const handleSubmit = async () => {
    if (cart.length === 0) {
      toast.error("Please add at least one product");
      return;
    }
    if (!customerName.trim() || !customerPhone.trim()) {
      toast.error("Customer name and phone are required");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("place-order", {
        body: {
          store_id: storeId,
          order: {
            total: subtotal,
            currency: storeCurrency,
            status,
            customer_name: customerName.trim(),
            customer_phone: customerPhone.trim(),
            street_address: streetAddress.trim(),
            city: city.trim(),
            state: state.trim(),
            pincode: pincode.trim(),
            payment_method: paymentMethod,
            notes: notes.trim() || undefined,
            payment_type: "full",
          },
          items: cart.map((l) => ({
            productId: l.productId,
            name: l.name,
            price: l.price,
            quantity: l.quantity,
          })),
          checkout_token: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Order ${data?.order_number || "created"} ✅`);
      queryClient.invalidateQueries({ queryKey: ["website-orders-all", storeId] });
      queryClient.invalidateQueries({ queryKey: ["website-orders-count", storeId] });
      resetForm();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to create order");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b sticky top-0 bg-background z-10">
          <DialogTitle className="text-lg">Create Order</DialogTitle>
          <DialogDescription className="text-xs">
            Manually place an order on behalf of a customer (e.g., for phone or in-store sales).
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-5 p-5">
          {/* LEFT — Product selection */}
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Products</Label>
              <div className="relative mt-1.5">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9 text-sm"
                />
              </div>
            </div>

            <div className="border rounded-md max-h-[260px] overflow-y-auto">
              {isFetching ? (
                <div className="p-6 text-center text-xs text-muted-foreground">Loading…</div>
              ) : products.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">No products found</div>
              ) : (
                <div className="divide-y">
                  {products.map((p: any) => {
                    const inCart = cart.some((l) => l.productId === p.id);
                    const price = Number(p.sale_price ?? p.price);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => addToCart(p)}
                        className={cn(
                          "w-full flex items-center gap-2.5 p-2 text-left hover:bg-muted/50 transition",
                          inCart && "bg-primary/5"
                        )}
                      >
                        <div className="h-10 w-10 rounded bg-muted overflow-hidden shrink-0 flex items-center justify-center">
                          {p.image_url ? (
                            <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
                          ) : (
                            <Package className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {symbol}{price.toFixed(0)} • Stock: {p.stock_quantity ?? "∞"}
                          </p>
                        </div>
                        <Plus className="h-4 w-4 text-primary shrink-0" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Cart */}
            <div>
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Cart ({cart.length})
              </Label>
              {cart.length === 0 ? (
                <div className="border rounded-md p-6 text-center text-xs text-muted-foreground mt-1.5">
                  No products selected yet
                </div>
              ) : (
                <div className="border rounded-md mt-1.5 divide-y">
                  {cart.map((l) => (
                    <div key={l.productId} className="flex items-center gap-2 p-2">
                      <div className="h-9 w-9 rounded bg-muted overflow-hidden shrink-0 flex items-center justify-center">
                        {l.imageUrl ? (
                          <img src={l.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                          <Package className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{l.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {symbol}{l.price.toFixed(0)} × {l.quantity} = {symbol}{(l.price * l.quantity).toFixed(0)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button type="button" size="icon" variant="outline" className="h-6 w-6" onClick={() => updateQty(l.productId, -1)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-6 text-center text-xs font-medium">{l.quantity}</span>
                        <Button type="button" size="icon" variant="outline" className="h-6 w-6" onClick={() => updateQty(l.productId, +1)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button type="button" size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => removeLine(l.productId)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <div className="p-2 flex justify-between items-center bg-muted/30">
                    <span className="text-sm font-semibold text-foreground">Total</span>
                    <span className="text-base font-bold text-primary">{symbol}{subtotal.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT — Customer + payment */}
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Customer</Label>
              <div className="space-y-2 mt-1.5">
                <Input
                  placeholder="Full name *"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="h-9 text-sm"
                />
                <Input
                  placeholder="Phone number *"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="h-9 text-sm"
                  type="tel"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Shipping address</Label>
              <div className="space-y-2 mt-1.5">
                <Input
                  placeholder="Street address"
                  value={streetAddress}
                  onChange={(e) => setStreetAddress(e.target.value)}
                  className="h-9 text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} className="h-9 text-sm" />
                  <Input placeholder="State" value={state} onChange={(e) => setStateField(e.target.value)} className="h-9 text-sm" />
                </div>
                <Input placeholder="Pincode" value={pincode} onChange={(e) => setPincode(e.target.value)} className="h-9 text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Payment</Label>
                <Select value={paymentMethod} onValueChange={(v: "cod" | "razorpay") => setPaymentMethod(v)}>
                  <SelectTrigger className="h-9 text-sm mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cod">Cash on Delivery</SelectItem>
                    <SelectItem value="razorpay">Paid (Online)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="h-9 text-sm mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Notes (optional)</Label>
              <Textarea
                placeholder="Internal notes about this order…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="text-sm mt-1.5 min-h-[60px]"
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                {cart.length} item{cart.length !== 1 ? "s" : ""} • Total
              </div>
              <div className="text-xl font-bold text-foreground">{symbol}{subtotal.toFixed(2)}</div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-10"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                <X className="h-4 w-4 mr-1.5" /> Cancel
              </Button>
              <Button
                type="button"
                className="flex-1 h-10"
                onClick={handleSubmit}
                disabled={submitting || cart.length === 0}
              >
                {submitting ? "Creating…" : "Create Order"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
