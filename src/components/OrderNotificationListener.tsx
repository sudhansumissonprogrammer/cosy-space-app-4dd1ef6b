import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShoppingBag, MessageCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function OrderNotificationListener() {
  const notifiedRef = useRef<Set<string>>(new Set());

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

    const showNotification = (title: string, body: string) => {
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
