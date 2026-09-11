// Shared helper: fires Meta CAPI "Purchase" event server-to-server.
//
// Used by COD (place-order), Razorpay (razorpay-verify), and Cashfree (cashfree-webhook).
// Idempotent — uses `orders.meta_purchase_fired_at` as a DB stamp so the same order
// never reports a Purchase twice (across webhook retries, refreshes, multi-gateway).
//
// Safety:
//  - Never throws — failures are logged but don't break the order flow.
//  - Skips silently if the store has no Pixel/access token configured.
//  - Forwards the buyer's REAL IP (stored on the order row at place-order time),
//    NEVER the edge runtime IP. This is the change that protects ad accounts.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

import { META_GRAPH_URL } from "./metaGraph.ts";

// Tier-1 #3: cache stores that have NO pixel/access_token so we skip the
// `stores` SELECT entirely for the 95% of stores without Meta configured.
// In-memory only; per-isolate. TTL 5 min — short enough that a merchant who
// just configured their pixel sees it work within minutes.
const NO_PIXEL_TTL_MS = 5 * 60 * 1000;
const _noPixelCache = new Map<string, number>(); // store_id → expiresAt

// Normalization helpers per Meta CAPI spec — must match the rules in meta-capi/index.ts.
// Wrong normalization = our hash ≠ Meta's hash = no match = degraded EMQ score.
const normEmail = (v: string) => v.trim().toLowerCase();
const normName = (v: string) => v.trim().toLowerCase().replace(/[^a-zà-ÿ\u0080-\uffff]/g, "");
const normCityState = (v: string) => v.trim().toLowerCase().replace(/[^a-z]/g, "");
const normZip = (v: string) => v.trim().toLowerCase().replace(/\s+/g, "");
const normCountry = (v: string) => v.trim().toLowerCase().slice(0, 2);
/**
 * Rebuild the browser's deterministic Purchase event_id from the checkout
 * token. Mirrors `purchaseEventIdFor()` in src/lib/pixelOutbox.ts exactly.
 * Falls back to the order id only when there is no token at all.
 */
const derivedEventId = (order: { id: string; checkout_token?: string | null }) => {
  const t = String(order.checkout_token || "").replace(/[^A-Za-z0-9._:-]/g, "");
  return t.length >= 4 ? `pur-${t}`.slice(0, 120) : order.id;
};
const FBP_RX = /^fb\.[12]\.\d{10,16}\.\d+$/;
const FBC_RX = /^fb\.[12]\.\d{10,16}\.[A-Za-z0-9_-]+$/;
const sanitizeFb = (v: unknown, rx: RegExp): string | undefined =>
  typeof v === "string" && v.length <= 256 && rx.test(v) ? v : undefined;

const _purchaseLocks = new Map<string, number>();
const PURCHASE_LOCK_TTL_MS = 30_000;
function acquirePurchaseLock(orderId: string): boolean {
  const now = Date.now();
  const lockedUntil = _purchaseLocks.get(orderId) || 0;
  if (lockedUntil > now) return false;
  _purchaseLocks.set(orderId, now + PURCHASE_LOCK_TTL_MS);
  if (_purchaseLocks.size > 500) {
    for (const [id, until] of _purchaseLocks) {
      if (until <= now) _purchaseLocks.delete(id);
    }
  }
  return true;
}
function releasePurchaseLock(orderId: string) {
  _purchaseLocks.delete(orderId);
}

function isPrivateIp(ip: string | null | undefined): boolean {
  if (!ip) return true;
  const v = ip.trim().toLowerCase();
  return /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd)/.test(v);
}

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface FirePurchaseOpts {
  /** Source: "cod" | "razorpay" | "cashfree" — for logging only. */
  source: string;
  /** Optional override for event_source_url if not stored on the order. */
  eventSourceUrl?: string;
}


export async function firePurchaseCapi(
  supabase: SupabaseClient,
  orderId: string,
  opts: FirePurchaseOpts,
): Promise<{ ok: boolean; reason?: string }> {
  if (!acquirePurchaseLock(orderId)) {
    return { ok: true, reason: "in_flight" };
  }
  try {
    // 1. Idempotency check + load order with all buyer fields.
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select(
        "id, created_at, store_id, status, total, advance_paid, currency, customer_phone, customer_name, city, state, pincode, " +
        "storefront_customer_id, buyer_ip, buyer_user_agent, buyer_fbc, buyer_fbp, buyer_external_id, buyer_email, " +
        "payment_verified_at, checkout_token, meta_event_id, meta_event_source_url, meta_purchase_fired_at",
      )
      .eq("id", orderId)
      .maybeSingle();

    if (orderErr || !order) {
      console.warn(`[capi:${opts.source}] order not found`, orderId, orderErr);
      return { ok: false, reason: "order_not_found" };
    }

    // 🚫 Never report Purchase for orders that aren't actually paid/confirmed.
    // v8.70.0: tightened to the strict "money has reached us" set per merchant
    // request. Any other status (pending, cancelled, refunded, failed, processing,
    // shipped) is treated as not-yet-revenue — Meta must NEVER count it.
    // - pending / cancelled / refunded / failed → no money, would be phantom revenue
    // - processing / shipped → ambiguous (some flows mark these pre-payment)
    // Once an order DOES enter a paid state, we fire EXACTLY ONCE via the
    // meta_purchase_fired_at stamp below; subsequent status changes
    // (confirmed → shipped → delivered) never re-fire.
    const status = String(order.status || "").toLowerCase();
    const PAID_STATUSES = new Set([
      "paid", "confirmed", "partially_paid", "delivered", "completed",
    ]);
    if (!PAID_STATUSES.has(status)) {
      console.log(`[capi:${opts.source}] skip — status=${status}`, orderId);
      return { ok: true, reason: `skipped_status_${status}` };
    }

    if (order.meta_purchase_fired_at) {
      // Already fired — idempotent no-op.
      return { ok: true, reason: "already_fired" };
    }




    // 🚫 Skip MANUAL / admin-created orders (Shopify-style behaviour).
    // A real storefront purchase always carries at least one browser signal:
    //   buyer_user_agent, buyer_fbp, buyer_fbc, or meta_event_id.
    // Manual orders entered from the admin dashboard have none of these →
    // sending them tanks Event Match Quality, gives no attribution, and risks
    // double-counting if the same buyer also placed online.
    const hasBrowserSignals =
      !!order.buyer_user_agent && (!!order.buyer_fbp || !!order.buyer_fbc || !!order.meta_event_id);
    if (!hasBrowserSignals) {
      // Stamp so we don't re-evaluate on every status change.
      await supabase
        .from("orders")
        .update({ meta_purchase_fired_at: new Date().toISOString() })
        .eq("id", orderId)
        .is("meta_purchase_fired_at", null);
      console.log(`[capi:${opts.source}] skip — manual order (no browser signals)`, orderId);
      return { ok: true, reason: "manual_order" };
    }

    // Fast path: this store was recently observed to have no pixel — skip DB.
    const cachedExp = _noPixelCache.get(order.store_id);
    if (cachedExp && cachedExp > Date.now()) {
      await supabase
        .from("orders")
        .update({ meta_purchase_fired_at: new Date().toISOString() })
        .eq("id", orderId)
        .is("meta_purchase_fired_at", null);
      return { ok: true, reason: "meta_not_configured_cached" };
    }

    // 2. Load store pixel config.
    const { data: store } = await supabase
      .from("stores")
      .select("facebook_pixel_id, meta_access_token, slug, custom_domain, capi_disabled")
      .eq("id", order.store_id)
      .single();

    if (!store?.facebook_pixel_id || !store?.meta_access_token) {
      // No Pixel configured — stamp anyway so we don't keep retrying.
      _noPixelCache.set(order.store_id, Date.now() + NO_PIXEL_TTL_MS);
      await supabase
        .from("orders")
        .update({ meta_purchase_fired_at: new Date().toISOString() })
        .eq("id", orderId)
        .is("meta_purchase_fired_at", null);
      return { ok: true, reason: "meta_not_configured" };
    }

    // Per-store CAPI kill-switch. Stamp the order so we never retry
    // while the switch is on, and skip the Purchase send.
    if ((store as any).capi_disabled === true) {
      await supabase
        .from("orders")
        .update({ meta_purchase_fired_at: new Date().toISOString() })
        .eq("id", orderId)
        .is("meta_purchase_fired_at", null);
      return { ok: true, reason: "capi_disabled_by_merchant" };
    }

    // 3. Load order items for content_ids / contents.
    const { data: items } = await supabase
      .from("order_items")
      .select("product_id, product_name, quantity, unit_price")
      .eq("order_id", orderId);

    // 4. Load customer email if storefront customer.
    let customerEmail: string | null = null;
    if (order.storefront_customer_id) {
      const { data: cust } = await supabase
        .from("storefront_customers")
        .select("email")
        .eq("id", order.storefront_customer_id)
        .maybeSingle();
      customerEmail = cust?.email ?? null;
    }
    // Guest checkout: no storefront_customers row, but the shopper may have
    // typed an email at checkout — place-order persists it on the order.
    if (!customerEmail && (order as any).buyer_email) {
      customerEmail = String((order as any).buyer_email);
    }

    // 5. Build user_data with hashed PII.
    const userData: Record<string, unknown> = {
      client_user_agent: order.buyer_user_agent || undefined,
      fbc: sanitizeFb(order.buyer_fbc, FBC_RX),
      fbp: sanitizeFb(order.buyer_fbp, FBP_RX),
    };

    // CRITICAL: only send IP if we have the real buyer IP. Never the edge IP.
    if (order.buyer_ip && !isPrivateIp(order.buyer_ip)) {
      userData.client_ip_address = order.buyer_ip;
    }

    if (customerEmail) userData.em = [await sha256Hex(normEmail(customerEmail))];
    if (order.customer_phone) {
      const cleaned = String(order.customer_phone).replace(/\D/g, "");
      // v8.61.0 BAN-FIX P1-3 (mirror): prepend 91 country code for 10-digit
      // Indian numbers — Meta hashes E.164-without-plus, so without this
      // every server Purchase phone hash mismatched the browser-side one.
      const e164 = cleaned.length === 10 ? `91${cleaned}` : cleaned;
      if (e164) userData.ph = [await sha256Hex(e164)];
    }
    // external_id: prefer storefront customer id, fall back to order id.
    // v8.61.0 BAN-FIX P1-4: was `sha256Hex(normEmail(...))` which lowercases via
    // email rules. meta-capi/index.ts uses `sha256Hex(trim(...))` only. Different
    // hashes for the same UUID → server Purchase doesn't dedupe with browser
    // PageView/ViewContent that already sent the bare trimmed external_id →
    // EMQ tanks + Meta flags "duplicate user across pixels". Match the spec
    // (trim only, no case normalization for opaque IDs).
    // Send BOTH ids Meta may have already seen from the browser, not one.
    // Guest checkout auto-creates a storefront_customers row mid-flow, so the
    // browser's Pixel Advanced Matching carried `sf_vid` for the whole session
    // (PageView / ViewContent / AddToCart) and only switched to the customer id
    // after auto-login. Sending only the customer id made the server Purchase
    // look like a different person than every prior event. external_id accepts
    // an array — send both so Meta stitches the identity graph either way.
    // order.id stays as the last-resort fallback when we have neither.
    const extIdCandidates = [
      order.storefront_customer_id,
      (order as any).buyer_external_id,
    ]
      .map((v) => String(v || "").trim())
      .filter(Boolean);
    const uniqueExtIds = [...new Set(extIdCandidates.length ? extIdCandidates : [String(order.id).trim()])];
    userData.external_id = await Promise.all(uniqueExtIds.map((v) => sha256Hex(v)));

    if (order.customer_name) {
      const parts = String(order.customer_name).trim().split(/\s+/);
      const fn = parts[0] ? normName(parts[0]) : "";
      const ln = parts.length > 1 ? normName(parts.slice(1).join(" ")) : "";
      if (fn) userData.fn = [await sha256Hex(fn)];
      if (ln) userData.ln = [await sha256Hex(ln)];
    }
    if (order.city) {
      const v = normCityState(String(order.city));
      if (v) userData.ct = [await sha256Hex(v)];
    }
    if (order.state) {
      const v = normCityState(String(order.state));
      if (v) userData.st = [await sha256Hex(v)];
    }
    if (order.pincode) {
      const v = normZip(String(order.pincode));
      if (v) userData.zp = [await sha256Hex(v)];
    }
    // Country only when we have a real address signal.
    if (order.city || order.state || order.pincode) {
      userData.country = [await sha256Hex(normCountry("in"))];
    }

    // 6. Build event.
    // Only catalog-backed order lines may be sent in Meta `content_ids` / `contents`.
    // Older/manual rows can have product_id = NULL; including those in `contents`
    // produces Meta "content IDs aren't matching any catalog" warnings even when
    // the valid catalog rows are correct.
    const catalogItems = (items || []).filter((i) => !!i.product_id);
    const contentIds = catalogItems.map((i) => i.product_id).filter(Boolean) as string[];
    // Defense-in-depth: a stored URL from an old test order on
    // *.lovableproject.com / *.lovable.dev must NEVER be sent to Meta —
    // it dilutes domain authority + EMQ. Drop it and use the canonical
    // store URL instead.
    const isLovableHost = (url: string | null | undefined): boolean => {
      if (!url) return false;
      try {
        const h = new URL(url).hostname;
        return (
          h === "localhost" ||
          h === "127.0.0.1" ||
          h.endsWith(".lovableproject.com") ||
          h.endsWith(".lovable.dev") ||
          h.endsWith(".sandbox.lovable.dev")
        );
      } catch { return false; }
    };
    const storedUrl = isLovableHost((order as any).meta_event_source_url)
      ? null
      : (order as any).meta_event_source_url;
    const overrideUrl = isLovableHost(opts.eventSourceUrl) ? null : opts.eventSourceUrl;
    const eventSourceUrl =
      overrideUrl ||
      storedUrl ||
      (store.custom_domain
        ? `https://${store.custom_domain}/checkout`
        : `https://${store.slug}.shopbanao.in/checkout`);

    // event_time must be WHEN THE PURCHASE HAPPENED, not when we managed to
    // send it. Reconcile/backfill crons and gateway-webhook retries fire this
    // as much as 17.7h after the sale (measured on live orders), which pushed
    // the conversion into the wrong attribution window and gave the deduped
    // browser twin a wildly different timestamp — Meta treats a large skew
    // between a browser/server pair as an unreliable integration.
    // Clamp: never in the future, never older than 7 days (Meta rejects those).
    const nowSec = Math.floor(Date.now() / 1000);
    const occurredMs = Date.parse(
      String((order as any).payment_verified_at || order.created_at || ""),
    );
    const eventTime = Number.isFinite(occurredMs)
      ? Math.min(nowSec, Math.max(Math.floor(occurredMs / 1000), nowSec - 6 * 86400))
      : nowSec;

    const event = {
      event_name: "Purchase",
      event_time: eventTime,
      // Dedupe vs browser Pixel. The browser derives its Purchase id from the
      // checkout token (`pur-<token>`, src/lib/pixelOutbox.ts), so when the
      // order row never captured meta_event_id we must rebuild the SAME id
      // instead of falling back to the order UUID — a UUID can never match the
      // browser event, which made Meta count the sale twice.
      event_id: order.meta_event_id || derivedEventId(order as any),
      event_source_url: eventSourceUrl,
      action_source: "website",
      user_data: userData,
      custom_data: {
        currency: order.currency || "INR",
        // Industry-standard: report FULL order value (matches Shopify,
        // GoKwik, Shiprocket, Razorpay Magic). Meta's bidder is trained
        // on full cart value — sending only the advance for partial
        // payments would cripple ROAS reporting and destroy delivery.
        value: Number(order.total) || 0,

        content_type: "product",
        content_ids: contentIds,
        contents: catalogItems.map((i) => ({
          id: i.product_id,
          quantity: Number(i.quantity) || 1,
          item_price: Number(i.unit_price) || 0,
        })),
        num_items: (items || []).reduce((s, i) => s + (Number(i.quantity) || 0), 0),
        order_id: order.id,
        // Meta's ecommerce spec: Purchase should declare how the order is
        // fulfilled. Every ShopBanao order ships to the buyer's address.
        delivery_category: "home_delivery",
      },

    };

    // Atomic DB claim BEFORE sending to Meta. Webhook + browser verify can hit
    // different edge isolates at the same time, so in-memory locks are not
    // enough. Only the first caller that flips the NULL stamp may send Purchase.
    // v8.70.0: also re-check the status inside the same UPDATE — if a webhook
    // races and cancels the order in the millisecond between our SELECT (above)
    // and this UPDATE, the row will no longer match `status IN (paid_set)` and
    // the claim returns zero rows. Prevents the rare "fired-then-cancelled" leak.
    const { data: claimed } = await supabase
      .from("orders")
      .update({ meta_purchase_fired_at: new Date().toISOString() })
      .eq("id", orderId)
      .is("meta_purchase_fired_at", null)
      .in("status", ["paid", "confirmed", "partially_paid", "delivered", "completed"])
      .select("id");
    if (!claimed || claimed.length === 0) {
      return { ok: true, reason: "already_fired_or_status_changed" };
    }

    // Release the claim so a later gateway callback / reconcile cron can retry.
    // The claim above is a *lease*, not a receipt: it exists to stop two
    // concurrent isolates double-firing, NOT to record success. Leaving it set
    // after a transient failure permanently burns the order's Purchase signal.
    // The claim is set BEFORE the Meta POST, so every failure path must put it
    // back to NULL or the order is permanently un-retryable (reconcile crons
    // only pick up rows where the stamp is still NULL — nothing ever re-clears
    // a stuck-set stamp). This update itself can throw (DB timeout / dropped
    // connection); if it did, the exception escaped into the outer catch and
    // the stamp stayed set → silent, permanent Purchase loss. Never let that
    // happen: swallow + log, and retry the release once.
    const releaseClaim = async () => {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const { error } = await supabase
            .from("orders")
            .update({ meta_purchase_fired_at: null })
            .eq("id", orderId);
          if (!error) return;
          console.error(
            `[capi:${opts.source}] releaseClaim failed (attempt ${attempt + 1}) for ${orderId}`,
            error.message,
          );
        } catch (e) {
          console.error(
            `[capi:${opts.source}] releaseClaim threw (attempt ${attempt + 1}) for ${orderId}`,
            (e as Error)?.message,
          );
        }
      }
      // Both attempts failed — loud marker so this is greppable in logs.
      console.error(
        `[capi:${opts.source}] STUCK_LEASE order=${orderId} — meta_purchase_fired_at is set but Purchase was NOT delivered to Meta`,
      );
    };


    // 7. Send to Meta — with 2 retries on 5xx / network error (transient blip).
    const sendOnce = () => fetch(
      `${META_GRAPH_URL}/${store.facebook_pixel_id}/events`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${store.meta_access_token}` },
        body: JSON.stringify({ data: [event] }),
      },
    );

    let resp: Response | null = null;
    let netErr: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 400 * attempt));
      try {
        netErr = null;
        resp = await sendOnce();
      } catch (e) {
        netErr = e;
        resp = null;
        continue;
      }
      // 429 is a transient rate-limit, not a config error — retry like a 5xx.
      if (resp.status === 429 || (resp.status >= 500 && resp.status < 600)) continue;
      break;
    }

    if (!resp) {
      console.error(`[capi:${opts.source}] network error`, netErr);
      await releaseClaim(); // transient — must remain retryable
      return { ok: false, reason: "network_error" };
    }

    const result = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      console.error(`[capi:${opts.source}] meta error ${resp.status}`, JSON.stringify(result));
      if (resp.status >= 500 || resp.status === 429) {
        // Meta-side outage or rate limit — keep the order eligible for the
        // reconcile-cron retry instead of burning the Purchase forever.
        await releaseClaim();
        return { ok: false, reason: `meta_${resp.status}` };
      }
      // 4xx = config error (bad token / pixel / payload). Retrying forever
      // just hammers Meta and trips the circuit breaker, so keep the stamp.
      return { ok: false, reason: `meta_${resp.status}` };
    }


    console.log(`[capi:${opts.source}] purchase fired`, orderId, result.events_received);
    return { ok: true };
  } catch (err) {
    console.error(`[capi:${opts.source}] unexpected error`, err);
    return { ok: false, reason: "exception" };
  } finally {
    releasePurchaseLock(orderId);
  }
}
