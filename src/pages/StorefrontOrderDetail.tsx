import { useState } from "react";
import { useParams, Link, Navigate, useNavigate, useOutletContext } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseStorefront as supabase } from "@/integrations/supabase/storefrontClient";
import { useStorefrontAuth } from "@/contexts/StorefrontAuthContext";
import { storefrontPath } from "@/lib/subdomain";
import { normalizePhone } from "@/lib/phoneUtils";
import type { StoreData } from "@/layouts/StorefrontLayout";
import OrderStatusTimeline from "@/components/storefront/OrderStatusTimeline";
import OrderShipments from "@/components/shipping/OrderShipments";
import { getOrderStatusMeta, paymentDisplay } from "@/lib/orderStatus";
import { buildOrderBreakdown } from "@/lib/orderPaymentBreakdown";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ArrowLeft, Package, MapPin, Phone, CreditCard, Banknote, Smartphone,
  FileDown, MessageCircle, XCircle, RotateCcw, ShoppingBag,
  Loader2, ShieldCheck, Receipt, Truck,
} from "lucide-react";
import { currencySymbol } from "@/lib/productUtils";

const CANCEL_REASONS = [
  "Changed my mind",
  "Found a better price",
  "Wrong product / size",
  "Delivery taking too long",
  "Other",
];

const RETURN_REASONS = [
  "Defective / damaged",
  "Wrong item delivered",
  "Doesn't match description",
  "Size or fit issue",
  "No longer needed",
  "Other",
];

function PaymentIcon({ method }: { method?: string }) {
  const m = (method || "").toLowerCase();
  if (m.includes("cod") || m.includes("cash")) return <Banknote className="h-4 w-4" />;
  if (m.includes("upi") || m.includes("gpay") || m.includes("phonepe") || m.includes("paytm")) return <Smartphone className="h-4 w-4" />;
  return <CreditCard className="h-4 w-4" />;
}

function payLabel(method?: string) {
  const m = (method || "").toLowerCase();
  if (m.includes("cod") || m.includes("cash")) return "Cash on Delivery";
  if (m.includes("upi")) return "UPI";
  if (m.includes("razorpay")) return "Razorpay";
  if (m.includes("cashfree")) return "Cashfree";
  if (m.includes("payu")) return "PayU";
  if (m.includes("card")) return "Card";
  return method || "Online Payment";
}

export default function StorefrontOrderDetail() {
  const { orderId } = useParams<{ orderId: string }>();
  const store = useOutletContext<StoreData>();
  const { user, loading: authLoading } = useStorefrontAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [downloadingInvoice, setDownloadingInvoice] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState(CANCEL_REASONS[0]);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnReason, setReturnReason] = useState(RETURN_REASONS[0]);
  const [returnNote, setReturnNote] = useState("");

  const { data: order, isLoading } = useQuery({
    queryKey: ["storefront-order-detail", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*, products(id, name, slug, image_url))")
        .eq("id", orderId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!orderId,
    // Always refetch on mount/focus so the merchant's dashboard changes
    // (pending → partially_paid → confirmed → shipped → delivered) show up
    // immediately to the customer — no stale list cache mismatch.
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    // Instant render: hydrate from the orders-list cache if we have it,
    // then refetch in the background to fill in slug/name fields the list omits.
    initialData: () => {
      const cached = qc.getQueriesData<any[]>({ queryKey: ["storefront-customer-orders"] });
      for (const [, list] of cached) {
        const found = Array.isArray(list) ? list.find((o: any) => o?.id === orderId) : null;
        if (found) return found;
      }
      return undefined;
    },
    initialDataUpdatedAt: 0,
  });


  const cancelMutation = useMutation({
    mutationFn: async () => {
      // Cancel via SECURITY DEFINER RPC: server only flips `status` (and appends
      // reason to notes). Direct UPDATE is no longer allowed by RLS — this stops
      // a malicious client from zeroing `total` / rewriting customer fields while
      // cancelling.
      const { error } = await supabase.rpc("cancel_own_order", {
        _order_id: orderId!,
        _reason: cancelReason || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["storefront-order-detail", orderId] });
      qc.invalidateQueries({ queryKey: ["storefront-customer-orders"] });
      setCancelOpen(false);
      toast.success("Order cancelled");
    },
    onError: (e: any) => toast.error(e?.message || "Unable to cancel"),
  });

  if (authLoading || isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 space-y-4">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  // WhatsApp "View Order" CTA lands here without a session. Bouncing to /login
  // (a bare form) is what merchants have been reporting as "goes to landing".
  // Send unauthenticated shoppers to the public tracker with the order id
  // prefilled so they see status immediately.
  if (!user) return <Navigate to={`${storefrontPath(store.slug, "track-order")}?id=${encodeURIComponent(orderId || "")}`} replace />;

  if (!order) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <Package className="mx-auto mb-3 h-12 w-12 opacity-30" />
        <p className="text-lg font-medium">Order not found</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to={storefrontPath(store.slug, "account")}>Back to My Orders</Link>
        </Button>
      </div>
    );
  }

  const items = order.order_items || [];
  const orderShort = order.order_number ? `#${1000 + order.order_number}` : `#${order.id.slice(0, 8).toUpperCase()}`;
  const subtotal = items.reduce((s: number, it: any) => s + Number(it.total || 0), 0);
  const canCancel = order.status === "pending" || order.status === "confirmed" || order.status === "partially_paid";
  const deliveredAt = order.status === "delivered" ? new Date(order.updated_at) : null;
  const canReturn = !!deliveredAt && (Date.now() - deliveredAt.getTime()) < 7 * 24 * 60 * 60 * 1000;
  const isPaid = !!order.payment_verified || (order.payment_method && !/cod|cash/i.test(order.payment_method));

  const ownerPhone = store.whatsapp_number ? normalizePhone(store.whatsapp_number) : "";
  const ownerPhoneClean = ownerPhone.replace(/\D/g, "");
  const buildWa = (msg: string) =>
    ownerPhoneClean ? `https://wa.me/${ownerPhoneClean}?text=${encodeURIComponent(msg)}` : "";

  const helpWa = buildWa(`Hi! I need help with my order ${orderShort} from ${store.name}.`);

  const submitReturn = () => {
    const msg = `Hi! I'd like to return order ${orderShort} from ${store.name}.\n\nReason: ${returnReason}${returnNote ? `\nDetails: ${returnNote}` : ""}`;
    const url = buildWa(msg);
    if (!url) { toast.error("Store contact unavailable"); return; }
    window.open(url, "_blank", "noopener,noreferrer");
    setReturnOpen(false);
    toast.success("Return request opened on WhatsApp");
  };

  return (
    <div className="mx-auto max-w-3xl px-4 pb-28 pt-4 lg:pb-8">
      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        {/* Never navigate(-1) here: the previous entry is usually the checkout
            page the order was just placed from, which instantly bounces back. */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(storefrontPath(store.slug), { replace: true })}
          aria-label="Back to home"
          className="h-9 w-9 -ml-2"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-semibold leading-tight truncate">Order {orderShort}</h1>
          <p className="text-[11px]" style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 55%, transparent)" }}>
            Placed {new Date(order.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {/* Timeline */}
          <section className="rounded-2xl border bg-card p-5"
                   style={{ borderColor: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 10%, transparent)" }}>
            {(() => {
              const meta = getOrderStatusMeta(order.status);
              return (
                <div className="mb-4 flex items-center justify-between gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ${meta.bg} ${meta.text}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                    {meta.label}
                  </span>
                  <span className="text-[11px]" style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 55%, transparent)" }}>
                    Updated {new Date(order.updated_at || order.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              );
            })()}
            <OrderStatusTimeline status={order.status} createdAt={order.created_at} updatedAt={order.updated_at} />

            {order.tracking_number && order.status !== "cancelled" && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-dashed p-3"
                   style={{ borderColor: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 18%, transparent)" }}>
                <Truck className="h-4 w-4 shrink-0 opacity-60" />
                <div className="min-w-0">
                  <p className="text-[11px] opacity-60">Tracking ID</p>
                  <p className="text-sm font-mono truncate">{order.tracking_number}</p>
                </div>
              </div>
            )}
          </section>

          {/* Shipment tracking — WhatsApp "Track order" deep-links to #shipment */}
          <div id="shipment" className="scroll-mt-24">
            <OrderShipments orderId={order.id} client={supabase} />
          </div>




          {/* Items */}
          <section className="rounded-2xl border bg-card overflow-hidden"
                   style={{ borderColor: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 10%, transparent)" }}>
            <div className="flex items-center gap-2 px-5 pt-4">
              <ShoppingBag className="h-4 w-4 opacity-60" />
              <h2 className="text-sm font-semibold">Items ({items.length})</h2>
            </div>
            <div className="divide-y" style={{ borderColor: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 8%, transparent)" }}>
              {items.map((item: any) => {
                const img = item.products?.image_url || item.image_url;
                const slug = item.products?.slug;
                const borderStyle = { borderColor: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 10%, transparent)" };
                const thumb = img ? (
                  <img
                    src={img}
                    alt={item.product_name}
                    loading="lazy"
                    className="h-20 w-20 rounded-xl object-cover border"
                    style={borderStyle}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <div className="h-20 w-20 rounded-xl flex items-center justify-center border" style={borderStyle}>
                    <Package className="h-6 w-6 opacity-40" />
                  </div>
                );
                return (
                  <div key={item.id} className="flex gap-3 p-5">
                    {slug ? (
                      <Link
                        to={storefrontPath(store.slug, `product/${slug}`)}
                        className="shrink-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        aria-label={`View ${item.product_name}`}
                      >
                        {thumb}
                      </Link>
                    ) : (
                      <div className="shrink-0">{thumb}</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-clamp-2">{item.product_name}</p>
                      <p className="text-xs mt-0.5" style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 55%, transparent)" }}>
                        Qty: {item.quantity} · {currencySymbol(store.currency)}{Number(item.unit_price).toFixed(0)} each
                      </p>
                      <p className="text-sm font-semibold mt-1">{currencySymbol(store.currency)}{Number(item.total).toFixed(0)}</p>
                      {slug && (order.status === "delivered" || order.status === "cancelled") && (
                        <Button asChild variant="outline" size="sm" className="h-9 px-2.5 text-xs mt-2">
                          <Link to={storefrontPath(store.slug, `product/${slug}`)}>
                            <RotateCcw className="h-3 w-3 mr-1" /> Buy Again
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Delivery address */}
          {(order.street_address || order.customer_name) && (
            <section className="rounded-2xl border bg-card p-5"
                     style={{ borderColor: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 10%, transparent)" }}>
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="h-4 w-4 opacity-60" />
                <h2 className="text-sm font-semibold">Delivery Address</h2>
              </div>
              <p className="text-sm font-medium">{order.customer_name}</p>
              <p className="text-sm leading-relaxed" style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 70%, transparent)" }}>
                {[order.street_address, order.city, order.state, order.pincode].filter(Boolean).join(", ")}
              </p>
              {order.customer_phone && (
                <p className="text-sm mt-2 inline-flex items-center gap-1.5"
                   style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 70%, transparent)" }}>
                  <Phone className="h-3.5 w-3.5" /> {order.customer_phone}
                </p>
              )}
            </section>
          )}
        </div>

        {/* Side column */}
        <div className="space-y-4">
          {/* Payment */}
          <section className="rounded-2xl border bg-card p-5"
                   style={{ borderColor: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 10%, transparent)" }}>
            <div className="flex items-center gap-2 mb-3">
              <Receipt className="h-4 w-4 opacity-60" />
              <h2 className="text-sm font-semibold">Payment Details</h2>
            </div>
            <div className="flex items-center gap-2 rounded-xl p-2.5 mb-3"
                 style={{ backgroundColor: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 5%, transparent)" }}>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-background border">
                <PaymentIcon method={order.payment_method} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium">{payLabel(order.payment_method)}</p>
                {(() => {
                  const pay = paymentDisplay(order);
                  const color = pay.tone === "paid"
                    ? "rgb(16 185 129)"
                    : pay.tone === "pending"
                    ? "rgb(217 119 6)"
                    : "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 55%, transparent)";
                  return (
                    <p className="text-[10px] inline-flex items-center gap-1" style={{ color }}>
                      {pay.tone === "paid" && <ShieldCheck className="h-3 w-3" />}
                      {pay.label}
                    </p>
                  );
                })()}
              </div>

            </div>

            {(() => {
              const bd = buildOrderBreakdown(order, subtotal);
              const dim = "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 60%, transparent)";
              return (
                <dl className="space-y-1.5 text-xs">
                  {bd.lines.map((l) => (
                    <div key={l.label} className="flex justify-between">
                      <dt style={{ color: dim }}>{l.label}</dt>
                      <dd className={l.kind === "discount" ? "text-emerald-600 font-medium" : undefined}>
                        {l.amount < 0 ? "− " : ""}{currencySymbol(store.currency)}{Math.abs(l.amount).toFixed(0)}
                      </dd>
                    </div>
                  ))}
                  <Separator className="my-2" />
                  <div className="flex justify-between text-sm font-semibold">
                    <dt>Order total</dt>
                    <dd>{currencySymbol(store.currency)}{bd.total.toFixed(0)}</dd>
                  </div>
                  {bd.paid > 0 && (
                    <div className="flex justify-between">
                      <dt style={{ color: dim }}>{bd.isPartial ? "Advance paid online" : "Paid online"}</dt>
                      <dd className="font-semibold text-emerald-600">{currencySymbol(store.currency)}{bd.paid.toFixed(0)}</dd>
                    </div>
                  )}
                  {bd.dueOnDelivery > 0 && (
                    <div className="mt-2 flex justify-between rounded-lg bg-muted/60 px-2.5 py-2 text-[11px]">
                      <span className="font-medium">Pay on delivery</span>
                      <span className="font-bold">{currencySymbol(store.currency)}{bd.dueOnDelivery.toFixed(0)}</span>
                    </div>
                  )}
                </dl>
              );
            })()}

          </section>

          {/* Actions */}
          <section className="rounded-2xl border bg-card p-3 space-y-2"
                   style={{ borderColor: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 10%, transparent)" }}>
            <Button
              variant="outline"
              className="w-full justify-start"
              disabled={downloadingInvoice}
              onClick={async () => {
                setDownloadingInvoice(true);
                try {
                  const { downloadInvoicePdf } = await import("@/lib/sendInvoiceWhatsApp");
                  const res = await downloadInvoicePdf({ order, store });
                  if (!res.success) toast.error(res.error || "Could not download invoice");
                } finally {
                  setDownloadingInvoice(false);
                }
              }}
            >
              {downloadingInvoice
                ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                : <FileDown className="h-4 w-4 mr-2" />}
              {downloadingInvoice ? "Preparing…" : "Download Invoice"}
            </Button>
            {helpWa && (
              <Button asChild variant="outline" className="w-full justify-start">
                <a href={helpWa} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-4 w-4 mr-2 text-emerald-600" /> Need Help?
                </a>
              </Button>
            )}
            {canReturn && (
              <Button variant="outline" className="w-full justify-start" onClick={() => setReturnOpen(true)}>
                <RotateCcw className="h-4 w-4 mr-2" /> Return Order
              </Button>
            )}
          </section>
        </div>
      </div>



      {/* Return dialog */}
      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request a Return</DialogTitle>
          </DialogHeader>
          <p className="text-xs opacity-70">
            We'll open WhatsApp with your return request — the store will confirm pickup details.
          </p>
          <RadioGroup value={returnReason} onValueChange={setReturnReason} className="space-y-2">
            {RETURN_REASONS.map((r) => (
              <div key={r} className="flex items-center space-x-2">
                <RadioGroupItem value={r} id={`r-${r}`} />
                <Label htmlFor={`r-${r}`} className="text-sm font-normal cursor-pointer">{r}</Label>
              </div>
            ))}
          </RadioGroup>
          <div>
            <Label className="text-xs">Additional notes (optional)</Label>
            <Textarea value={returnNote} onChange={(e) => setReturnNote(e.target.value)}
                      placeholder="Add any details..." className="mt-1 h-20 text-sm" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setReturnOpen(false)}>Cancel</Button>
            <Button onClick={submitReturn}>
              <MessageCircle className="h-4 w-4 mr-2" /> Send via WhatsApp
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
