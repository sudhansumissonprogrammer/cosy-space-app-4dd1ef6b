import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Package, CheckCircle, Truck, PackageCheck } from "lucide-react";
import { useStorefrontAuth } from "@/contexts/StorefrontAuthContext";

const STATUS_MAP: Record<string, { label: string; icon: React.ReactNode; emoji: string }> = {
  confirmed: { label: "Order Confirmed", icon: <CheckCircle className="h-5 w-5 text-green-500" />, emoji: "✅" },
  shipped: { label: "Order Shipped", icon: <Truck className="h-5 w-5 text-blue-500" />, emoji: "🚚" },
  delivered: { label: "Order Delivered", icon: <PackageCheck className="h-5 w-5 text-green-600" />, emoji: "📦" },
  cancelled: { label: "Order Cancelled", icon: <Package className="h-5 w-5 text-red-500" />, emoji: "❌" },
};

function playChime() {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 587.33; // D5
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
    setTimeout(() => ctx.close(), 500);
  } catch {
    // Audio not available
  }
}

export default function StorefrontOrderNotification({ storeName }: { storeName: string }) {
  const { customer } = useStorefrontAuth();
  const notifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!customer?.id) return;

    const channel = supabase
      .channel(`storefront-order-${customer.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `storefront_customer_id=eq.${customer.id}`,
        },
        (payload) => {
          const order = payload.new as any;
          const oldOrder = payload.old as any;

          // Only notify if status actually changed
          if (order.status === oldOrder.status) return;

          const notifKey = `${order.id}-${order.status}`;
          if (notifiedRef.current.has(notifKey)) return;
          notifiedRef.current.add(notifKey);

          const statusInfo = STATUS_MAP[order.status];
          if (!statusInfo) return;

          playChime();

          const orderId = order.id.slice(0, 8).toUpperCase();
          toast(`${statusInfo.emoji} ${statusInfo.label}`, {
            description: `Order #${orderId} from ${storeName}`,
            duration: 8000,
            icon: statusInfo.icon,
          });

          // Browser notification
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification(`${statusInfo.emoji} ${statusInfo.label}`, {
              body: `Order #${orderId} from ${storeName}`,
              icon: "/pwa-192x192.png",
            });
          }
        }
      )
      .subscribe();

    // Request notification permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    return () => {
      supabase.removeChannel(channel);
    };
  }, [customer?.id, storeName]);

  return null;
}
