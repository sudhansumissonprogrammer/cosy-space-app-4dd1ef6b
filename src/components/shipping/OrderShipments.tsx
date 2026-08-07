import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useShipmentTracking, refreshShipmentNow } from "@/hooks/useShipmentTracking";
import { courierMeta, isTerminal } from "@/lib/shipping/courierRegistry";
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
            <button
              type="button"
              onClick={() => refresh(s.id)}
              disabled={busy === s.id}
              className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full border bg-background/80 px-2.5 py-1 text-[11px] text-muted-foreground backdrop-blur transition hover:text-foreground disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${busy === s.id ? "animate-spin" : ""}`} />
              {busy === s.id ? "Checking…" : "Refresh"}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
