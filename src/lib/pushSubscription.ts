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
    if (!res.ok) return null;
    const data = await res.json();
    return data.vapidPublicKey || null;
  } catch {
    return null;
  }
}

export async function registerPushSubscription(storeId: string): Promise<boolean> {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      console.log("Push not supported");
      return false;
    }

    // Get VAPID public key
    const vapidKey = await getVapidPublicKey();
    if (!vapidKey) {
      console.log("No VAPID key configured");
      return false;
    }

    // Register service worker
    const registration = await navigator.serviceWorker.register(SW_PATH, {
      scope: "/",
    });

    // Wait for SW to be ready
    await navigator.serviceWorker.ready;

    // Check existing subscription
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      // Convert VAPID key
      const applicationServerKey = urlBase64ToUint8Array(vapidKey);

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
    }

    // Send subscription to server
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const res = await fetch(
      `https://${projectId}.supabase.co/functions/v1/web-push`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "subscribe",
          store_id: storeId,
          subscription: subscription.toJSON(),
        }),
      }
    );

    return res.ok;
  } catch (err) {
    console.error("Push subscription failed:", err);
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
