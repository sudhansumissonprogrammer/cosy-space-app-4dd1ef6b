import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShoppingBag, MessageCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

// Play a pleasant chime using Web Audio API
function playNotificationChime() {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    // Two-tone chime: C5 → E5
    const notes = [
      { freq: 523.25, start: 0, dur: 0.15 },
      { freq: 659.25, start: 0.15, dur: 0.25 },
    ];

    notes.forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.3, now + start);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur);
    });

    // Close context after sound finishes
    setTimeout(() => ctx.close(), 600);
  } catch {
    // Audio not available — silently ignore
  }
}

export default function OrderNotificationListener() {
  const notifiedRef = useRef<Set<string>>(new Set());
  const unseenCountRef = useRef(0);

  // Get user's store IDs so we only notify for their stores
  const { data: storeIds } = useQuery({
    queryKey: ["my-store-ids"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from("stores").select("id");
      return data?.map((s) => s.id) ?? [];
    },
  });

  useEffect(() => {
    if (!storeIds || storeIds.length === 0) return;

    const storeSet = new Set(storeIds);

    // Request browser notification permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    const updateAppBadge = () => {
      unseenCountRef.current += 1;
      try {
        if ("setAppBadge" in navigator) {
          (navigator as any).setAppBadge(unseenCountRef.current);
        }
      } catch {}
    };

    const showNotification = (title: string, body: string) => {
      // Play chime sound
      playNotificationChime();

      // Update PWA app badge
      updateAppBadge();

      // Toast notification (always)
      toast(title, {
        description: body,
        duration: 8000,
        icon: <ShoppingBag className="h-5 w-5 text-primary" />,
      });

      // Browser notification (if permitted)
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, { body, icon: "/pwa-192x192.png" });
      }
    };

    const channel = supabase
      .channel("order-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          const order = payload.new as any;
          if (!storeSet.has(order.store_id)) return;
          if (notifiedRef.current.has(order.id)) return;
          notifiedRef.current.add(order.id);

          const name = order.customer_name || "A customer";
          const total = `${order.currency} ${Number(order.total).toFixed(2)}`;
          showNotification(
            "🛍️ New Order Received!",
            `${name} placed an order worth ${total}`
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "whatsapp_orders" },
        (payload) => {
          const order = payload.new as any;
          if (!storeSet.has(order.store_id)) return;
          if (notifiedRef.current.has(order.id)) return;
          notifiedRef.current.add(order.id);

          const name = order.customer_name || "A customer";
          const price = Number(order.product_price).toFixed(2);
          showNotification(
            "💬 New WhatsApp Order!",
            `${name} ordered ${order.product_name} (${price})`
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [storeIds]);

  return null;
}
