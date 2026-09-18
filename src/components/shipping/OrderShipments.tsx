import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useShipmentTracking, refreshShipmentNow } from "@/hooks/useShipmentTracking";
import { courierMeta, isTerminal } from "@/lib/shipping/courierRegistry";
import { Button } from "@/components/ui/button";
import ShipmentTimeline from "./ShipmentTimeline";

/** Renders every shipment attached to an order. Nothing renders when there are none. */
export default function OrderShipments({ orderId, client }: { orderId: string; client?: any }) {
  const { data } = useShipmentTracking(orderId, client);
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  if (!data || data.length === 0) return null;

  const refresh = async (id: string) => {
    setBusy(id);
    try {
      const res = await refreshShipmentNow(id, { asCustomer: true });
      if (res?.throttled) toast.info(res.message || "Just checked — try again in a few minutes.");
      else if (res?.unavailable || res?.blocked || res?.error) toast.info("Live courier scans are temporarily unavailable. Your saved tracking remains visible.");
      else toast.success("Tracking updated");
      qc.invalidateQueries({ queryKey: ["shipment-tracking", orderId] });
    } catch {
      toast.error("Could not reach the courier right now");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      {data.map((s) => (
        <div key={s.id} className="relative">
          <ShipmentTimeline shipment={s} />
          {courierMeta(s.tracking_slug).api && !isTerminal(s.status) && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => refresh(s.id)}
              disabled={busy === s.id}
              className="absolute right-2 top-2 h-7 rounded-full bg-background/80 px-2.5 text-[11px] text-muted-foreground backdrop-blur hover:text-foreground"
            >
              <RefreshCw className={`h-3 w-3 ${busy === s.id ? "animate-spin" : ""}`} />
              {busy === s.id ? "Checking…" : "Refresh"}
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
