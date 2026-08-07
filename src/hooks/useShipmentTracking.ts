import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ShipmentStatus } from "@/lib/shipping/courierRegistry";

export interface ShipmentEvent {
  status: ShipmentStatus;
  description: string | null;
  location: string | null;
  event_time: string;
}

export interface ShipmentTracking {
  id: string;
  provider: string;
  tracking_slug: string;
  courier_name: string | null;
  awb: string | null;
  status: ShipmentStatus;
  current_location: string | null;
  estimated_delivery: string | null;
  tracking_url: string | null;
  last_synced_at: string | null;
  created_at: string;
  events: ShipmentEvent[];
}

/**
 * Reads the cached tracking snapshot from the database — never calls a
 * courier API. Background sync keeps it fresh.
 */
export function useShipmentTracking(orderId: string | null | undefined, client?: any) {
  const db = client ?? supabase;
  return useQuery({
    queryKey: ["shipment-tracking", orderId],
    enabled: !!orderId,
    staleTime: 60_000,
    queryFn: async (): Promise<ShipmentTracking[]> => {
      const { data, error } = await db.rpc("get_shipment_tracking", {
        _order_id: orderId as string,
      });
      if (error) throw error;
      return (data as unknown as ShipmentTracking[]) ?? [];
    },
  });
}
