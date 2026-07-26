/**
 * Durable Meta Pixel Purchase outbox.
 *
 * Why this exists
 * ---------------
 * Browser-side Purchase used to fire exactly once, inline, on the checkout
 * success screen, deduped through `sessionStorage`. Three real-world paths
 * silently dropped it:
 *
 *  1. The shopper leaves for a UPI app; the gateway webhook confirms the
 *     order while the tab is dead / never restored. No browser → no Purchase.
 *     (Measured gap: ~10% of confirmed orders had no client purchase event.)
 *  2. Instagram / Facebook in-app browsers wipe `sessionStorage` when the tab
 *     is backgrounded, so the dedupe key vanished and a remount could fire a
 *     SECOND Purchase — with a freshly generated event_id, which no longer
 *     matched the id stored on the order row, so Meta could not dedupe it
 *     against the server event. Inflated, mis-attributed purchases.
 *  3. `fbevents.js` is lazy-loaded. If the page unloads before the SDK lands,
 *     everything sitting in the `fbq` shim queue is lost.
 *
 * This module fixes all three:
 *  - `stagePendingPurchase()` records the pending purchase in localStorage the
 *    moment the shopper leaves to pay.
 *  - `flushPendingPurchases()` runs on every storefront page load: for each
 *    staged record it asks the backend whether the order actually got
 *    confirmed and, if so, fires the Purchase pixel then — even days later.
 *  - `firePixelPurchase()` dedupes on localStorage (survives IABB wipes) and
 *    force-loads `fbevents.js` immediately instead of waiting for idle.
 */
import { supabase } from "@/integrations/supabase/client";

export interface PendingPurchase {
  storeId: string;
  orderId: string;
  eventId: string;
  value: number;
  currency: string;
  payload: Record<string, any>;
  /**
   * Advanced Matching snapshot (plaintext; Meta hashes it in the browser).
   * A replayed Purchase happens on a later pageload where the checkout form
   * state is long gone — without this the replay would be an anonymous event
   * with no phone/name/city, i.e. exactly the low-match signal we're fixing.
   */
  user?: Record<string, string>;
  at: number;
}

const PENDING_KEY = (storeId: string) => `sb_px_pending:${storeId}`;
const SENT_KEY = (orderId: string) => `sb_px_purchase_sent:${orderId}`;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_AGE_MS = 20_000; // give the in-page success path a chance first

function isNonProductionHost(): boolean {
  if (typeof window === "undefined") return true;
  const h = window.location.hostname;
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h.endsWith(".lovableproject.com") ||
    h.endsWith(".lovable.app") ||
    h.endsWith(".lovable.dev") ||
    h.endsWith(".sandbox.lovable.dev")
  );
}

/**
 * Deterministic Purchase event_id derived from the checkout token.
 * The same token is reused across remounts / IABB reloads, so the browser
 * event and the server (CAPI) event always carry an identical id and Meta
 * deduplicates them instead of counting two purchases.
 * Must satisfy place-order's /^[A-Za-z0-9._:-]{8,120}$/.
 */
export function purchaseEventIdFor(checkoutToken: string): string {
  const clean = String(checkoutToken || "").replace(/[^A-Za-z0-9._:-]/g, "");
  return `pur-${clean}`.slice(0, 120);
}

/** Force `fbevents.js` to load right now (normally deferred to idle). */
export function ensureFbSdkNow(): void {
  if (typeof document === "undefined") return;
  try {
    if (document.getElementById("fb-pixel-script")) return;
    const s = document.createElement("script");
    s.id = "fb-pixel-script";
    s.async = true;
    s.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(s);
  } catch {
    /* noop */
  }
}

function markSent(orderId: string) {
  try {
    localStorage.setItem(SENT_KEY(orderId), "1");
  } catch {
    /* noop */
  }
}

export function purchaseAlreadySent(orderId: string): boolean {
  try {
    return localStorage.getItem(SENT_KEY(orderId)) === "1";
  } catch {
    return false;
  }
}

/**
 * Fire the browser Purchase pixel exactly once per order.
 * Returns true when the event was handed to fbq on this call.
 */
export function firePixelPurchase(args: {
  orderId: string;
  eventId: string;
  value: number;
  currency: string;
  payload?: Record<string, any>;
}): boolean {
  if (typeof window === "undefined") return false;
  if (isNonProductionHost()) return false;
  if (!args.orderId || purchaseAlreadySent(args.orderId)) return false;
  const fbq = (window as any).fbq;
  if (typeof fbq !== "function") return false;

  // Load the SDK immediately — a queued event is only delivered once
  // fbevents.js executes, and the shopper may close the tab any second.
  ensureFbSdkNow();

  const value = Number(args.value);
  const currency = /^[A-Za-z]{3}$/.test(String(args.currency || ""))
    ? String(args.currency).toUpperCase()
    : "INR";

  try {
    fbq(
      "track",
      "Purchase",
      {
        ...(args.payload || {}),
        content_type: "product",
        value: Number.isFinite(value) && value >= 0 ? value : 0,
        currency,
      },
      { eventID: args.eventId },
    );
  } catch {
    return false;
  }
  markSent(args.orderId);
  clearPendingPurchase(args.orderId);
  return true;
}

function readPending(storeId: string): PendingPurchase[] {
  try {
    const raw = localStorage.getItem(PENDING_KEY(storeId));
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writePending(storeId: string, rows: PendingPurchase[]) {
  try {
    if (!rows.length) localStorage.removeItem(PENDING_KEY(storeId));
    else localStorage.setItem(PENDING_KEY(storeId), JSON.stringify(rows.slice(-5)));
  } catch {
    /* noop */
  }
}

/**
 * Record a purchase that is *about* to happen (order row created, shopper
 * heading to the payment app). Safe to call repeatedly for the same order.
 */
export function stagePendingPurchase(rec: PendingPurchase): void {
  if (!rec?.storeId || !rec?.orderId) return;
  if (purchaseAlreadySent(rec.orderId)) return;
  const rows = readPending(rec.storeId).filter((r) => r.orderId !== rec.orderId);
  rows.push({ ...rec, at: Date.now() });
  writePending(rec.storeId, rows);
}

export function clearPendingPurchase(orderId: string): void {
  if (typeof window === "undefined") return;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith("sb_px_pending:")) continue;
      const rows = JSON.parse(localStorage.getItem(k) || "[]");
      if (!Array.isArray(rows)) continue;
      const next = rows.filter((r: PendingPurchase) => r?.orderId !== orderId);
      if (next.length !== rows.length) {
        if (next.length) localStorage.setItem(k, JSON.stringify(next));
        else localStorage.removeItem(k);
      }
    }
  } catch {
    /* noop */
  }
}

const CONFIRMED_STATUSES = new Set([
  "confirmed",
  "partially_paid",
  "processing",
  "shipped",
  "delivered",
  "completed",
]);

/**
 * Replay staged purchases whose order is now confirmed. Called on storefront
 * page load (idle). This is what guarantees pixel-only Purchase coverage for
 * shoppers whose tab died during the UPI hand-off.
 */
export async function flushPendingPurchases(storeId: string): Promise<void> {
  if (typeof window === "undefined" || !storeId) return;
  if (isNonProductionHost()) return;
  const rows = readPending(storeId);
  if (!rows.length) return;

  const now = Date.now();
  const keep: PendingPurchase[] = [];

  for (const row of rows) {
    if (!row?.orderId || now - (row.at || 0) > MAX_AGE_MS) continue;
    if (purchaseAlreadySent(row.orderId)) continue;
    if (now - (row.at || 0) < MIN_AGE_MS) {
      keep.push(row);
      continue;
    }
    try {
      const { data } = await supabase.rpc("get_order_tracking", { _query: row.orderId });
      const res = data as any;
      const status = String(res?.order?.status || "").toLowerCase();
      if (!res?.found || status === "cancelled" || status === "failed") continue; // drop
      if (!CONFIRMED_STATUSES.has(status)) {
        keep.push(row); // still pending — check again next visit
        continue;
      }
      const serverTotal = Number(res?.order?.total);
      firePixelPurchase({
        orderId: row.orderId,
        eventId: row.eventId,
        value: Number.isFinite(serverTotal) && serverTotal > 0 ? serverTotal : row.value,
        currency: res?.order?.currency || row.currency,
        payload: row.payload,
      });
    } catch {
      keep.push(row);
    }
  }

  writePending(storeId, keep);
}
