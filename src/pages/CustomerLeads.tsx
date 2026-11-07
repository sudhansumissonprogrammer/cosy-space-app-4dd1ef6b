import { useEffect, useState } from "react";
import PaginationControls from "@/components/PaginationControls";
import { useStoreSlugParam } from "@/hooks/useStoreSlugParam";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
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
  product_slug: string | null;
  source: string;
  created_at: string;
};

type LeadsPage = { total: number; rows: CustomerLead[] };

const PAGE_SIZE = 20;

// The backend merges leads + open abandoned carts, hides customers who
// placed a confirmed/shipped/delivered order within 30 minutes, and returns
// one page at a time — so the dashboard never downloads every lead, cart
// and order of a high-volume store just to show 20 rows.
async function fetchLeadsPage(storeId: string, page: number): Promise<LeadsPage> {
  const { data, error } = await (supabase as any).rpc("get_store_leads_page", {
    _store_id: storeId,
    _page: page,
    _page_size: PAGE_SIZE,
  });
  if (error) throw error;
  const payload = (data ?? {}) as { total?: number; rows?: any[] };
  return {
    total: Number(payload.total ?? 0),
    rows: (payload.rows ?? []).map((r) => ({
      id: String(r.id),
      name: r.name ?? null,
      phone: r.is_cart ? normalizePhone(r.phone) : String(r.phone ?? ""),
      product_name: r.product_name ?? null,
      product_id: r.product_id ?? null,
      product_slug: r.product_slug ?? null,
      source: String(r.source ?? ""),
      created_at: String(r.created_at),
    })),
  };
}

export default function CustomerLeads() {
  const { storeId } = useStoreSlugParam();
  const queryClient = useQueryClient();
  const { data: myStore } = useMyStore();
  const [page, setPage] = useState(1);

  const { data: leadsPage, isLoading, isError, refetch } = useQuery({
    queryKey: ["store-leads-page", storeId, page],
    queryFn: () => fetchLeadsPage(storeId!, page),
    enabled: !!storeId,
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
  });

  const total = leadsPage?.total ?? 0;
  const pagedLeads = leadsPage?.rows ?? [];
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  useEffect(() => { if (leadsPage && page > totalPages) setPage(totalPages); }, [leadsPage, totalPages, page]);

  // Warm the next page so "Next" feels instant.
  useEffect(() => {
    if (!storeId || page >= totalPages) return;
    queryClient.prefetchQuery({
      queryKey: ["store-leads-page", storeId, page + 1],
      queryFn: () => fetchLeadsPage(storeId, page + 1),
      staleTime: 60 * 1000,
    });
  }, [storeId, page, totalPages, queryClient]);

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
    product_slug: string | null;
    source: string;
  }) => {
    const storeName = myStore?.name || "our store";
    const storeBase = myStore?.slug
      ? getStoreBaseUrl(myStore.slug, myStore?.custom_domain)
      : "";
    const productSlug = lead.product_slug;
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
      queryClient.invalidateQueries({ queryKey: ["store-leads-page", storeId] });
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
              {isLoading ? "Leads" : `${total} Lead${total !== 1 ? "s" : ""}`}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <p className="text-muted-foreground">Couldn't load leads.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Try again</Button>
            </div>
          ) : total > 0 ? (
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
