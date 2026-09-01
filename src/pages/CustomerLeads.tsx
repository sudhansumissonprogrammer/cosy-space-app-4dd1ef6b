import { useEffect, useMemo, useState } from "react";
import PaginationControls from "@/components/PaginationControls";
import { useStoreSlugParam } from "@/hooks/useStoreSlugParam";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Users, Trash2, Phone, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useMyStore } from "@/hooks/useMyStore";
import { getStoreBaseUrl } from "@/lib/storeUrl";
import { normalizePhone } from "@/lib/phoneUtils";
import { waPhoneNumber } from "@/lib/phoneUtils";

type CustomerLead = {
  id: string;
  name: string | null;
  phone: string;
  product_name: string | null;
  product_id: string | null;
  source: string;
  created_at: string;
};

const FETCH_PAGE_SIZE = 1000;

function productFromCartItems(cartItems: unknown): { product_name: string | null; product_id: string | null } {
  const items = Array.isArray(cartItems) ? cartItems : [];
  const first = items[0] as any;
  return {
    product_name: first?.name ? String(first.name) + (items.length > 1 ? ` +${items.length - 1}` : "") : null,
    product_id: first?.productId ? String(first.productId) : null,
  };
}

async function fetchAllCustomerLeads(storeId: string): Promise<CustomerLead[]> {
  const rows: CustomerLead[] = [];

  for (let from = 0; ; from += FETCH_PAGE_SIZE) {
    const to = from + FETCH_PAGE_SIZE - 1;
    const { data, error } = await (supabase as any)
      .from("customer_leads")
      .select("id,name,phone,product_name,product_id,source,created_at")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to);

    if (error) throw error;

    const batch = (data ?? []) as CustomerLead[];
    rows.push(...batch);

    if (batch.length < FETCH_PAGE_SIZE) break;
  }

  return rows;
}

// Only these order statuses mean the customer FULLY paid → hide from Leads.
// `pending` (COD placed but not confirmed), `cancelled`, and `partially_paid`
// (advance paid, balance still due) MUST remain in Leads — the store owner
// still needs to chase the balance / re-confirm those customers.
const PURCHASED_STATUSES = new Set([
  "confirmed",
  "shipped",
  "delivered",
]);

async function fetchPurchasedOrderDatesByPhone(storeId: string): Promise<Map<string, number[]>> {
  const map = new Map<string, number[]>();

  for (let from = 0; ; from += FETCH_PAGE_SIZE) {
    const to = from + FETCH_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("orders")
      .select("customer_phone, status, created_at")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to);

    if (error) throw error;

    const batch = data ?? [];
    batch.forEach((o: any) => {
      if (!PURCHASED_STATUSES.has(o.status)) return;
      const norm = normalizePhone(o.customer_phone).replace(/\D/g, "");
      const key = norm.length >= 10 ? norm.slice(-10) : "";
      if (!key) return;
      const t = new Date(o.created_at).getTime();
      const arr = map.get(key);
      if (arr) arr.push(t); else map.set(key, [t]);
    });

    if (batch.length < FETCH_PAGE_SIZE) break;
  }

  // Sort ascending for efficient lookup.
  map.forEach((arr) => arr.sort((a, b) => a - b));
  return map;
}

async function fetchOpenAbandonedCartLeads(storeId: string): Promise<CustomerLead[]> {
  const rows: CustomerLead[] = [];

  for (let from = 0; ; from += FETCH_PAGE_SIZE) {
    const to = from + FETCH_PAGE_SIZE - 1;
    const { data, error } = await (supabase as any)
      .from("abandoned_carts")
      .select("id,customer_phone,cart_items,created_at")
      .eq("store_id", storeId)
      .eq("recovered", false)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;

    const batch = (data ?? []) as any[];
    batch.forEach((c) => {
      const phone = normalizePhone(c.customer_phone);
      if (!phone) return;
      const product = productFromCartItems(c.cart_items);
      rows.push({
        id: `cart:${c.id}`,
        name: null,
        phone,
        product_name: product.product_name,
        product_id: product.product_id,
        source: "abandoned_cart",
        created_at: c.created_at,
      });
    });

    if (batch.length < FETCH_PAGE_SIZE) break;
  }

  return rows;
}

export default function CustomerLeads() {
  const { storeId } = useStoreSlugParam();
  const queryClient = useQueryClient();
  const { data: myStore } = useMyStore();

  const { data: leads, isLoading: leadsLoading } = useQuery({
    queryKey: ["customer-leads", storeId],
    queryFn: () => fetchAllCustomerLeads(storeId!),
    enabled: !!storeId,
  });

  const { data: cartLeads, isLoading: cartsLoading } = useQuery({
    queryKey: ["leads-open-abandoned-carts", storeId],
    queryFn: () => fetchOpenAbandonedCartLeads(storeId!),
    enabled: !!storeId,
    staleTime: 60 * 1000,
  });

  const isLoading = leadsLoading || cartsLoading;

  // Build normalized lead-phone list — used to scope the orders lookup.
  const leadPhones = useMemo(() => {
    const set = new Set<string>();
    (leads ?? []).forEach((l) => {
      const norm = normalizePhone(l.phone).replace(/\D/g, "").slice(-10);
      if (norm.length === 10) set.add(norm);
    });
    return Array.from(set);
  }, [leads]);

  // Fetch order phones in pages. A single query is capped by the backend row limit,
  // which made high-volume stores look stuck at 1000/2000 leads.
  const { data: purchasedOrderDatesByPhone } = useQuery({
    queryKey: ["leads-ordered-phones", storeId],
    queryFn: () => fetchPurchasedOrderDatesByPhone(storeId!),
    enabled: !!storeId && (leadPhones.length > 0 || (cartLeads?.length ?? 0) > 0),
    staleTime: 60 * 1000,
  });


  // Fetch abandoned-cart product interest per phone so we can show it in the
  // Leads row even when the lead itself has no product_name / product_id.
  const { data: cartProductByPhone } = useQuery({
    queryKey: ["leads-cart-products", storeId],
    queryFn: async () => {
      const map = new Map<string, { product_name: string | null; product_id: string | null }>();
      for (let from = 0; ; from += FETCH_PAGE_SIZE) {
        const to = from + FETCH_PAGE_SIZE - 1;
        const { data, error } = await (supabase as any)
          .from("abandoned_carts")
          .select("customer_phone,cart_items,created_at")
          .eq("store_id", storeId!)
          .order("created_at", { ascending: false })
          .range(from, to);
        if (error) throw error;
        const batch = (data ?? []) as any[];
        batch.forEach((c) => {
          const key = normalizePhone(c.customer_phone).replace(/\D/g, "").slice(-10);
          if (key.length !== 10 || map.has(key)) return; // newest wins
          const product = productFromCartItems(c.cart_items);
          if (product.product_name || product.product_id) map.set(key, product);
        });
        if (batch.length < FETCH_PAGE_SIZE) break;
      }
      return map;
    },
    enabled: !!storeId,
    staleTime: 60 * 1000,
  });

  const combinedLeads = useMemo(() => {
    const rows = [...(leads ?? [])];
    (cartLeads ?? []).forEach((cartLead) => {
      const cartKey = normalizePhone(cartLead.phone).replace(/\D/g, "").slice(-10);
      const cartTime = new Date(cartLead.created_at).getTime();
      const hasNearLead = rows.some((lead) => {
        const leadKey = normalizePhone(lead.phone).replace(/\D/g, "").slice(-10);
        if (leadKey !== cartKey) return false;
        return Math.abs(new Date(lead.created_at).getTime() - cartTime) <= 5 * 60 * 1000;
      });
      if (!hasNearLead) rows.push(cartLead);
    });
    return rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [leads, cartLeads]);

  // Annotate each lead with `hasOrdered` + product-of-interest, then filter.
  const CONVERSION_WINDOW_MS = 30 * 60 * 1000;
  const enrichedLeads = useMemo(() => {
    return combinedLeads.map((l) => {
      const key = normalizePhone(l.phone).replace(/\D/g, "").slice(-10);
      const purchaseTimes = key.length === 10 ? purchasedOrderDatesByPhone?.get(key) : undefined;
      const leadTime = new Date(l.created_at).getTime();
      const nextPurchase = purchaseTimes?.find((t) => t >= leadTime);
      const hasOrdered = !!(nextPurchase && nextPurchase - leadTime <= CONVERSION_WINDOW_MS);
      const cartProduct = key.length === 10 ? cartProductByPhone?.get(key) : undefined;
      return {
        ...l,
        hasOrdered,
        product_name: l.product_name || cartProduct?.product_name || null,
        product_id: l.product_id || cartProduct?.product_id || null,
      };
    });
  }, [combinedLeads, purchasedOrderDatesByPhone, cartProductByPhone]);

  const visibleLeads = useMemo(
    () => enrichedLeads.filter((l) => !l.hasOrdered),
    [enrichedLeads]
  );

  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(visibleLeads.length / PAGE_SIZE));
  useEffect(() => { if (page > totalPages) setPage(1); }, [totalPages, page]);
  const pagedLeads = useMemo(
    () => visibleLeads.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [visibleLeads, page]
  );

  // Fetch slugs for products referenced by leads — to build deep product links
  const productIds = Array.from(
    new Set((leads ?? []).map((l) => l.product_id).filter(Boolean) as string[])
  );

  const { data: productSlugMap } = useQuery({
    queryKey: ["lead-product-slugs", storeId, productIds.sort().join(",")],
    queryFn: async () => {
      if (productIds.length === 0) return {} as Record<string, string>;
      const { data, error } = await supabase
        .from("products")
        .select("id, slug")
        .in("id", productIds);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data ?? []).forEach((p: any) => {
        if (p.slug) map[p.id] = p.slug;
      });
      return map;
    },
    enabled: !!storeId && productIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // Pull this store's actual recovery coupon (highest-discount active coupon).
  // If none exists, the recovery message omits the coupon line.
  const { data: recoveryCoupon } = useQuery({
    queryKey: ["lead-recovery-coupon", storeId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .rpc("get_store_recovery_coupon", { _store_id: storeId });
      if (error) throw error;
      return Array.isArray(data) && data.length > 0 ? data[0] : null;
    },
    enabled: !!storeId,
    staleTime: 5 * 60 * 1000,
  });

  const buildRecoveryMessage = (lead: {
    name: string | null;
    product_name: string | null;
    product_id: string | null;
    source: string;
  }) => {
    const storeName = myStore?.name || "our store";
    const storeBase = myStore?.slug
      ? getStoreBaseUrl(myStore.slug, myStore?.custom_domain)
      : "";
    const productSlug = lead.product_id ? productSlugMap?.[lead.product_id] : null;
    const couponCode: string | null = recoveryCoupon?.code ?? null;
    const couponQuery = couponCode ? `?coupon=${encodeURIComponent(couponCode)}` : "";
    const productUrl =
      storeBase && productSlug ? `${storeBase}/product/${productSlug}${couponQuery}` : "";
    const storeUrlWithCoupon = storeBase ? `${storeBase}${couponQuery}` : "";

    const greeting = lead.name ? `Hi ${lead.name} 👋` : "Hi 👋";
    const hook = lead.product_name
      ? `You left *${lead.product_name}* in your cart at ${storeName}.`
      : `You left an item in your cart at ${storeName}.`;

    const link = productUrl || storeUrlWithCoupon;
    const ctaLine = link ? `👉 ${link}` : "";

    const couponLine = couponCode
      ? (recoveryCoupon?.discount_type === "percentage"
          ? `🎁 Flat *${recoveryCoupon.discount_value}% OFF* — coupon *${couponCode}* auto-applied ⏳`
          : `🎁 Flat *₹${recoveryCoupon.discount_value} OFF* — coupon *${couponCode}* auto-applied ⏳`)
      : "";

    return [
      greeting,
      hook,
      "",
      couponLine,
      ctaLine,
      "",
      `— ${storeName}`,
    ]
      .filter(Boolean)
      .join("\n");
  };


  const deleteMutation = useMutation({
    mutationFn: async (leadId: string) => {
      const isCartLead = leadId.startsWith("cart:");
      const { error } = await (supabase as any)
        .from(isCartLead ? "abandoned_carts" : "customer_leads")
        .delete()
        .eq("id", isCartLead ? leadId.slice(5) : leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-leads", storeId] });
      queryClient.invalidateQueries({ queryKey: ["leads-open-abandoned-carts", storeId] });
      queryClient.invalidateQueries({ queryKey: ["leads-cart-products", storeId] });
      toast.success("Lead deleted");
    },
    onError: () => toast.error("Failed to delete lead"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Customer Leads</h1>
        <p className="text-sm text-muted-foreground">
          People who showed interest but haven't placed an order yet — recover them via WhatsApp
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 pb-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">
              {visibleLeads.length} Lead{visibleLeads.length !== 1 ? "s" : ""}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : visibleLeads.length > 0 ? (
            <>
              {/* Mobile card list — everything visible, no horizontal scroll */}
              <div className="space-y-3 sm:hidden">
                {pagedLeads.map((lead) => {
                  const sendWhatsApp = () => {
                    const phone = waPhoneNumber(lead.phone) ?? "";
                    const message = buildRecoveryMessage(lead);
                    window.open(
                      `https://wa.me/${encodeURIComponent(phone)}?text=${encodeURIComponent(message)}`,
                      "_blank"
                    );
                  };
                  return (
                    <div key={lead.id} className="rounded-lg border border-border bg-card p-3 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {lead.name || <span className="text-muted-foreground font-normal">No name</span>}
                          </p>
                          <a
                            href={`tel:${lead.phone}`}
                            className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                          >
                            <Phone className="h-3 w-3" />
                            <span className="font-medium">{lead.phone}</span>
                          </a>
                        </div>
                        <div className="flex flex-shrink-0 flex-col items-end gap-1">
                          <Badge variant="secondary" className="text-[10px]">
                            <MessageCircle className="mr-1 h-2.5 w-2.5" />
                            {lead.source === "whatsapp_order" ? "WhatsApp" : lead.source}
                          </Badge>
                        </div>
                      </div>

                      {lead.product_name && (
                        <p className="mt-2 truncate text-xs text-foreground/80">
                          <span className="text-muted-foreground">Product: </span>
                          {lead.product_name}
                        </p>
                      )}

                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {format(new Date(lead.created_at), "MMM d, yyyy · h:mm a")}
                      </p>

                      <div className="mt-3 flex items-center gap-2">
                        <Button
                          size="sm"
                          className="h-9 flex-1 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                          onClick={sendWhatsApp}
                        >
                          <MessageCircle className="h-4 w-4" />
                          Send WhatsApp
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 w-9 flex-shrink-0 p-0"
                          asChild
                          title="Call"
                        >
                          <a href={`tel:${lead.phone}`}>
                            <Phone className="h-4 w-4" />
                          </a>
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="h-9 w-9 flex-shrink-0 p-0">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete this lead?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently remove this lead record.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate(lead.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop table */}
              <div className="hidden overflow-x-auto sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedLeads.map((lead) => (
                      <TableRow key={lead.id}>
                        <TableCell className="font-medium">
                          {lead.name || <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {lead.phone}
                          </div>
                        </TableCell>
                        <TableCell>
                          {lead.product_name || <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            <MessageCircle className="mr-1 h-3 w-3" />
                            {lead.source === "whatsapp_order" ? "WhatsApp" : lead.source}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(lead.created_at), "MMM d, yyyy h:mm a")}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9"
                              title="Send recovery message on WhatsApp"
                              onClick={() => {
                                const phone = waPhoneNumber(lead.phone) ?? "";
                                const message = buildRecoveryMessage(lead);
                                window.open(
                                  `https://wa.me/${encodeURIComponent(phone)}?text=${encodeURIComponent(message)}`,
                                  "_blank"
                                );
                              }}
                            >
                              <MessageCircle className="h-4 w-4 text-primary" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-9 w-9">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete this lead?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently remove this lead record.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteMutation.mutate(lead.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <Users className="h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground">No leads collected yet</p>
              <p className="text-xs text-muted-foreground">
                Leads appear when customers fill in their details before ordering via WhatsApp
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
