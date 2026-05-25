// src/lib/ownerPush.ts
// Web Push helpers for store-owner devices.
//
// Usage: import { subscribePush, unsubscribePush, getPushPermission, isPushSupported } from "@/lib/ownerPush";

import { supabase } from "@/integrations/supabase/client";

interface VapidPublicResponse {
  key?: string;
}

interface PushSendResponse {
  sent?: number;
}

// VAPID public key is fetched from the server so client + server can never
// drift. (Hardcoded fallback only used if the fetch fails.)
const VAPID_PUBLIC_KEY_FALLBACK =
  "BJu3Q6iOP6xBdN5sFE2ibfcIROFY4f7pie8pCkFEqztk7TS2fMS23sxLOsrhK91OGmqkkkn9ap812BF2y3AIAe4";

let _vapidKeyCache: string | null = null;
async function getServerVapidKey(): Promise<string> {
  if (_vapidKeyCache) return _vapidKeyCache;
  try {
    const { data } = await supabase.functions.invoke("get-vapid-public", {
      method: "GET",
    });
    const key = (data as VapidPublicResponse | null)?.key;
    if (key && typeof key === "string" && key.length > 50) {
      _vapidKeyCache = key;
      return key;
    }
  } catch {
    // fall through
  }
  return VAPID_PUBLIC_KEY_FALLBACK;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function getPushPermission(): NotificationPermission {
  if (!isPushSupported()) return "denied";
  return Notification.permission;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
  return arr;
}

function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return "";
  const bytes = new Uint8Array(buffer);
  let bin = "";
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function getDeviceLabel(): string {
  const ua = navigator.userAgent;
  let browser = "Browser";
  if (/Edg/.test(ua)) browser = "Edge";
  else if (/Chrome/.test(ua)) browser = "Chrome";
  else if (/Firefox/.test(ua)) browser = "Firefox";
  else if (/Safari/.test(ua)) browser = "Safari";
  let os = "Device";
  if (/Android/.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/.test(ua)) os = "iOS";
  else if (/Mac/.test(ua)) os = "Mac";
  else if (/Windows/.test(ua)) os = "Windows";
  else if (/Linux/.test(ua)) os = "Linux";
  return `${browser} on ${os}`;
}

async function saveSubscriptionToDatabase(
  userId: string,
  storeId: string | undefined,
  sub: PushSubscription,
): Promise<{ ok: boolean; reason?: string }> {
  const p256dh = arrayBufferToBase64(sub.getKey("p256dh"));
  const authKey = arrayBufferToBase64(sub.getKey("auth"));

  // Remove stale rows for this browser endpoint that may have been created
  // before owner-level notifications existed, then save a fresh owner row.
  await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);

  const { error } = await supabase.from("push_subscriptions").insert({
    user_id: userId,
    store_id: storeId || null,
    endpoint: sub.endpoint,
    p256dh,
    auth: authKey,
    device_label: getDeviceLabel(),
    user_agent: navigator.userAgent.slice(0, 500),
    enabled: true,
    last_used_at: new Date().toISOString(),
  });

  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}

async function getPushRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing?.active?.scriptURL.includes("/sw-push.js")) return existing;

  if (existing) {
    await existing.unregister().catch(() => false);
  }

  const registration = await navigator.serviceWorker.register("/sw-push.js", {
    scope: "/",
    updateViaCache: "none",
  });
  await registration.update().catch(() => undefined);

  if (registration.active) return registration;

  return navigator.serviceWorker.ready;
}

/** Race a promise against a timeout (ms). */
function withTimeout<T>(p: Promise<T>, ms: number, reason: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(reason)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); })
     .catch((e) => { clearTimeout(t); reject(e); });
  });
}

/**
 * Subscribe the current device to push notifications.
 * Requires the user to be authenticated.
 */
export async function subscribePush(
  storeId?: string,
): Promise<{ ok: boolean; reason?: string }> {
  if (!isPushSupported()) return { ok: false, reason: "unsupported" };

  // Lovable preview iframe blocks SW push — must be on real domain
  try {
    if (window.self !== window.top) return { ok: false, reason: "iframe_blocked" };
  } catch {
    return { ok: false, reason: "iframe_blocked" };
  }

  try {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return { ok: false, reason: "not_authenticated" };

    const perm = await withTimeout(
      Promise.resolve(Notification.requestPermission()),
      20000,
      "permission_timeout",
    );
    if (perm !== "granted") return { ok: false, reason: "permission_denied" };

    // Register a push-only worker on demand; it has no fetch/cache behavior.
    const reg = await withTimeout(
      getPushRegistration(),
      10000,
      "service_worker_not_ready",
    );

    const vapidKey = await getServerVapidKey();
    const vapidBytes = urlBase64ToUint8Array(vapidKey);

    let sub = await reg.pushManager.getSubscription();
    if (sub) {
      // If the cached subscription used a different VAPID key, drop it so we
      // re-subscribe with the current one. Otherwise FCM will reject every push.
      const existingKey = sub.options?.applicationServerKey
        ? new Uint8Array(sub.options.applicationServerKey as ArrayBuffer)
        : null;
      const matches =
        existingKey &&
        existingKey.length === vapidBytes.length &&
        existingKey.every((b, i) => b === vapidBytes[i]);
      if (!matches) {
        await sub.unsubscribe().catch(() => false);
        sub = null;
      }
    }
    if (!sub) {
      sub = await withTimeout(
        reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidBytes as BufferSource,
        }),
        15000,
        "push_subscribe_timeout",
      );
    }

    const saved = await saveSubscriptionToDatabase(user.id, storeId, sub);
    if (!saved.ok) return saved;

    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, reason: e instanceof Error ? e.message : "unknown_error" };
  }
}

export async function syncExistingPushSubscription(
  storeId?: string,
): Promise<{ ok: boolean; reason?: string; endpoint?: string }> {
  if (!isPushSupported()) return { ok: false, reason: "unsupported" };
  try {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return { ok: false, reason: "not_authenticated" };
    if (Notification.permission !== "granted") return { ok: false, reason: "permission_denied" };

    const reg = await withTimeout(getPushRegistration(), 10000, "service_worker_not_ready");
    let sub = await reg.pushManager.getSubscription();
    if (!sub) return { ok: false, reason: "no_browser_subscription" };

    const vapidKey = await getServerVapidKey();
    const vapidBytes = urlBase64ToUint8Array(vapidKey);
    const existingKey = sub.options?.applicationServerKey
      ? new Uint8Array(sub.options.applicationServerKey as ArrayBuffer)
      : null;
    const matches =
      existingKey &&
      existingKey.length === vapidBytes.length &&
      existingKey.every((b, i) => b === vapidBytes[i]);
    if (!matches) {
      await sub.unsubscribe().catch(() => false);
      sub = await withTimeout(
        reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidBytes as BufferSource,
        }),
        15000,
        "push_subscribe_timeout",
      );
    }

    const saved = await saveSubscriptionToDatabase(user.id, storeId, sub);
    if (!saved.ok) return saved;
    return { ok: true, endpoint: sub.endpoint };
  } catch (e: unknown) {
    return { ok: false, reason: e instanceof Error ? e.message : "unknown_error" };
  }
}

export async function unsubscribePush(): Promise<{ ok: boolean }> {
  if (!isPushSupported()) return { ok: false };
  try {
    const reg = await getPushRegistration();
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      const { data: auth } = await supabase.auth.getUser();
      if (auth?.user) {
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("user_id", auth.user.id)
          .eq("endpoint", endpoint);
      }
    }
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function isCurrentDeviceSubscribed(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    if (!reg) return false;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch {
    return false;
  }
}

/**
 * Send a test notification to the currently-logged-in user's devices.
 */
export async function sendTestPush(storeId?: string): Promise<{ ok: boolean; message: string }> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return { ok: false, message: "Not signed in" };

  // If Chrome kept the browser subscription but the DB row was lost/stale,
  // re-save it before sending. This fixes “Sent to 0 devices”.
  const synced = await syncExistingPushSubscription(storeId);
  if (!synced.ok && synced.reason === "no_browser_subscription") {
    const created = await subscribePush(storeId);
    if (!created.ok) return { ok: false, message: created.reason || "Could not enable this device" };
  } else if (!synced.ok && synced.reason !== "permission_denied") {
    return { ok: false, message: synced.reason || "Could not sync this device" };
  }

  const { data, error } = await supabase.functions.invoke("send-owner-push", {
    body: {
      user_id: auth.user.id,
      title: "🎉 Test Notification",
      body: "Push notifications are working! You'll get instant alerts for new orders.",
      url: "/dashboard",
      tag: "test",
    },
  });
  if (error) return { ok: false, message: error.message };
  const sent = (data as PushSendResponse | null)?.sent || 0;
  return {
    ok: sent > 0,
    message: sent > 0 ? `Sent to ${sent} device(s)` : "No saved devices found. Tap Disable, then Enable again.",
  };
}

/**
 * Play a foreground "cha-ching" sound using Web Audio (no asset file needed).
 * Called when SW posts a PUSH_RECEIVED message.
 */
export function playChaChing(): void {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    // Two-note bell: high A then higher E (cash-register feel)
    const notes = [
      { freq: 880, start: 0, dur: 0.15 },
      { freq: 1320, start: 0.12, dur: 0.4 },
    ];
    notes.forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + start);
      gain.gain.exponentialRampToValueAtTime(0.3, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.05);
    });
    setTimeout(() => ctx.close().catch(() => {}), 800);
  } catch {
    /* noop */
  }
}

/**
 * Wire up an in-page listener for SW push messages (plays cha-ching when foreground).
 * Call once on dashboard mount.
 */
export function installForegroundPushListener(): () => void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return () => {};
  }
  const handler = (e: MessageEvent) => {
    if (e.data?.type === "PUSH_RECEIVED") {
      playChaChing();
    }
  };
  navigator.serviceWorker.addEventListener("message", handler);
  return () => navigator.serviceWorker.removeEventListener("message", handler);
}
