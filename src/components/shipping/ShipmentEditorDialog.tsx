import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { COURIERS, SHIPMENT_STATUS_LABEL, SHIPMENT_STEPS, customerTrackingUrl, courierMeta, validShipmentTrackingNumber } from "@/lib/shipping/courierRegistry";
import type { ShipmentTracking } from "@/hooks/useShipmentTracking";
import CourierLogo from "./CourierLogo";
import ParcelLabelScanner from "./ParcelLabelScanner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orderId: string;
  shipment?: ShipmentTracking | null;
  mode?: "shipping" | "rto";
  /** Fired after a successful save so parent views can close or refresh. */
  onSaved?: (status: string) => void;
}


const STATUS_OPTIONS = [...SHIPMENT_STEPS, "returned", "cancelled", "exception"] as const;

/** The seller's last "notify customer" choice sticks for the next shipment. */
const NOTIFY_PREF_KEY = "sb:shipment-notify-customer";

function readNotifyPref(): boolean {
  try { return localStorage.getItem(NOTIFY_PREF_KEY) !== "0"; } catch { return true; }
}

export default function ShipmentEditorDialog({ open, onOpenChange, orderId, shipment, mode = "shipping", onSaved }: Props) {
  const qc = useQueryClient();
  const isRto = mode === "rto";
  const [slug, setSlug] = useState(shipment?.tracking_slug || "india_post");
  const [awb, setAwb] = useState(shipment?.awb || "");
  const [verifiedScanId, setVerifiedScanId] = useState<string | null>(null);
  const [matchedShipmentId, setMatchedShipmentId] = useState<string | null>(shipment?.id ?? null);
  const isNewShipment = !shipment;
  const [status, setStatus] = useState<string>(isRto ? "returned" : shipment?.status || "shipped");
  const [notify, setNotify] = useState<boolean>(() =>
    (shipment as any)?.notify_customer === false ? false : readNotifyPref(),
  );

  const setNotifyPref = (v: boolean) => {
    setNotify(v);
    try { localStorage.setItem(NOTIFY_PREF_KEY, v ? "1" : "0"); } catch { /* ignore */ }
  };

  const meta = courierMeta(slug);

  useEffect(() => {
    if (!open || !isRto) return;
    let active = true;
    void (async () => {
      const { data: currentShipment } = await (supabase as any)
        .from("order_shipments")
        .select("id,awb,tracking_slug")
        .eq("order_id", orderId)
        .not("awb", "is", null)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!active) return;
      if (currentShipment?.awb) {
        setMatchedShipmentId(currentShipment.id);
        setAwb(currentShipment.awb);
        setSlug(COURIERS.some((courier) => courier.slug === currentShipment.tracking_slug) ? currentShipment.tracking_slug : "india_post");
      }
      const { data: scan } = await (supabase as any)
        .from("parcel_label_scans")
        .select("id,tracking_number,courier_slug")
        .eq("order_id", orderId)
        .eq("decision", "accepted")
        .not("tracking_number", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!active || !scan?.tracking_number) return;
      setVerifiedScanId(scan.id);
      setAwb(scan.tracking_number);
      setSlug(COURIERS.some((courier) => courier.slug === scan.courier_slug) ? scan.courier_slug : "india_post");
      const { data: existingShipment } = await (supabase as any)
        .from("order_shipments")
        .select("id")
        .eq("order_id", orderId)
        .ilike("awb", scan.tracking_number)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (active) setMatchedShipmentId(existingShipment?.id ?? null);
    })();
    return () => { active = false; };
  }, [isRto, open, orderId]);

  const save = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("store_upsert_shipment", {
        _order_id: orderId,
        _slug: slug,
        _courier_name: meta.name,
        _awb: awb.trim(),
        _tracking_url: customerTrackingUrl(slug, awb),
        _status: isRto ? "returned" : isNewShipment ? "shipped" : status,
        _shipment_id: matchedShipmentId,
        // 🔕 Persisted with the shipment so every later path (courier auto-sync,
        // status flips) also respects this choice — not just this save.
        _notify: isRto ? false : notify,
      } as any);
      if (error) throw error;
      // Kick an immediate sync for API-backed couriers (best effort).
      if (meta.api && data) {
        supabase.functions.invoke("shipment-track", { body: { shipment_id: data } }).catch(() => {});
      }

      // 📲 Customer WhatsApp: the shipped/delivered milestones are UTILITY
      // messages. wa-order-event handles template choice, branding and
      // idempotency (one row per order + event), so a re-save never spams.
      let waResult: any = null;
      const savedStatus = isRto ? "returned" : isNewShipment ? "shipped" : status;
      if (!isRto && notify && (savedStatus === "shipped" || savedStatus === "in_transit")) {
        const { data: waData, error: waError } = await supabase.functions.invoke("wa-order-event", {
          body: { event: "order_shipped", order_id: orderId },
        });
        waResult = waError || waData?.error ? { notificationFailed: true } : waData;
      }

      return waResult;
    },
    onSuccess: (waResult: any) => {
      if (waResult?.notificationFailed) toast.warning("Shipment saved, but WhatsApp could not be queued. Try saving again.");
      else if (waResult?.queued) toast.success("Shipment saved · WhatsApp message queued");
      else if (waResult?.reason === "already_enqueued") toast.success("Shipment saved · WhatsApp already sent");
      else if (waResult?.skipped) toast.success(`Shipment saved · WhatsApp skipped (${waResult.reason})`);
      else toast.success("Shipment saved");
      qc.invalidateQueries({ queryKey: ["shipment-tracking", orderId] });
      qc.invalidateQueries({ queryKey: ["parcel-photo", orderId] });
      qc.invalidateQueries({ queryKey: ["store-orders"] });
      qc.invalidateQueries({ queryKey: ["website-orders-all"] });
      onSaved?.(isRto ? "rto" : isNewShipment ? "shipped" : status);
      onOpenChange(false);

    },
    onError: (e: any) => toast.error(e?.message || "Could not save shipment"),
  });


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isRto ? "Mark order as RTO" : shipment ? "Update shipment" : "Add shipment"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {isRto && !matchedShipmentId && (
            <ParcelLabelScanner
              orderId={orderId}
              disabled={save.isPending}
              onScanStart={() => {
                setAwb("");
                setSlug("india_post");
                setVerifiedScanId(null);
              }}
              onAccepted={(result) => {
                if (COURIERS.some((courier) => courier.slug === result.courier_slug)) {
                  setAwb(result.tracking_number);
                  setSlug(result.courier_slug === "other" ? "india_post" : result.courier_slug);
                  setVerifiedScanId(result.scan_id);
                }
              }}
            />
          )}

          {!isRto && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="shipment-courier">Courier partner</Label>
                <Select value={slug} onValueChange={setSlug} disabled={save.isPending}>
                  <SelectTrigger id="shipment-courier"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COURIERS.map((courier) => (
                      <SelectItem key={courier.slug} value={courier.slug}>{courier.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="shipment-tracking">Tracking number</Label>
                <Input id="shipment-tracking" value={awb} onChange={(event) => setAwb(event.target.value)}
                  placeholder="Enter tracking number" maxLength={40} autoComplete="off" disabled={save.isPending} />
              </div>
            </>
          )}

          {isRto && awb && slug && (
            <div className="space-y-2 rounded-md border bg-muted/40 px-3 py-3">
              <p className="text-xs font-medium text-muted-foreground">Verified label details</p>
              <div className="flex items-center gap-2 text-sm font-medium">
                <CourierLogo slug={slug} size={22} />
                <span>{meta.name}</span>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Tracking number</Label>
                <p className="break-all font-mono text-sm font-semibold">{awb}</p>
              </div>
              {slug === "india_post" && (
                <p className="text-[11px] text-muted-foreground">
                  India Post tracking is checked automatically. Saved movements remain visible if its live service is unavailable.
                </p>
              )}
            </div>
          )}

          {isRto ? (
            <div className="rounded-md border bg-muted/40 px-3 py-2.5">
              <p className="text-sm font-medium">Status: Returned to seller</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {matchedShipmentId
                  ? "This tracked shipment will be marked returned to seller. No customer message or automatic refund will be sent."
                  : "Upload this customer's parcel label. The phone number must match before RTO can be saved. No customer message or automatic refund will be sent."}
              </p>
            </div>
          ) : isNewShipment ? (
            <div className="rounded-md border bg-muted/40 px-3 py-2.5">
              <p className="text-sm font-medium">Status: Shipped</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Saving marks the order as shipped.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Current status</Label>
              <p className="text-[11px] text-muted-foreground">
                Returned to seller marks the order as RTO. No customer payment or ShopBanao fee is refunded automatically.
              </p>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{SHIPMENT_STATUS_LABEL[s as keyof typeof SHIPMENT_STATUS_LABEL]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {!isRto && <label className="flex items-start gap-2.5 rounded-lg border p-3 cursor-pointer">
            <Checkbox checked={notify} onCheckedChange={(v) => setNotifyPref(v === true)} className="mt-0.5" />
            <span className="text-sm">
              Notify customer on WhatsApp
              <span className="block text-[11px] text-muted-foreground">
                {notify
                  ? "Sends the courier, tracking number and tracking link. Sent only once per order."
                  : "Off — no shipping message will be sent for this order, including later automatic tracking updates."}
              </span>
              <span className="mt-1 block text-[11px] text-muted-foreground">
                Your choice is saved with the shipment and used as the default next time.
              </span>
            </span>
          </label>}
        </div>


        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !validShipmentTrackingNumber(awb) || (isRto && !verifiedScanId && !matchedShipmentId)}>
            {save.isPending ? "Saving…" : isRto ? "Mark RTO" : "Save shipment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
