import { useState } from "react";
import { Truck, Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useShipmentTracking } from "@/hooks/useShipmentTracking";
import ShipmentTimeline from "./ShipmentTimeline";
import ShipmentEditorDialog from "./ShipmentEditorDialog";
import ParcelPhoto from "./ParcelPhoto";

/**
 * Merchant-side shipment block: shows every parcel attached to an order and
 * lets the owner add / edit the tracking number. Saving optionally fires the
 * customer WhatsApp "order shipped" notification.
 */
export default function OrderShipmentSection({ orderId, orderStatus }: { orderId: string; orderStatus: string }) {
  const { data } = useShipmentTracking(orderId);
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);

  const shipments = data ?? [];

  return (
    <section>
      <ParcelPhoto orderId={orderId} />
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Shipment tracking</h3>
        {orderStatus === "shipped" && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-xs"
            onClick={() => { setEditing(null); setOpen(true); }}
          >
            <Plus className="h-3 w-3" /> Add shipment
          </Button>
        )}
      </div>

      {shipments.length === 0 ? (
        <div className="flex items-center gap-2.5 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          <Truck className="h-4 w-4 shrink-0" />
          {orderStatus === "shipped"
            ? "Add the courier and tracking number to show live tracking to the customer."
            : "Choose Shipped as the order status to add courier tracking."}
        </div>
      ) : (
        <div className="space-y-3">
          {shipments.map((s) => (
            <div key={s.id} className="relative">
              <ShipmentTimeline shipment={s} />
              <Button
                size="sm"
                variant="ghost"
                className="absolute right-2 top-2 h-7 gap-1 text-[11px]"
                onClick={() => { setEditing(s); setOpen(true); }}
              >
                <Pencil className="h-3 w-3" /> Edit
              </Button>
            </div>
          ))}
        </div>
      )}

      <ShipmentEditorDialog
        key={editing?.id || "new"}
        open={open}
        onOpenChange={setOpen}
        orderId={orderId}
        shipment={editing ?? undefined}
      />
    </section>
  );
}
