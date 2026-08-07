import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { COURIERS, SHIPMENT_STATUS_LABEL, SHIPMENT_STEPS, courierMeta, officialTrackingUrl } from "@/lib/shipping/courierRegistry";
import type { ShipmentTracking } from "@/hooks/useShipmentTracking";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orderId: string;
  shipment?: ShipmentTracking | null;
}

const STATUS_OPTIONS = [...SHIPMENT_STEPS, "returned", "cancelled", "exception"] as const;

export default function ShipmentEditorDialog({ open, onOpenChange, orderId, shipment }: Props) {
  const qc = useQueryClient();
  const [slug, setSlug] = useState(shipment?.tracking_slug || "delhivery");
  const [awb, setAwb] = useState(shipment?.awb || "");
  const [status, setStatus] = useState<string>(shipment?.status || "shipped");

  const meta = courierMeta(slug);

  const save = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("store_upsert_shipment", {
        _order_id: orderId,
        _slug: slug,
        _courier_name: meta.name,
        _awb: awb.trim(),
        _tracking_url: officialTrackingUrl(slug, awb.trim()),
        _status: status,
        _shipment_id: shipment?.id ?? null,
      });
      if (error) throw error;
      // Kick an immediate sync for API-backed couriers (best effort).
      if (meta.api && data) {
        supabase.functions.invoke("shipment-track", { body: { shipment_id: data } }).catch(() => {});
      }
      return data;
    },
    onSuccess: () => {
      toast.success("Shipment saved");
      qc.invalidateQueries({ queryKey: ["shipment-tracking", orderId] });
      qc.invalidateQueries({ queryKey: ["store-orders"] });
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
                    {c.name}{c.api ? " · auto-tracking" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!meta.api && (
              <p className="text-[11px] text-muted-foreground">
                This courier has no API — update the status here and customers see the same timeline.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Tracking number (AWB)</Label>
            <Input value={awb} onChange={(e) => setAwb(e.target.value)} placeholder="e.g. 1234567890" autoComplete="off" />
          </div>

          <div className="space-y-1.5">
            <Label>Current status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{SHIPMENT_STATUS_LABEL[s as keyof typeof SHIPMENT_STATUS_LABEL]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
