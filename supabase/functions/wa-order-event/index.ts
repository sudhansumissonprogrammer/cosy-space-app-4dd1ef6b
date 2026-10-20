// Single entry point for order-related WhatsApp events.
// Enqueues into wa_send_queue. Branding is resolved at send-time.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, normalizePhone, isValidCronHeader, loadPlatformConfig, platformConfigUsable, getCronSecret } from "../_shared/wa-platform.ts";
import { formatExpectedDelivery, formatPaymentStatusLine, formatPaidSummary, formatCodDueLine, inferCourierName } from "../_shared/wa-content.ts";
import { customerTrackingUrl } from "../_shared/customer-tracking.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Event = "order_confirmation" | "cod_confirmation" | "payment_received" | "order_shipped" | "order_delivered" | "review_request";

const TEMPLATE_BY_EVENT: Record<Event, string> = {
  order_confirmation: "order_confirmation_v2",
  cod_confirmation: "cod_order_confirm_v1",
  payment_received: "payment_success_v1",
  order_shipped: "order_shipped_v2",
  order_delivered: "order_delivered_v1",
  review_request: "review_request_v1",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Accept either: (a) cron-style internal call with x-cron-secret, OR
  // (b) an authenticated store owner / admin from the dashboard marking an
  // order shipped. Without this, the storefront UI cannot trigger shipping
  // notifications through the shared platform.
  const cronHeader = req.headers.get("x-cron-secret") || "";
  const authHeader = req.headers.get("Authorization") || "";
  let isAuthorized = false;
  let callerUserId: string | null = null;
  let isInternal = false;
  if (cronHeader && (await isValidCronHeader(admin, cronHeader))) {
    isAuthorized = true;
    isInternal = true;
  } else if (authHeader.startsWith("Bearer ")) {
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (user) {
      isAuthorized = true;
      callerUserId = user.id;
    }
  }
  if (!isAuthorized) return json({ error: "unauthorized" }, 401);

  const cfg = await loadPlatformConfig(admin);
  if (!platformConfigUsable(cfg)) return json({ skipped: true, reason: "wa_disabled" });


  let body: { event: Event; order_id: string; parcel_scan_id?: string | null };
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  if (!body.event || !body.order_id) return json({ error: "event + order_id required" }, 400);

  // Only these two events are enabled platform-wide right now.
  // Abandoned cart is handled by a separate cron. Everything else is disabled.
  const ALLOWED: Event[] = ["order_confirmation", "cod_confirmation", "order_shipped"];
  if (!ALLOWED.includes(body.event)) {
    return json({ skipped: true, reason: "event_disabled" });
  }

  const { data: order } = await admin
    .from("orders")
    .select("id, store_id, status, customer_phone, customer_name, total, currency, tracking_url, tracking_number, order_number, payment_method, payment_type, advance_paid, balance_due, created_at, street_address, city, pincode, cod_confirm_status, stores:store_id(name, slug, custom_domain)")
    .eq("id", body.order_id).maybeSingle();
  if (!order) return json({ error: "order_not_found" }, 404);

  const phone = normalizePhone((order as any).customer_phone);
  if (!phone) return json({ skipped: true, reason: "no_phone" });

  const o = order as any;
  if (!isInternal && callerUserId) {
    const { data: ownedStore } = await admin
      .from("stores")
      .select("id")
      .eq("id", o.store_id)
      .eq("owner_id", callerUserId)
      .maybeSingle();
    const { data: isAdmin } = ownedStore ? { data: false } : await admin.rpc("has_role", { _user_id: callerUserId, _role: "admin" });
    if (!ownedStore && isAdmin !== true) return json({ error: "forbidden" }, 403);
  }
  const discardSubmittedParcelPhoto = async () => {
    if (!body.parcel_scan_id) return;
    const { data: scan } = await admin
      .from("parcel_label_scans")
      .select("id,temp_object_path")
      .eq("id", body.parcel_scan_id)
      .eq("order_id", o.id)
      .eq("store_id", o.store_id)
      .maybeSingle();
    const path = String((scan as any)?.temp_object_path || "");
    if (path) await admin.storage.from("parcel-label-temp").remove([path]);
    if (scan) await admin.from("parcel_label_scans").update({
      temp_object_path: null,
      photo_deleted_at: new Date().toISOString(),
    }).eq("id", (scan as any).id);
  };

  // 🔒 Master switch is authoritative for EVERY event (marketing AND transactional).
  // If the store owner has WhatsApp OFF, nothing goes out on their behalf.
  const { data: storeSettings } = await admin
    .from("stores_wa_settings")
    .select("platform_marketing_enabled, send_order_confirmation, send_order_shipped, send_cod_confirmation")
    .eq("store_id", o.store_id)
    .maybeSingle();
  if (!storeSettings || (storeSettings as any).platform_marketing_enabled !== true) {
    await discardSubmittedParcelPhoto();
    return json({ skipped: true, reason: "store_disabled" });
  }
  // Per-event toggle — default OFF, must be explicitly enabled by the store.
  const perEventOn =
    (body.event === "order_confirmation" && (storeSettings as any).send_order_confirmation === true) ||
    (body.event === "order_shipped" && (storeSettings as any).send_order_shipped === true) ||
    (body.event === "cod_confirmation" && (storeSettings as any).send_cod_confirmation === true);
  if (!perEventOn) {
    await discardSubmittedParcelPhoto();
    return json({ skipped: true, reason: "event_toggle_off" });
  }



  // 🧾 COD confirmation is STRICTLY for full Cash-on-Delivery orders.
  // Partial-COD (advance paid online, e.g. Serdiya Jewellers) is never eligible —
  // those customers already paid and must not be asked to re-confirm.
  if (body.event === "cod_confirmation") {
    const method = String(o.payment_method || "").toLowerCase();
    const ptype = String(o.payment_type || "").toLowerCase();
    const advance = Number(o.advance_paid || 0);
    const isPureCod = method === "cod" && ptype === "full" && advance <= 0;
    if (!isPureCod) return json({ skipped: true, reason: "not_pure_cod" });
    if (String(o.status || "").toLowerCase() === "cancelled") {
      return json({ skipped: true, reason: "order_cancelled" });
    }
  }

  // Gate: "shipped" must have a tracking number, otherwise customer gets a useless message.
  if (body.event === "order_shipped" && (!o.tracking_number || String(o.tracking_number).trim() === "")) {
    await discardSubmittedParcelPhoto();
    return json({ skipped: true, reason: "no_tracking_number" });
  }

  // 🔕 Seller opt-out is authoritative: if the "Notify customer on WhatsApp"
  // box was unticked while saving the tracking, the shipping message must NOT
  // go out — no matter which path (dashboard, status flip, courier sync) fires.
  if (body.event === "order_shipped") {
    const { data: shipRow } = await admin
      .from("order_shipments")
      .select("notify_customer")
      .eq("order_id", o.id)
      .order("updated_at", { ascending: false })
      .limit(1).maybeSingle();
    if (shipRow && (shipRow as any).notify_customer === false) {
      await discardSubmittedParcelPhoto();
      return json({ skipped: true, reason: "seller_muted_notification" });
    }
  }

  // 🔒 Idempotency: at most one active row per (order_id, message_type).
  const { data: existing } = await admin
    .from("wa_send_queue")
    .select("id, status")
    .eq("order_id", o.id)
    .eq("message_type", body.event)
    .in("status", ["pending", "sending", "sent", "skipped"])
    .limit(1).maybeSingle();
  if (existing) {
    await discardSubmittedParcelPhoto();
    return json({ ok: true, queued: false, reason: "already_enqueued" });
  }

  const orderNum = o.order_number || String(o.id).slice(0, 8).toUpperCase();
  const sym = o.currency === "INR" || !o.currency ? "₹" : `${o.currency} `;
  const orderTotal = `${sym}${Number(o.total || 0).toFixed(0)}`;
  const customerName = o.customer_name || "there";
  const s = o.stores || {};
  const storeName = s.name || "our store";
  const base = s.custom_domain ? `https://${s.custom_domain}` : (s.slug ? `https://${s.slug}.shopbanao.in` : "https://shopbanao.in");
  const orderLink = `${base}/account/orders/${o.id}`;
  // Always keep customers on our own order page (live timeline lives there);
  // the courier's site is still one tap away from that page.
  const trackingUrl = `${orderLink}#shipment`;
  const reviewUrl = `${base}/account/orders/${o.id}#review`;

  // Pull line items so we can show the primary product name (more meaningful than an internal order ID).
  const { data: items } = await admin
    .from("order_items")
    .select("product_name, quantity, image_url")
    .eq("order_id", o.id);
  const lineItems = (items as any[]) || [];
  const itemCountNum = lineItems.reduce((n, it) => n + Number(it.quantity || 1), 0) || lineItems.length || 1;
  const firstName = lineItems[0]?.product_name || "your item";
  const productName = lineItems.length > 1 ? `${firstName} +${lineItems.length - 1} more` : firstName;
  // COD confirmation shows the title in a tight bullet list — drop marketing
  // suffixes ("| Men & Women | Daily Wear …") and cap the length.
  const shortProductName = shortProductTitle(productName);

  // Meta IMAGE headers reject webp/avif and anything without a clean
  // content-type, so route product photos through the wsrv.nl JPG proxy
  // (same approach as the cart-recovery templates).
  const rawImage = lineItems.find((it) => it.image_url)?.image_url || "";
  const headerImage = rawImage
    ? `https://wsrv.nl/?url=${encodeURIComponent(String(rawImage))}&w=800&h=800&fit=cover&output=jpg&q=82`
    : "";


  // Delivery ETA: confirmation = 6 days from order date; shipped = 4 days from ship time.
  const etaFrom = body.event === "order_shipped" ? new Date() : new Date(o.created_at || Date.now());
  const etaDays = body.event === "order_shipped" ? 4 : 6;
  const expectedDelivery = formatExpectedDelivery(etaFrom, etaDays);

  const deliveryAddress = [o.street_address, o.city, o.pincode]
    .map((p: any) => String(p || "").trim())
    .filter(Boolean)
    .join(", ") || "As provided at checkout";

  const paymentStatusLine = formatPaymentStatusLine(o);
  const paidSummary = formatPaidSummary(o);
  const codDueLine = formatCodDueLine(o);
  // Courier: prefer the real shipment row (set by the seller in the dashboard)
  // over guessing from the tracking URL, so "India Post" etc. shows correctly.
  const { data: shipRow } = await admin
    .from("order_shipments")
    .select("courier_name, tracking_slug, tracking_url, awb")
    .eq("order_id", o.id)
    .order("created_at", { ascending: false })
    .limit(1).maybeSingle();
  const courierName = (shipRow as any)?.courier_name
    || inferCourierName((shipRow as any)?.tracking_url || o.tracking_url, "Courier partner");


  // Branded short link token resolved by /functions/v1/wa-r/<token>.
  // 'o-' = order page, 't-' = tracking URL (falls back to order page).
  const ctaToken = body.event === "order_shipped" ? `t-${o.id}` : `o-${o.id}`;

  // 🧾 COD confirmation must never go out on an unapproved template — quick-reply
  // buttons only exist once Meta approves the template. Prefer the JD-style v2
  // copy once approved; fall back to v1 while v2 is still in review.
  let codTemplateName = TEMPLATE_BY_EVENT.cod_confirmation;
  if (body.event === "cod_confirmation") {
    const { data: codTpls } = await admin
      .from("platform_wa_templates")
      .select("name, is_active, paused, meta_status")
      .in("name", ["cod_order_confirm_v2", "cod_order_confirm_v1"]);
    const usable = (name: string) =>
      (codTpls || []).some((t: any) =>
        t.name === name && t.is_active && !t.paused &&
        String(t.meta_status || "").toUpperCase() === "APPROVED");
    if (usable("cod_order_confirm_v2")) codTemplateName = "cod_order_confirm_v2";
    else if (usable("cod_order_confirm_v1")) codTemplateName = "cod_order_confirm_v1";
    else return json({ skipped: true, reason: "no_approved_cod_template" });
  }

  let parcelPhotoUrl = "";
  let verifiedParcelScanId = "";
  if (body.event === "order_shipped" && body.parcel_scan_id) {
    const nowIso = new Date().toISOString();
    const { data: scan } = await admin
      .from("parcel_label_scans")
      .select("id,order_id,store_id,scanned_by,tracking_number,temp_object_path,temp_expires_at,photo_deleted_at")
      .eq("id", body.parcel_scan_id)
      .eq("order_id", o.id)
      .eq("store_id", o.store_id)
      .eq("decision", "accepted")
      .is("photo_deleted_at", null)
      .gt("temp_expires_at", nowIso)
      .maybeSingle();
    const scanAwb = String((scan as any)?.tracking_number || "").replace(/\s+/g, "").toUpperCase();
    const orderAwb = String(o.tracking_number || "").replace(/\s+/g, "").toUpperCase();
    const operatorMatches = isInternal || (scan as any)?.scanned_by === callerUserId;
    if (scan && operatorMatches && scanAwb === orderAwb && (scan as any).temp_object_path) {
      const secondsLeft = Math.max(60, Math.floor((new Date((scan as any).temp_expires_at).getTime() - Date.now()) / 1000));
      const { data: signed } = await admin.storage
        .from("parcel-label-temp")
        .createSignedUrl((scan as any).temp_object_path, Math.min(secondsLeft, 4 * 60 * 60));
      if (signed?.signedUrl) {
        parcelPhotoUrl = signed.signedUrl;
        verifiedParcelScanId = String((scan as any).id);
      }
    }
    if (!verifiedParcelScanId) await discardSubmittedParcelPhoto();
  }

  // Prefer the approved image-header shipment template only when the scan,
  // order, operator, AWB, expiry and private object all still agree.
  let templateName = body.event === "cod_confirmation" ? codTemplateName : TEMPLATE_BY_EVENT[body.event];
  if (body.event === "order_shipped") {
    const { data: tpls } = await admin
      .from("platform_wa_templates")
      .select("name, is_active, paused, meta_status")
       .in("name", ["order_shipped_v3", "order_shipped_v3_img", "order_shipped_v3_product"]);
    const usable = (name: string) =>
      (tpls || []).some((t: any) =>
        t.name === name && t.is_active && !t.paused &&
        String(t.meta_status || "").toUpperCase() === "APPROVED");
    if (parcelPhotoUrl && usable("order_shipped_v3_img")) templateName = "order_shipped_v3_img";
    else if (headerImage && usable("order_shipped_v3_product")) templateName = "order_shipped_v3_product";
    else if (usable("order_shipped_v3")) templateName = "order_shipped_v3";
    else {
      console.warn("order_shipped skipped: no approved shipping template", { order_id: o.id });
      await discardSubmittedParcelPhoto();
      return json({ skipped: true, reason: "no_approved_shipping_template" });
    }
  }



  const { error: qErr } = await admin.from("wa_send_queue").insert({
    store_id: o.store_id,
    recipient_phone: phone,
    recipient_name: customerName,
    template_name: templateName,
    message_type: body.event,
    order_id: o.id,
    params: [],
    template_vars: {

      customer_name: customerName,
      store_name: storeName,
      product_name: body.event === "cod_confirmation" ? shortProductName : productName,
      order_number: orderNum,
      order_total: orderTotal,
      item_count: String(itemCountNum),
      payment_status_line: paymentStatusLine,
      paid_summary: paidSummary,
      cod_due_line: codDueLine,
      expected_delivery: expectedDelivery,
      order_link: orderLink,
      tracking_url: body.event === "order_shipped" && (shipRow as any)?.tracking_slug === "valmo"
        ? customerTrackingUrl("valmo", o.tracking_number) : trackingUrl,
      tracking_number: o.tracking_number || "",
      courier_name: courierName,
      review_url: reviewUrl,
      cta_token: ctaToken,
      delivery_address: deliveryAddress,
      ...(parcelPhotoUrl ? { header_media_url: parcelPhotoUrl, parcel_scan_id: verifiedParcelScanId } : {}),
      ...(headerImage && (body.event !== "order_shipped" || templateName === "order_shipped_v3_product") ? { header_media_url: headerImage } : {}),

    },

    priority: body.event === "order_confirmation" || body.event === "cod_confirmation" ? 1 : 3,
    scheduled_at: new Date().toISOString(),
  } as any);


  // 23505 = unique_violation from the partial unique index → treat as dedup, not error.
  if (qErr) {
    await discardSubmittedParcelPhoto();
    if ((qErr as any).code === "23505") return json({ ok: true, queued: false, reason: "already_enqueued" });
    return json({ error: qErr.message }, 500);
  }

  // 🧾 Mark the order as awaiting the customer's WhatsApp confirmation so the
  // follow-up cron and the dashboard both know its state.
  if (body.event === "cod_confirmation") {
    await admin.from("orders").update({
      cod_confirm_status: "awaiting",
      cod_confirm_sent_at: new Date().toISOString(),
    } as any).eq("id", o.id).is("cod_confirm_status", null);
  }

  // 🚀 Fire the queue worker immediately (fire-and-forget) so the customer
  // gets their WhatsApp within seconds instead of waiting ≤1 min for the
  // pg_cron tick. The worker itself is idempotent + rate-limited.
  try {
    // IMPORTANT: use DB-backed cron secret (env CRON_SECRET is often unset on
    // this runtime). Without a valid secret the worker returns 401 and the
    // message sits in the queue until the next pg_cron tick (up to 60s delay).
    const cronSecret = (await getCronSecret(admin)) || Deno.env.get("CRON_SECRET") || "";
    const kick = fetch(`${SUPABASE_URL}/functions/v1/wa-queue-worker`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": cronSecret,
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
      },
      body: "{}",
    }).catch((e) => console.warn("wa-queue-worker kick failed:", (e as Error).message));
    // @ts-ignore — EdgeRuntime is available in Supabase Deno runtime
    if (typeof EdgeRuntime !== "undefined" && (EdgeRuntime as any).waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(kick);
    }
  } catch (e) {
    console.warn("wa-queue-worker kick error:", (e as Error).message);
  }

  return json({ ok: true, queued: true });
});

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

/** Strip "| …" marketing suffixes and cap length for the COD summary bullet. */
function shortProductTitle(name: string, max = 60): string {
  let t = String(name || "").split("|")[0].trim();
  if (t.length > max) t = `${t.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
  return t || "your item";
}
