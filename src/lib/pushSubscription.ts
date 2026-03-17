/**
 * Helper to register the push service worker and subscribe the user
 * to web push notifications for a specific store.
 */

const SW_PATH = "/sw-push.js";

export async function getVapidPublicKey(): Promise<string | null> {
  try {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const res = await fetch(
      `https://${projectId}.supabase.co/functions/v1/web-push/vapid-key`
    );
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

export async function registerPushSubscription(storeId: string): Promise<boolean> {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      console.log("[push] Push not supported in this browser");
      return false;
    }

    // Get VAPID public key first
    const vapidKey = await getVapidPublicKey();
    if (!vapidKey) {
      console.log("[push] No VAPID key configured");
      return false;
    }

    console.log("[push] VAPID key obtained, registering SW...");

    // Register service worker
    const registration = await navigator.serviceWorker.register(SW_PATH, {
      scope: "/",
    });

    // Wait for SW to be ready
    await navigator.serviceWorker.ready;
    console.log("[push] Service worker ready");

    // Check existing subscription
    let subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      console.log("[push] Existing subscription found");
    } else {
      console.log("[push] Creating new subscription...");
      // Convert VAPID key to Uint8Array
      const applicationServerKey = urlBase64ToUint8Array(vapidKey);

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
      console.log("[push] Subscription created");
    }

    // Send subscription to server
    const subJson = subscription.toJSON();
    console.log("[push] Sending subscription to server...");

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const res = await fetch(
      `https://${projectId}.supabase.co/functions/v1/web-push`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "subscribe",
          store_id: storeId,
          subscription: subJson,
        }),
      }
    );

    if (res.ok) {
      console.log("[push] Subscription registered successfully");
    } else {
      const text = await res.text();
      console.error("[push] Subscription registration failed:", res.status, text);
    }

    return res.ok;
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
