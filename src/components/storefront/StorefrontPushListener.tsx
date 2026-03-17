import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bell } from "lucide-react";
import { registerPushSubscription } from "@/lib/pushSubscription";

function playChime() {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 440;
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
    setTimeout(() => ctx.close(), 400);
  } catch {
    // Audio not available
  }
}

export default function StorefrontPushListener({ storeId }: { storeId: string }) {
  const notifiedRef = useRef<Set<string>>(new Set());
  const pushRegistered = useRef(false);

  useEffect(() => {
    if (!storeId) return;

    // Request notification permission and register push subscription
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted" && !pushRegistered.current) {
          pushRegistered.current = true;
          registerPushSubscription(storeId);
        }
      });
    } else if ("Notification" in window && Notification.permission === "granted" && !pushRegistered.current) {
      pushRegistered.current = true;
      registerPushSubscription(storeId);
    }

    const channel = supabase
      .channel(`store-notifs-${storeId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "store_notifications",
          filter: `store_id=eq.${storeId}`,
        },
        (payload) => {
          const notif = payload.new as any;
          if (notifiedRef.current.has(notif.id)) return;
          notifiedRef.current.add(notif.id);

          playChime();

          toast(notif.title, {
            description: notif.body,
            duration: 10000,
            icon: <Bell className="h-5 w-5 text-primary" />,
            action: notif.link_url
              ? { label: "View", onClick: () => window.open(notif.link_url, "_self") }
              : undefined,
          });

          // Browser notification (fallback when SW push doesn't fire)
          if ("Notification" in window && Notification.permission === "granted") {
            const n = new Notification(notif.title, {
              body: notif.body,
              icon: "/pwa-192x192.png",
            });
            if (notif.link_url) {
              n.onclick = () => {
                window.focus();
                window.open(notif.link_url, "_self");
              };
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [storeId]);

  return null;
}
