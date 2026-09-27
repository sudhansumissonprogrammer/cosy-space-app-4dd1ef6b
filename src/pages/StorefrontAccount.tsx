import { useState, useEffect } from "react";
import { useOutletContext, Navigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
// Use the storefront-isolated client so the customer JWT (auth.uid()) is sent
// with every query — required for RLS policies on customer_addresses,
// customer_wishlists, orders, and storefront_customers. The dashboard
// `supabase` client uses a different storageKey and would send the merchant
// (or anon) token here, causing customers to see 0 rows on a clean browser.
import { supabaseStorefront as supabase } from "@/integrations/supabase/storefrontClient";
import { useStorefrontAuth } from "@/contexts/StorefrontAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Package, MapPin, Heart, LogOut, Plus, Trash2, Star, Loader2, User, MessageCircle, Phone, HelpCircle } from "lucide-react";
import { storefrontPath } from "@/lib/subdomain";
import type { StoreData } from "@/layouts/StorefrontLayout";
import { normalizePhone } from "@/lib/phoneUtils";
import OrderCard from "@/components/storefront/OrderCard";
import { currencySymbol } from "@/lib/productUtils";
import { waPhoneNumber } from "@/lib/phoneUtils";

function OrdersTab({ customerId, store }: { customerId: string; store: StoreData }) {
  const { data: orders, isLoading } = useQuery({
    queryKey: ["storefront-customer-orders", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        // Only the columns OrderCard renders. The full row is 47 columns and
        // order_items(*) pulled every item field — this list is ~90% smaller
        // and the detail page fetches the rest on demand.
        .select("id,order_number,status,created_at,total,order_items(id,product_name,image_url)")
        .eq("storefront_customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    // Status changes (merchant ships, cancels, marks delivered) must reach
    // the customer's order cards quickly. 30s freshness + refetch on focus
    // keeps the cards in sync with the dashboard and the order detail page
    // — preventing the "card says Pending, detail says Partially Paid" gap.
    staleTime: 30 * 1000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });



  const ownerPhone = store.whatsapp_number ? normalizePhone(store.whatsapp_number) : "";
  const waDigits = waPhoneNumber(store.whatsapp_number);
  const waLink = waDigits ? `https://wa.me/${waDigits}` : "";
  const telLink = ownerPhone ? `tel:${ownerPhone}` : "";

  const HelpCard = (
    ownerPhone ? (
      <Card className="border-dashed">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <HelpCircle className="h-5 w-5 mt-0.5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Help & Support</p>
              <p className="text-xs mt-0.5" style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 60%, transparent)" }}>
                Need help with an order? Contact the store directly.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <a href={waLink} target="_blank" rel="noopener noreferrer"
                   className="inline-flex items-center gap-1.5 rounded-md bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white">
                  <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                </a>
                <a href={telLink}
                   className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold"
                   style={{ borderColor: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 20%, transparent)" }}>
                  <Phone className="h-3.5 w-3.5" /> {ownerPhone}
                </a>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    ) : null
  );

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;

  if (!orders?.length) {
    return (
      <div className="space-y-4">
        <div className="py-12 text-center" style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 50%, transparent)" }}>
          <Package className="mx-auto mb-3 h-10 w-10" />
          <p>No orders yet</p>
          <Button asChild variant="outline" className="mt-4">
            <Link to={storefrontPath(store.slug)}>Start Shopping</Link>
          </Button>
        </div>
        {HelpCard}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {HelpCard}
      {orders.map((order: any) => (
        <OrderCard key={order.id} order={order} storeSlug={store.slug} currency={store.currency} />
      ))}
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
      const { error } = await (supabase as any).rpc("replace_customer_address", {
        _storefront_customer_id: customerId,
        _label: form.label || "Home",
        _full_name: form.full_name,
        _phone: normalizePhone(form.phone),
        _street_address: form.street_address,
        _city: form.city,
        _state: form.state,
        _pincode: form.pincode,
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
                <p className="text-sm" style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 50%, transparent)" }}>{[addr.street_address, addr.city, addr.state, addr.pincode].filter(Boolean).join(", ")}</p>
                {addr.phone && <p className="text-sm" style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 50%, transparent)" }}>{addr.phone}</p>}
              </div>
              <div className="flex gap-1">
                {!addr.is_default && (
                  <Button variant="ghost" size="sm" onClick={() => setDefaultMutation.mutate(addr.id)}>Set Default</Button>
                )}
                <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => deleteMutation.mutate(addr.id)}>
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
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
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
      <div className="py-12 text-center" style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 50%, transparent)" }}>
        <Heart className="mx-auto mb-3 h-16 w-16 opacity-20" />
        <p className="text-base font-medium" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>Your wishlist is empty</p>
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
                  {currencySymbol(store.currency)}{product.sale_price || product.price}
                </p>
              </div>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive shrink-0" onClick={() => removeMutation.mutate(item.id)}>
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

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 50%, transparent)" }} /></div>;
  if (!user) return <Navigate to={storefrontPath(store.slug, "login")} replace />;

  if (!customer) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 50%, transparent)" }} /></div>;
  }

  // Synthetic emails (e.g. "919999999999@phone.guest") are an internal
  // implementation detail of phone-login — never expose them in the UI.
  const isSyntheticEmail = (e?: string | null) =>
    !!e && /@(phone\.guest|whatsapp)$/i.test(e);
  const realEmail = isSyntheticEmail(user.email) ? null : user.email;
  const displayPrimary = customer.name || customer.phone || realEmail || "My Account";
  const displaySecondary = customer.phone || realEmail || "";

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <User className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold truncate">{displayPrimary}</h1>
            {displaySecondary && (
              <p className="text-sm truncate" style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 50%, transparent)" }}>
                {displaySecondary}
              </p>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={signOut} className="shrink-0">
          <LogOut className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Sign Out</span>
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
