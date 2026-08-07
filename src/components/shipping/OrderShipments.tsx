import { useShipmentTracking } from "@/hooks/useShipmentTracking";
import ShipmentTimeline from "./ShipmentTimeline";

/** Renders every shipment attached to an order. Nothing renders when there are none. */
export default function OrderShipments({ orderId, client }: { orderId: string; client?: any }) {
  const { data } = useShipmentTracking(orderId, client);
  if (!data || data.length === 0) return null;
  return (
    <div className="space-y-3">
      {data.map((s) => <ShipmentTimeline key={s.id} shipment={s} />)}
    </div>
  );
}
