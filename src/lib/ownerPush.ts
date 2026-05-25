// src/lib/ownerPush.ts
// Web Push helpers for store-owner devices.
//
// Usage: import { subscribePush, unsubscribePush, getPushPermission, isPushSupported } from "@/lib/ownerPush";

import { supabase } from "@/integrations/supabase/client";

// Generated VAPID public key (matches edge function VAPID_PUBLIC_KEY).
// Safe to expose publicly — that is its purpose.
const VAPID_PUBLIC_KEY =
  "BJu3Q6iOP6xBdN5sFE2ibfcIROFY4f7pie8pCkFEqztk7TS2fMS23sxLOsrhK91OGmqkkkn9ap812BF2y3AIAe4";

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

    // serviceWorker.ready hangs forever if SW never activates — cap at 10s
    const reg = await withTimeout(
      navigator.serviceWorker.ready,
      10000,
      "service_worker_not_ready",
    );

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await withTimeout(
        reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
        }),
        15000,
        "push_subscribe_timeout",
      );
    }

    const p256dh = arrayBufferToBase64(sub.getKey("p256dh"));
    const authKey = arrayBufferToBase64(sub.getKey("auth"));

    // Delete any prior row for this endpoint, then insert fresh.
    // Avoids onConflict ambiguity between (store_id,endpoint) unique and user-only rows.
    await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);

    const { error: insErr } = await supabase.from("push_subscriptions").insert({
      user_id: user.id,
      store_id: storeId || null,
      endpoint: sub.endpoint,
      p256dh,
      auth: authKey,
      device_label: getDeviceLabel(),
      user_agent: navigator.userAgent.slice(0, 500),
      enabled: true,
    });
    if (insErr) return { ok: false, reason: insErr.message };

    return { ok: true };
  } catch (e: any) {
    return { ok: false, reason: e?.message || "unknown_error" };
  }
}

export async function unsubscribePush(): Promise<{ ok: boolean }> {
  if (!isPushSupported()) return { ok: false };
  try {
    const reg = await navigator.serviceWorker.ready;
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
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch {
    return false;
  }
}

/**
 * Send a test notification to the currently-logged-in user's devices.
 */
export async function sendTestPush(): Promise<{ ok: boolean; message: string }> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return { ok: false, message: "Not signed in" };

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
  return { ok: true, message: `Sent to ${(data as any)?.sent || 0} device(s)` };
}

/**
 * Play a foreground "cha-ching" sound using Web Audio (no asset file needed).
 * Called when SW posts a PUSH_RECEIVED message.
 */
export function playChaChing(): void {
  try {
    const Ctx =
      (window as any).AudioContext || (window as any).webkitAudioContext;
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
