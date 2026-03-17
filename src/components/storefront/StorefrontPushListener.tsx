import { useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bell } from "lucide-react";
import {
  canUsePushNotifications,
  isStandaloneMode,
  registerPushSubscription,
} from "@/lib/pushSubscription";

const ENABLE_PUSH_TOAST_ID = "enable-store-push";
const REGISTER_THROTTLE_MS = 60 * 1000;

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
  const registerInFlightRef = useRef(false);
  const lastRegisterAtRef = useRef(0);
  const permissionPromptOpenRef = useRef(false);

  const syncPushSubscription = useCallback(
    async (forceRefresh = false) => {
      if (!storeId || !canUsePushNotifications() || Notification.permission !== "granted") {
        return false;
      }

      const now = Date.now();
      if (registerInFlightRef.current) return false;
      if (!forceRefresh && now - lastRegisterAtRef.current < REGISTER_THROTTLE_MS) {
        return false;
      }

      registerInFlightRef.current = true;
      lastRegisterAtRef.current = now;

      try {
        return await registerPushSubscription(storeId, { forceRefresh });
      } finally {
        registerInFlightRef.current = false;
      }
    },
    [storeId]
  );

  const promptForPushPermission = useCallback(() => {
    if (
      !storeId ||
      !canUsePushNotifications() ||
      !isStandaloneMode() ||
      Notification.permission !== "default" ||
      permissionPromptOpenRef.current
    ) {
      return;
    }

    permissionPromptOpenRef.current = true;

    toast("Enable notifications", {
      id: ENABLE_PUSH_TOAST_ID,
      duration: 12000,
      description: "Turn on notifications to receive store alerts on your phone.",
      action: {
        label: "Enable",
        onClick: async () => {
          const permission = await Notification.requestPermission();
          permissionPromptOpenRef.current = false;

          if (permission === "granted") {
            toast.dismiss(ENABLE_PUSH_TOAST_ID);
            await syncPushSubscription(true);
            toast.success("Notifications enabled");
            return;
          }

          if (permission === "denied") {
            toast.error("Notifications are blocked in your browser settings");
          }
        },
      },
    });

    window.setTimeout(() => {
      permissionPromptOpenRef.current = false;
    }, 12500);
  }, [storeId, syncPushSubscription]);

  useEffect(() => {
    if (!storeId) return;

    if (canUsePushNotifications() && Notification.permission === "granted") {
      void syncPushSubscription(true);
    } else {
      promptForPushPermission();
    }

    const handleResume = () => {
      if (canUsePushNotifications() && Notification.permission === "granted") {
        void syncPushSubscription();
      } else {
        promptForPushPermission();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        handleResume();
      }
    };

    const handleServiceWorkerMessage = (event: MessageEvent<{ type?: string }>) => {
      if (event.data?.type === "push-subscription-change") {
        void syncPushSubscription(true);
      }
    };

    window.addEventListener("focus", handleResume);
    window.addEventListener("pageshow", handleResume);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    navigator.serviceWorker?.addEventListener("message", handleServiceWorkerMessage);

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
      toast.dismiss(ENABLE_PUSH_TOAST_ID);
      window.removeEventListener("focus", handleResume);
      window.removeEventListener("pageshow", handleResume);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      navigator.serviceWorker?.removeEventListener("message", handleServiceWorkerMessage);
      supabase.removeChannel(channel);
    };
  }, [promptForPushPermission, storeId, syncPushSubscription]);

  return null;
}
