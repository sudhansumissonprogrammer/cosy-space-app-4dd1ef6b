import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ShipmentStatus } from "@/lib/shipping/courierRegistry";
import { courierMeta, isTerminal } from "@/lib/shipping/courierRegistry";

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
  next_sync_at: string | null;
  last_error: string | null;
  created_at: string;
  events: ShipmentEvent[];
}

/** Consider the cached snapshot stale after this long. */
const STALE_MS = 15 * 60 * 1000;

/**
 * Reads the cached tracking snapshot from the database and keeps it live:
 * - polls the snapshot every 60s while a parcel is still moving,
 * - asks the courier for a fresh pull (via the shipment-track edge function)
 *   when the snapshot is older than 15 min — the function itself throttles to
 *   one courier hit per shipment / 10 min, so this is safe at any traffic.
 */
export function useShipmentTracking(orderId: string | null | undefined, client?: any) {
  const db = client ?? supabase;
  const qc = useQueryClient();
  const refreshed = useRef<Set<string>>(new Set());

  const query = useQuery({
    queryKey: ["shipment-tracking", orderId],
    enabled: !!orderId,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchInterval: (q) => {
      const rows = (q.state.data as ShipmentTracking[] | undefined) ?? [];
      const live = rows.some((s) => !isTerminal(s.status));
      return live ? 60_000 : false;
    },
    queryFn: async (): Promise<ShipmentTracking[]> => {
      const { data, error } = await db.rpc("get_shipment_tracking", {
        _order_id: orderId as string,
      });
      if (error) throw error;
      return (data as unknown as ShipmentTracking[]) ?? [];
    },
  });

  // Kick a courier pull for stale, API-backed, non-terminal shipments.
  useEffect(() => {
    const rows = query.data ?? [];
    let cancelled = false;

    (async () => {
      for (const s of rows) {
        if (isTerminal(s.status)) continue;
        if (!courierMeta(s.tracking_slug).api) continue;
        if (refreshed.current.has(s.id)) continue;
        const age = s.last_synced_at ? Date.now() - new Date(s.last_synced_at).getTime() : Infinity;
        if (age < STALE_MS) continue;

        refreshed.current.add(s.id);
        try {
          const { data } = await supabase.functions.invoke("shipment-track", {
            body: { shipment_id: s.id, public: true },
          });
          if (!cancelled && data && !(data as any).throttled) {
            qc.invalidateQueries({ queryKey: ["shipment-tracking", orderId] });
          }
        } catch {
          /* tracking stays on the cached snapshot */
        }
      }
    })();

    return () => { cancelled = true; };
  }, [query.data, orderId, qc]);

  return query;
}

/** Manual "check now" — same throttled edge path, used by refresh buttons. */
export async function refreshShipmentNow(shipmentId: string, opts?: { asCustomer?: boolean }) {
  const { data, error } = await supabase.functions.invoke("shipment-track", {
    body: { shipment_id: shipmentId, ...(opts?.asCustomer ? { public: true } : {}) },
  });
  if (error) throw error;
  return data as { throttled?: boolean; status?: string; manual?: boolean; message?: string };
}
