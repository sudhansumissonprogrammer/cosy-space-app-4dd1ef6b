import { useState, useEffect } from "react";
import { useOutletContext, Navigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStorefrontAuth } from "@/contexts/StorefrontAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Package, MapPin, Heart, LogOut, Plus, Trash2, Star, Loader2, User } from "lucide-react";
import { storefrontPath } from "@/lib/subdomain";
import type { StoreData } from "@/layouts/StorefrontLayout";

function OrdersTab({ customerId, store }: { customerId: string; store: StoreData }) {
  const { data: orders, isLoading } = useQuery({
    queryKey: ["storefront-customer-orders", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("storefront_customer_id", customerId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;

  if (!orders?.length) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <Package className="mx-auto mb-3 h-10 w-10" />
        <p>No orders yet</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to={storefrontPath(store.slug)}>Start Shopping</Link>
        </Button>
      </div>
    );
  }

  const statusColor: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    confirmed: "bg-blue-100 text-blue-800",
    shipped: "bg-purple-100 text-purple-800",
    delivered: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
    partially_paid: "bg-purple-100 text-purple-800",
  };

  const STATUSES = ["confirmed", "shipped", "delivered"];

  return (
    <div className="space-y-4">
      {orders.map((order: any) => {
        const currentIdx = STATUSES.indexOf(order.status);
        const isCancelled = order.status === "cancelled";
        return (
          <Card key={order.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">
                  {new Date(order.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </span>
                <Badge className={statusColor[order.status] || ""}>{order.status}</Badge>
              </div>

              {/* Status Timeline */}
              {!isCancelled && (
                <div className="flex items-center gap-1 my-3">
                  {STATUSES.map((s, i) => (
                    <div key={s} className="flex items-center flex-1">
                      <div className={`h-2 w-2 rounded-full flex-shrink-0 ${i <= currentIdx ? "bg-primary" : "bg-muted"}`} />
                      {i < STATUSES.length - 1 && (
                        <div className={`h-0.5 flex-1 ${i < currentIdx ? "bg-primary" : "bg-muted"}`} />
                      )}
                    </div>
                  ))}
                </div>
              )}
              {!isCancelled && (
                <div className="flex justify-between mb-2">
                  {STATUSES.map((s, i) => (
                    <span key={s} className={`text-[10px] capitalize ${i <= currentIdx ? "text-primary font-medium" : "text-muted-foreground"}`}>{s}</span>
                  ))}
                </div>
              )}

              {/* Tracking info */}
              {order.tracking_number && (
                <div className="mb-2 flex items-center gap-2 rounded-lg bg-accent/50 p-2 text-xs">
                  <Package className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Tracking:</span>
                  {order.tracking_url ? (
                    <a href={order.tracking_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">{order.tracking_number}</a>
                  ) : (
                    <span className="font-mono">{order.tracking_number}</span>
                  )}
                </div>
              )}

              <div className="space-y-1">
                {order.order_items?.map((item: any) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span>{item.product_name} × {item.quantity}</span>
                    <span className="font-medium">{store.currency} {item.total}</span>
                  </div>
                ))}
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between font-semibold text-sm">
                <span>Total</span>
                <span>{store.currency} {order.total}</span>
              </div>
              {order.payment_type === "partial" && Number(order.advance_paid) > 0 && (
                <div className="mt-2 rounded-lg border border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-950/30 p-2.5 space-y-1">
                  <p className="text-xs font-semibold text-purple-700 dark:text-purple-400">💰 Partial Payment</p>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Advance Paid</span>
                    <span className="font-semibold text-emerald-600">{store.currency} {Number(order.advance_paid).toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Balance on Delivery</span>
                    <span className="font-semibold text-foreground">{store.currency} {Number(order.balance_due).toFixed(0)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
function AddressesTab({ customerId }: { customerId: string }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ label: "Home", full_name: "", phone: "", street_address: "", city: "", state: "", pincode: "" });

  const { data: addresses, isLoading } = useQuery({
    queryKey: ["customer-addresses", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_addresses")
        .select("*")
        .eq("storefront_customer_id", customerId)
        .order("is_default", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("customer_addresses").insert({
        storefront_customer_id: customerId,
        ...form,
        is_default: !addresses?.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer-addresses", customerId] });
      setAdding(false);
      setForm({ label: "Home", full_name: "", phone: "", street_address: "", city: "", state: "", pincode: "" });
      toast.success("Address added");
    },
    onError: () => toast.error("Failed to add address"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customer_addresses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer-addresses", customerId] });
      toast.success("Address removed");
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      // Unset all defaults first
      await supabase.from("customer_addresses").update({ is_default: false }).eq("storefront_customer_id", customerId);
      const { error } = await supabase.from("customer_addresses").update({ is_default: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer-addresses", customerId] });
      toast.success("Default address updated");
    },
  });

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  return (
    <div className="space-y-4">
      {addresses?.map((addr: any) => (
        <Card key={addr.id}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{addr.label}</span>
                  {addr.is_default && <Badge variant="secondary" className="text-xs"><Star className="h-3 w-3 mr-1" />Default</Badge>}
                </div>
                <p className="text-sm">{addr.full_name}</p>
                <p className="text-sm text-muted-foreground">{[addr.street_address, addr.city, addr.state, addr.pincode].filter(Boolean).join(", ")}</p>
                {addr.phone && <p className="text-sm text-muted-foreground">{addr.phone}</p>}
              </div>
              <div className="flex gap-1">
                {!addr.is_default && (
                  <Button variant="ghost" size="sm" onClick={() => setDefaultMutation.mutate(addr.id)}>Set Default</Button>
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(addr.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {adding ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Label</Label>
                <Input value={form.label} onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))} placeholder="Home / Work" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Full Name</Label>
                <Input value={form.full_name} onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Street Address</Label>
              <Input value={form.street_address} onChange={(e) => setForm((p) => ({ ...p, street_address: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">City</Label>
                <Input value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">State</Label>
                <Input value={form.state} onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Pincode</Label>
                <Input value={form.pincode} onChange={(e) => setForm((p) => ({ ...p, pincode: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
                {addMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Address
              </Button>
              <Button variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button variant="outline" onClick={() => setAdding(true)} className="w-full">
          <Plus className="mr-2 h-4 w-4" /> Add Address
        </Button>
      )}
    </div>
  );
}

function WishlistTab({ customerId, store }: { customerId: string; store: StoreData }) {
  const qc = useQueryClient();

  const { data: wishlistItems, isLoading } = useQuery({
    queryKey: ["customer-wishlist-db", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_wishlists")
        .select("*, products(*)")
        .eq("storefront_customer_id", customerId);
      if (error) throw error;
      return data;
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customer_wishlists").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer-wishlist-db", customerId] });
    },
  });

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  if (!wishlistItems?.length) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <Heart className="mx-auto mb-3 h-16 w-16 opacity-20" />
        <p className="text-base font-medium text-foreground">Your wishlist is empty</p>
        <p className="text-sm mt-1">Save products you love to find them later</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {wishlistItems.map((item: any) => {
        const product = item.products;
        if (!product) return null;
        return (
          <Card key={item.id}>
            <CardContent className="flex gap-3 p-3">
              {product.image_url && (
                <Link to={storefrontPath(store.slug, `product/${product.slug}`)}>
                  <img src={product.image_url} alt={product.name} className="h-16 w-16 rounded-lg object-cover" />
                </Link>
              )}
              <div className="flex-1 min-w-0">
                <Link to={storefrontPath(store.slug, `product/${product.slug}`)} className="text-sm font-medium line-clamp-1 hover:underline">
                  {product.name}
                </Link>
                <p className="text-sm font-semibold text-primary">
                  {store.currency} {product.sale_price || product.price}
                </p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => removeMutation.mutate(item.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default function StorefrontAccount() {
  const store = useOutletContext<StoreData>();
  const { customer, loading, signOut, user, ensureCustomer } = useStorefrontAuth();

  // Lazily fetch/create customer record on this page
  useEffect(() => {
    if (user && !customer) ensureCustomer();
  }, [user, customer, ensureCustomer]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!user) return <Navigate to={storefrontPath(store.slug, "login")} replace />;

  if (!customer) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <User className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold truncate">{customer.name || user.email}</h1>
            <p className="text-sm text-muted-foreground truncate">{user.email}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={signOut} className="mt-3 w-full sm:w-auto">
          <LogOut className="mr-2 h-4 w-4" /> Sign Out
        </Button>
      </div>

      <Tabs defaultValue="orders">
        <TabsList className="w-full overflow-x-auto">
          <TabsTrigger value="orders" className="flex-1 min-w-[120px] py-2.5"><Package className="mr-2 h-4 w-4" />Orders</TabsTrigger>
          <TabsTrigger value="addresses" className="flex-1 min-w-[120px] py-2.5"><MapPin className="mr-2 h-4 w-4" />Addresses</TabsTrigger>
        </TabsList>
        <div className="mt-4">
          <TabsContent value="orders"><OrdersTab customerId={customer.id} store={store} /></TabsContent>
          <TabsContent value="addresses"><AddressesTab customerId={customer.id} /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
