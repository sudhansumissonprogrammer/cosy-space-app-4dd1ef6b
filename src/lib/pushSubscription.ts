/**
 * Helper to register the push service worker and subscribe the user
 * to web push notifications for a specific store.
 */

type RegisterPushSubscriptionOptions = {
  forceRefresh?: boolean;
};

const SW_PATH = "/sw-push.js";
const PUSH_REFRESH_INTERVAL_MS = 12 * 60 * 60 * 1000;
const PUSH_REFRESH_KEY_PREFIX = "push-subscription-refresh";

export function canUsePushNotifications(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

export function isStandaloneMode(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function getWebPushUrl(path = ""): string {
  return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/web-push${path}`;
}

function getRefreshStorageKey(storeId: string): string {
  return `${PUSH_REFRESH_KEY_PREFIX}:${storeId}`;
}

function shouldForceRefresh(storeId: string): boolean {
  const lastRefresh = Number(localStorage.getItem(getRefreshStorageKey(storeId)) ?? 0);
  return !lastRefresh || Date.now() - lastRefresh > PUSH_REFRESH_INTERVAL_MS;
}

function markRefresh(storeId: string): void {
  localStorage.setItem(getRefreshStorageKey(storeId), String(Date.now()));
}

async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  const registration = await navigator.serviceWorker.register(SW_PATH, {
    scope: "/",
  });

  await registration.update().catch(() => undefined);
  await navigator.serviceWorker.ready;

  return registration;
}

export async function getVapidPublicKey(): Promise<string | null> {
  try {
    const res = await fetch(getWebPushUrl("/vapid-key"));
    if (!res.ok) {
      console.log("[push] Failed to get VAPID key:", res.status);
      return null;
    }

    const data = await res.json();
    return data.vapidPublicKey || null;
  } catch (err) {
    console.error("[push] Error getting VAPID key:", err);
    return null;
  }
}

export async function registerPushSubscription(
  storeId: string,
  options: RegisterPushSubscriptionOptions = {}
): Promise<boolean> {
  try {
    if (!canUsePushNotifications()) {
      console.log("[push] Push not supported in this browser");
      return false;
    }

    if (Notification.permission !== "granted") {
      console.log("[push] Notification permission not granted");
      return false;
    }

    const vapidKey = await getVapidPublicKey();
    if (!vapidKey) {
      console.log("[push] No VAPID key configured");
      return false;
    }

    const registration = await getServiceWorkerRegistration();
    const forceRefresh = options.forceRefresh ?? shouldForceRefresh(storeId);

    let subscription = await registration.pushManager.getSubscription();

    if (subscription && forceRefresh) {
      console.log("[push] Refreshing existing subscription...");
      try {
        await subscription.unsubscribe();
      } catch (err) {
        console.warn("[push] Failed to unsubscribe existing subscription:", err);
      }
      subscription = await registration.pushManager.getSubscription();
    }

    if (!subscription) {
      console.log("[push] Creating new subscription...");
      const applicationServerKey = Uint8Array.from(urlBase64ToUint8Array(vapidKey));
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
      console.log("[push] Subscription created");
    } else {
      console.log("[push] Reusing existing subscription");
    }

    const subJson = subscription.toJSON();
    if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) {
      console.error("[push] Subscription is missing required keys");
      return false;
    }

    const res = await fetch(getWebPushUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "subscribe",
        store_id: storeId,
        subscription: subJson,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[push] Subscription registration failed:", res.status, text);
      return false;
    }

    markRefresh(storeId);
    console.log("[push] Subscription registered successfully");
    return true;
  } catch (err) {
    console.error("[push] Push subscription failed:", err);
    return false;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}
