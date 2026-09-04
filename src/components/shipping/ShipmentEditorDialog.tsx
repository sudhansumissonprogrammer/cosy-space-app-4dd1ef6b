import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { COURIERS, SHIPMENT_STATUS_LABEL, SHIPMENT_STEPS, courierMeta, officialTrackingUrl } from "@/lib/shipping/courierRegistry";
import type { ShipmentTracking } from "@/hooks/useShipmentTracking";
import CourierLogo from "./CourierLogo";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orderId: string;
  shipment?: ShipmentTracking | null;
  /** Fired after a successful save so parent views can close or refresh. */
  onSaved?: (status: string) => void;
}


const STATUS_OPTIONS = [...SHIPMENT_STEPS, "returned", "cancelled", "exception"] as const;

/** The seller's last "notify customer" choice sticks for the next shipment. */
const NOTIFY_PREF_KEY = "sb:shipment-notify-customer";

function readNotifyPref(): boolean {
  try { return localStorage.getItem(NOTIFY_PREF_KEY) !== "0"; } catch { return true; }
}

export default function ShipmentEditorDialog({ open, onOpenChange, orderId, shipment, onSaved }: Props) {
  const qc = useQueryClient();
  const [slug, setSlug] = useState(shipment?.tracking_slug || "delhivery");
  const [awb, setAwb] = useState(shipment?.awb || "");
  const isNewShipment = !shipment;
  const [status, setStatus] = useState<string>(shipment?.status || "shipped");
  const [notify, setNotify] = useState<boolean>(() =>
    (shipment as any)?.notify_customer === false ? false : readNotifyPref(),
  );

  const setNotifyPref = (v: boolean) => {
    setNotify(v);
    try { localStorage.setItem(NOTIFY_PREF_KEY, v ? "1" : "0"); } catch { /* ignore */ }
  };

  const meta = courierMeta(slug);

  const save = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("store_upsert_shipment", {
        _order_id: orderId,
        _slug: slug,
        _courier_name: meta.name,
        _awb: awb.trim(),
        _tracking_url: officialTrackingUrl(slug, awb.trim()),
        // A new AWB always starts as shipped. RTO/cancelled are outcomes that
        // can only be recorded later while editing the existing shipment.
        _status: isNewShipment ? "shipped" : status,
        _shipment_id: shipment?.id ?? null,
      });
      if (error) throw error;
      // Kick an immediate sync for API-backed couriers (best effort).
      if (meta.api && data) {
        supabase.functions.invoke("shipment-track", { body: { shipment_id: data } }).catch(() => {});
      }

      // 📲 Customer WhatsApp: the shipped/delivered milestones are UTILITY
      // messages. wa-order-event handles template choice, branding and
      // idempotency (one row per order + event), so a re-save never spams.
      let waResult: any = null;
      const savedStatus = isNewShipment ? "shipped" : status;
      if (notify && (savedStatus === "shipped" || savedStatus === "in_transit")) {
        const { data: waData } = await supabase.functions.invoke("wa-order-event", {
          body: { event: "order_shipped", order_id: orderId },
        });
        waResult = waData;
      }

      return waResult;
    },
    onSuccess: (waResult: any) => {
      if (waResult?.queued) toast.success("Shipment saved · WhatsApp sent to customer");
      else if (waResult?.reason === "already_enqueued") toast.success("Shipment saved · WhatsApp already sent");
      else if (waResult?.skipped) toast.success(`Shipment saved · WhatsApp skipped (${waResult.reason})`);
      else toast.success("Shipment saved");
      qc.invalidateQueries({ queryKey: ["shipment-tracking", orderId] });
      qc.invalidateQueries({ queryKey: ["store-orders"] });
      qc.invalidateQueries({ queryKey: ["website-orders-all"] });
      onSaved?.(isNewShipment ? "shipped" : status);
      onOpenChange(false);

    },
    onError: (e: any) => toast.error(e?.message || "Could not save shipment"),
  });


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{shipment ? "Update shipment" : "Add shipment"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Courier</Label>
            <Select value={slug} onValueChange={setSlug}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COURIERS.map((c) => (
                  <SelectItem key={c.slug} value={c.slug}>
                    <span className="flex items-center gap-2">
                      <CourierLogo slug={c.slug} size={20} />
                      <span>{c.name}{c.api ? " · auto-tracking" : ""}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!meta.api && (
              <p className="text-[11px] text-muted-foreground">
                This courier has no live API (India Post is captcha-gated) — set the status here
                and customers see the same timeline. Use "Returned to seller (RTO)" when the parcel
                comes back, and "Cancelled" only when the shipment never went out.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Tracking number (AWB)</Label>
            <Input value={awb} onChange={(e) => setAwb(e.target.value)} placeholder="e.g. 1234567890" autoComplete="off" />
          </div>

          {isNewShipment ? (
            <div className="rounded-md border bg-muted/40 px-3 py-2.5">
              <p className="text-sm font-medium">Status: Shipped</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Adding this tracking number marks the order as shipped. You can record delivery or RTO later.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Current status</Label>
              <p className="text-[11px] text-muted-foreground">
                Delivered updates the order to delivered. RTO or Cancelled updates it to cancelled.
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

          <label className="flex items-start gap-2.5 rounded-lg border p-3 cursor-pointer">
            <Checkbox checked={notify} onCheckedChange={(v) => setNotify(v === true)} className="mt-0.5" />
            <span className="text-sm">
              Notify customer on WhatsApp
              <span className="block text-[11px] text-muted-foreground">
                Sends the tracking number, courier and expected delivery date. Sent only once per order.
              </span>
            </span>
          </label>
        </div>


        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || awb.trim().length < 4}>
            {save.isPending ? "Saving…" : "Save shipment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
