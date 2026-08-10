// health-signals — business-level ("is money still flowing?") monitoring.
//
// The uptime-monitor answers "does the page respond?". This function answers the
// harder question: "is the store actually WORKING?" — payments completing,
// orders landing, WhatsApp going out, tracking syncing, errors not spiking.
//
// Runs every 5 minutes. Each signal is a virtual target (kind = 'signal',
// enabled = false so the HTTP prober skips it) so incidents, alerting and the
// admin UI reuse exactly the same pipeline as uptime checks.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const FAIL_THRESHOLD = 2; // consecutive bad evaluations before alerting (≈10 min)

const j = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const iso = (minsAgo: number) => new Date(Date.now() - minsAgo * 60_000).toISOString();
const istNow = () =>
  new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().replace("T", " ").slice(0, 16) + " IST";

type Signal = { key: string; label: string; ok: boolean; detail: string };

async function count(admin: any, table: string, build: (q: any) => any): Promise<number> {
  const q = build(admin.from(table).select("id", { count: "exact", head: true }));
  const { count: c } = await q;
  return c ?? 0;
}

async function evaluate(admin: any): Promise<Signal[]> {
  const out: Signal[] = [];
  const PAID = ["confirmed", "partially_paid", "shipped", "delivered"];

  // 1) Checkout / payment stall — orders are being created but none are completing.
  try {
    const created = await count(admin, "orders", (q) => q.gte("created_at", iso(45)));
    const paid = await count(admin, "orders", (q) => q.gte("created_at", iso(45)).in("status", PAID));
    const bad = created >= 8 && paid === 0;
    out.push({
      key: "signal:checkout_stall",
      label: "Checkout & payment completion",
      ok: !bad,
      detail: `${created} checkouts started, ${paid} completed in the last 45 minutes`,
    });
  } catch (e) { console.error("signal checkout_stall", (e as Error).message); }

  // 2) Order blackout — real traffic is landing but zero orders are being created.
  try {
    const views = await count(admin, "page_views", (q) => q.gte("created_at", iso(60)).eq("is_bot", false));
    const orders = await count(admin, "orders", (q) => q.gte("created_at", iso(60)));
    const bad = views >= 400 && orders === 0;
    out.push({
      key: "signal:order_blackout",
      label: "Traffic to order conversion",
      ok: !bad,
      detail: `${views} human pageviews and ${orders} orders in the last 60 minutes`,
    });
  } catch (e) { console.error("signal order_blackout", (e as Error).message); }

  // 3) Application error spike.
  try {
    const errs = await count(admin, "error_logs", (q) => q.gte("created_at", iso(15)).in("level", ["error", "fatal"]));
    out.push({
      key: "signal:error_spike",
      label: "Application error rate",
      ok: errs < 25,
      detail: `${errs} errors logged in the last 15 minutes (alert above 25)`,
    });
  } catch (e) { console.error("signal error_spike", (e as Error).message); }

  // 4) Payment gateway errors (PayU / Cashfree / Razorpay / UPI).
  try {
    const { data: rows } = await admin
      .from("error_logs")
      .select("message")
      .gte("created_at", iso(30))
      .limit(500);
    const hits = ((rows as any[]) || []).filter((r) =>
      /payu|cashfree|razorpay|upi|payment/i.test(String(r?.message || "")),
    ).length;
    out.push({
      key: "signal:payment_errors",
      label: "Payment gateway errors",
      ok: hits < 8,
      detail: `${hits} payment-related errors in the last 30 minutes (alert above 8)`,
    });
  } catch (e) { console.error("signal payment_errors", (e as Error).message); }

  // 5) WhatsApp delivery health — ratio based, the platform always has some failures.
  try {
    const failed = await count(admin, "whatsapp_messages", (q) =>
      q.gte("created_at", iso(30)).eq("direction", "outgoing").eq("status", "failed"));
    const total = await count(admin, "whatsapp_messages", (q) =>
      q.gte("created_at", iso(30)).eq("direction", "outgoing"));
    const ratio = total ? failed / total : 0;
    const bad = total >= 20 && ratio >= 0.8;
    out.push({
      key: "signal:whatsapp_delivery",
      label: "WhatsApp message delivery",
      ok: !bad,
      detail: `${failed} of ${total} outgoing messages failed in the last 30 minutes (${Math.round(ratio * 100)}%)`,
    });
  } catch (e) { console.error("signal whatsapp_delivery", (e as Error).message); }

  // 6) Shipment tracking sync freshness.
  try {
    const stale = await count(admin, "order_shipments", (q) =>
      q.eq("is_active", true).not("normalized_status", "in", '("delivered","cancelled","rto_delivered")')
        .lt("last_synced_at", iso(24 * 60)));
    out.push({
      key: "signal:tracking_sync",
      label: "Shipment tracking sync",
      ok: stale < 25,
      detail: `${stale} active shipments have not synced tracking for over 24 hours (alert above 25)`,
    });
  } catch (e) { console.error("signal tracking_sync", (e as Error).message); }

  // 7) Order confirmation notifications actually leaving the platform.
  try {
    const paidRecent = await count(admin, "orders", (q) => q.gte("created_at", iso(60)).in("status", PAID));
    const confs = await count(admin, "whatsapp_messages", (q) =>
      q.gte("created_at", iso(60)).eq("direction", "outgoing").eq("message_type", "order_confirmation"));
    const bad = paidRecent >= 5 && confs === 0;
    out.push({
      key: "signal:order_notifications",
      label: "Order confirmation messages",
      ok: !bad,
      detail: `${paidRecent} paid orders and ${confs} confirmation messages in the last 60 minutes`,
    });
  } catch (e) { console.error("signal order_notifications", (e as Error).message); }

  // 8) Payment success rate — orders are being created but almost nothing converts to paid.
  try {
    const created = await count(admin, "orders", (q) => q.gte("created_at", iso(60)));
    const paid = await count(admin, "orders", (q) => q.gte("created_at", iso(60)).in("status", PAID));
    const rate = created ? paid / created : 1;
    const bad = created >= 12 && rate < 0.15;
    out.push({
      key: "signal:payment_success_rate",
      label: "Payment success rate",
      ok: !bad,
      detail: `${paid}/${created} orders paid in the last 60 minutes (${Math.round(rate * 100)}%, alert below 15%)`,
    });
  } catch (e) { console.error("signal payment_success_rate", (e as Error).message); }

  // 9) Per-store blackout — a single store has real traffic but zero orders.
  try {
    const { data: pv } = await admin
      .from("page_views")
      .select("store_id")
      .gte("created_at", iso(60))
      .eq("is_bot", false)
      .limit(8000);
    const views: Record<string, number> = {};
    for (const r of ((pv as any[]) || [])) {
      const s = r?.store_id; if (s) views[s] = (views[s] || 0) + 1;
    }
    const hot = Object.entries(views).filter(([, n]) => n >= 250).map(([s]) => s);
    const dead: string[] = [];
    for (const s of hot) {
      const o = await count(admin, "orders", (q) => q.gte("created_at", iso(60)).eq("store_id", s));
      if (o === 0) dead.push(s);
    }
    let names = "";
    if (dead.length) {
      const { data: st } = await admin.from("stores").select("slug").in("id", dead);
      names = ((st as any[]) || []).map((x) => x.slug).join(", ");
    }
    out.push({
      key: "signal:store_order_blackout",
      label: "Per-store order blackout",
      ok: dead.length === 0,
      detail: dead.length
        ? `Busy stores with zero orders in 60 min: ${names || dead.join(", ")}`
        : `${hot.length} busy stores checked, all taking orders`,
    });
  } catch (e) { console.error("signal store_order_blackout", (e as Error).message); }

  // 10) Latency degradation — pages respond, but far too slowly.
  try {
    const { data: rows } = await admin
      .from("uptime_checks")
      .select("latency_ms")
      .gte("checked_at", iso(15))
      .eq("ok", true)
      .not("latency_ms", "is", null)
      .limit(2000);
    const arr = ((rows as any[]) || []).map((r) => Number(r.latency_ms)).filter((n) => n > 0).sort((a, b) => a - b);
    const p95 = arr.length ? arr[Math.min(arr.length - 1, Math.floor(arr.length * 0.95))] : 0;
    const median = arr.length ? arr[Math.floor(arr.length / 2)] : 0;
    // Require BOTH a bad tail and an elevated median. A single slow probe batch
    // (cold start / monitor event-loop contention) inflates p95 only — that is
    // not a user-visible outage and must not page anyone.
    const degraded = arr.length >= 30 && p95 > 4000 && median > 1500;
    out.push({
      key: "signal:latency_degradation",
      label: "Response time (p95)",
      ok: !degraded,
      detail: `p95 ${p95}ms / median ${median}ms across ${arr.length} probes in 15 minutes (alert above p95 4000ms + median 1500ms)`,
    });
  } catch (e) { console.error("signal latency_degradation", (e as Error).message); }

  // 11) WhatsApp send queue backlog — worker stuck / not draining.
  try {
    const stuck = await count(admin, "wa_send_queue", (q) =>
      q.in("status", ["queued", "pending", "processing"]).lt("scheduled_at", iso(25)));
    out.push({
      key: "signal:wa_queue_backlog",
      label: "WhatsApp send queue backlog",
      ok: stuck < 80,
      detail: `${stuck} messages waiting over 25 minutes in the send queue (alert above 80)`,
    });
  } catch (e) { console.error("signal wa_queue_backlog", (e as Error).message); }

  // 12) Cart recovery engine — abandoned carts piling up with no recovery sent.
  try {
    const carts = await count(admin, "abandoned_carts", (q) => q.gte("created_at", iso(180)).eq("recovered", false));
    const sent = await count(admin, "abandoned_carts", (q) =>
      q.gte("created_at", iso(180)).not("recovery_sent_at", "is", null));
    const bad = carts >= 20 && sent === 0;
    out.push({
      key: "signal:cart_recovery",
      label: "Abandoned cart recovery engine",
      ok: !bad,
      detail: `${sent} of ${carts} abandoned carts had recovery sent in the last 3 hours`,
    });
  } catch (e) { console.error("signal cart_recovery", (e as Error).message); }

  // 13) Store wallets exhausted — negative balance blocks WhatsApp sending for that store.
  try {
    const { data: w } = await admin.from("store_wallets").select("store_id, balance").lt("balance", -20).limit(50);
    const list = ((w as any[]) || []);
    out.push({
      key: "signal:store_wallet_block",
      label: "Store wallet balance",
      ok: list.length === 0,
      detail: list.length
        ? `${list.length} store wallets are below -₹20 — WhatsApp sending is blocked for them`
        : "All store wallets above the blocking threshold",
    });
  } catch (e) { console.error("signal store_wallet_block", (e as Error).message); }

  // 14) Checkout API failures — customers can't complete purchases.
  try {
    const errs = await count(admin, "error_logs", (q) =>
      q.gte("created_at", iso(30))
        .in("level", ["error", "fatal"])
        .or("message.ilike.%checkout%,message.ilike.%place-order%,message.ilike.%order creation%"));
    out.push({
      key: "signal:checkout_api_errors",
      label: "Checkout API errors",
      ok: errs < 10,
      detail: `${errs} checkout/place-order errors in the last 30 minutes (alert above 10)`,
    });
  } catch (e) { console.error("signal checkout_api_errors", (e as Error).message); }

  // 15) Auth/signup/OTP failures — merchants can't log in or verify.
  try {
    const errs = await count(admin, "error_logs", (q) =>
      q.gte("created_at", iso(30))
        .in("level", ["error", "fatal"])
        .or("message.ilike.%signup%,message.ilike.%login%,message.ilike.%otp%,message.ilike.%verify%,message.ilike.%auth%"));
    out.push({
      key: "signal:auth_failures",
      label: "Auth & signup failures",
      ok: errs < 10,
      detail: `${errs} auth/signup/OTP errors in the last 30 minutes (alert above 10)`,
    });
  } catch (e) { console.error("signal auth_failures", (e as Error).message); }

  // 16-19) Per-gateway error rates — helps identify which provider is down.
  async function gatewaySignal(admin: any, key: string, label: string, pattern: string, limit: number) {
    try {
      const errs = await count(admin, "error_logs", (q) =>
        q.gte("created_at", iso(30))
          .in("level", ["error", "fatal"])
          .ilike("message", `%${pattern}%`));
      out.push({
        key: `signal:gateway_${key}`,
        label: `${label} gateway health`,
        ok: errs < limit,
        detail: `${errs} ${label} errors in the last 30 minutes (alert above ${limit})`,
      });
    } catch (e) { console.error(`signal gateway_${key}`, (e as Error).message); }
  }
  await gatewaySignal(admin, "razorpay", "Razorpay", "razorpay", 5);
  await gatewaySignal(admin, "cashfree", "Cashfree", "cashfree", 5);
  await gatewaySignal(admin, "payu", "PayU", "payu", 5);
  await gatewaySignal(admin, "upi", "UPI / QR", "upi", 5);

  // 20) WhatsApp marketing queue stuck — campaign messages not draining.
  try {
    const stuck = await count(admin, "wa_marketing_attempts", (q) =>
      q.in("status", ["queued", "pending", "processing"]).lt("scheduled_at", iso(30)));
    out.push({
      key: "signal:wa_marketing_queue",
      label: "WhatsApp marketing queue",
      ok: stuck < 100,
      detail: `${stuck} marketing messages waiting over 30 minutes (alert above 100)`,
    });
  } catch (e) { console.error("signal wa_marketing_queue", (e as Error).message); }

  // 21) Aggregate payment conversion rate — same as checkout_stall but over a longer window.
  try {
    const created = await count(admin, "orders", (q) => q.gte("created_at", iso(120)));
    const paid = await count(admin, "orders", (q) => q.gte("created_at", iso(120)).in("status", PAID));
    const rate = created ? paid / created : 1;
    const bad = created >= 30 && rate < 0.08;
    out.push({
      key: "signal:payment_conversion_rate",
      label: "2-hour payment conversion rate",
      ok: !bad,
      detail: `${paid}/${created} orders paid in the last 2 hours (${Math.round(rate * 100)}%, alert below 8%)`,
    });
  } catch (e) { console.error("signal payment_conversion_rate", (e as Error).message); }

  // 22) Fatal errors — any unhandled crash in the last 15 minutes.
  try {
    const errs = await count(admin, "error_logs", (q) => q.gte("created_at", iso(15)).eq("level", "fatal"));
    out.push({
      key: "signal:fatal_errors",
      label: "Fatal application errors",
      ok: errs < 3,
      detail: `${errs} fatal errors in the last 15 minutes (alert above 3)`,
    });
  } catch (e) { console.error("signal fatal_errors", (e as Error).message); }

  // ── CHECKOUT & PAYMENT PATH (client-side truth, not just server logs) ──────

  // 23) UPI app launch failures — shoppers tap GPay/PhonePe/Paytm but no app opens.
  try {
    const { data: rows } = await admin
      .from("storefront_events")
      .select("event_name, metadata")
      .gte("created_at", iso(60))
      .in("event_name", ["pay_click", "payment_failed"])
      .limit(4000);
    const list = ((rows as any[]) || []);
    const upiTaps = list.filter((r) =>
      r.event_name === "pay_click" && /^upi_/.test(String(r?.metadata?.method || ""))).length;
    const launchFails = list.filter((r) => {
      if (r.event_name !== "payment_failed") return false;
      const reason = String(r?.metadata?.reason || "");
      return /no_upi_app|not_installed|launch|intent/i.test(reason);
    }).length;
    const ratio = upiTaps ? launchFails / upiTaps : 0;
    const bad = launchFails >= 5 && ratio >= 0.25;
    out.push({
      key: "signal:upi_launch_failures",
      label: "UPI app launch (GPay/PhonePe/Paytm)",
      ok: !bad,
      detail: `${launchFails} UPI apps failed to open out of ${upiTaps} taps in 60 min (${Math.round(ratio * 100)}%, alert above 25%)`,
    });
  } catch (e) { console.error("signal upi_launch_failures", (e as Error).message); }

  // 24) Pay tap blocked before the gateway — address gate / minting / retap loops.
  try {
    const { data: rows } = await admin
      .from("storefront_events")
      .select("metadata")
      .gte("created_at", iso(60))
      .eq("event_name", "pay_click")
      .limit(4000);
    const list = ((rows as any[]) || []);
    const tagged = list.filter((r) => !!r?.metadata?.outcome);
    const blocked = tagged.filter((r) =>
      /address_gate|queued_|retap_prompt|failed/i.test(String(r?.metadata?.outcome || ""))).length;
    const ratio = tagged.length ? blocked / tagged.length : 0;
    const bad = tagged.length >= 12 && ratio >= 0.5;
    out.push({
      key: "signal:pay_tap_blocked",
      label: "Pay button reaching the gateway",
      ok: !bad,
      detail: `${blocked}/${tagged.length} pay taps did not reach a payment app in 60 min (${Math.round(ratio * 100)}%, alert above 50%)`,
    });
  } catch (e) { console.error("signal pay_tap_blocked", (e as Error).message); }

  // 25) Pay-click blackout — shoppers are tapping pay but nothing is completing.
  try {
    const taps = await count(admin, "storefront_events", (q) =>
      q.gte("created_at", iso(45)).eq("event_name", "pay_click"));
    const buys = await count(admin, "storefront_events", (q) =>
      q.gte("created_at", iso(45)).eq("event_name", "purchase"));
    const bad = taps >= 15 && buys === 0;
    out.push({
      key: "signal:pay_click_blackout",
      label: "Pay tap to purchase completion",
      ok: !bad,
      detail: `${taps} pay taps and ${buys} completed purchases in the last 45 minutes`,
    });
  } catch (e) { console.error("signal pay_click_blackout", (e as Error).message); }

  // 26) Payment/checkout APIs alive — synthetic probe of the functions checkout calls.
  try {
    const fns = ["place-order", "create-upi-intent", "payu-create-txn", "store-cashfree-create-order", "order-payment-status"];
    const dead: string[] = [];
    await Promise.all(fns.map(async (fn) => {
      try {
        const ctl = new AbortController();
        const t = setTimeout(() => ctl.abort(), 10_000);
        const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
          method: "OPTIONS",
          headers: { "Access-Control-Request-Method": "POST", Origin: "https://shopbanao.in" },
          signal: ctl.signal,
        });
        clearTimeout(t);
        if (res.status >= 500 || res.status === 404) dead.push(`${fn} (${res.status})`);
      } catch { dead.push(`${fn} (no response)`); }
    }));
    out.push({
      key: "signal:payment_api_reachable",
      label: "Checkout & payment APIs reachable",
      ok: dead.length === 0,
      detail: dead.length ? `Not responding: ${dead.join(", ")}` : `All ${fns.length} checkout/payment functions responding`,
    });
  } catch (e) { console.error("signal payment_api_reachable", (e as Error).message); }

  // 27) Payment provider reachability — is PayU / Cashfree / Razorpay itself up?
  try {
    const hosts: Array<[string, string]> = [
      ["PayU", "https://secure.payu.in/_payment"],
      ["Cashfree", "https://api.cashfree.com/pg/orders"],
      ["Razorpay", "https://api.razorpay.com/v1/orders"],
    ];
    const dead: string[] = [];
    await Promise.all(hosts.map(async ([name, url]) => {
      try {
        const ctl = new AbortController();
        const t = setTimeout(() => ctl.abort(), 10_000);
        const res = await fetch(url, { method: "GET", signal: ctl.signal });
        clearTimeout(t);
        // Any HTTP answer (401/405/400) proves the provider is alive; 5xx means trouble.
        if (res.status >= 500) dead.push(`${name} (${res.status})`);
      } catch { dead.push(`${name} (unreachable)`); }
    }));
    out.push({
      key: "signal:gateway_reachability",
      label: "Payment provider reachability",
      ok: dead.length === 0,
      detail: dead.length ? `Provider problems: ${dead.join(", ")}` : "PayU, Cashfree and Razorpay all responding",
    });
  } catch (e) { console.error("signal gateway_reachability", (e as Error).message); }

  // 28) Payment attempts started at the gateway but never confirmed.
  try {
    const { data: rows } = await admin
      .from("orders")
      .select("id, status, payu_txnids")
      .gte("created_at", iso(150))
      .lte("created_at", iso(25))
      .limit(500);
    const attempted = ((rows as any[]) || []).filter((r) =>
      Array.isArray(r?.payu_txnids) && r.payu_txnids.length > 0);
    const settled = attempted.filter((r) => PAID.includes(String(r.status))).length;
    const bad = attempted.length >= 8 && settled === 0;
    out.push({
      key: "signal:gateway_attempts_unsettled",
      label: "Gateway payments settling back",
      ok: !bad,
      detail: `${settled}/${attempted.length} gateway payment attempts confirmed (orders 25–150 min old)`,
    });
  } catch (e) { console.error("signal gateway_attempts_unsettled", (e as Error).message); }

  // 29) Stores advertising online payment with missing/broken credentials.
  try {
    const { data: cfg } = await admin
      .from("store_payment_config")
      .select("store_id, payment_methods, razorpay_key_id, cashfree_app_id, payu_merchant_key, upi_id")
      .limit(1000);
    const broken = ((cfg as any[]) || []).filter((c) => {
      const m: string[] = Array.isArray(c?.payment_methods) ? c.payment_methods : [];
      if (m.includes("razorpay") && !c.razorpay_key_id) return true;
      if (m.includes("cashfree") && !c.cashfree_app_id) return true;
      if (m.includes("payu") && !c.payu_merchant_key) return true;
      if (m.includes("upi") && !c.upi_id) return true;
      return false;
    });
    out.push({
      key: "signal:payment_config_broken",
      label: "Store payment configuration",
      ok: broken.length === 0,
      detail: broken.length
        ? `${broken.length} stores show an online payment method with missing credentials`
        : "All stores with online payment have credentials configured",
    });
  } catch (e) { console.error("signal payment_config_broken", (e as Error).message); }

  return out;

}

async function sendAlert(admin: any, headline: string, target: string, detail: string) {
  const { data: recips } = await admin.from("uptime_alert_recipients").select("phone").eq("enabled", true);
  const { data: secretRow } = await admin.from("cron_auth").select("secret").limit(1).maybeSingle();
  const cronSecret = (secretRow as any)?.secret || Deno.env.get("CRON_SECRET") || "";
  for (const r of ((recips as any[]) || [])) {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/wa-platform-send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SERVICE_ROLE}`,
          "x-cron-secret": cronSecret,
        },
        body: JSON.stringify({
          mode: "automation",
          recipient_phone: String(r.phone),
          template_name: "platform_alert_v1",
          message_type: "platform_alert",
          template_params: [headline.slice(0, 120), target.slice(0, 120), detail.slice(0, 300), istNow()],
        }),
      });
      if (!res.ok) console.error("signal alert http", res.status, (await res.text()).slice(0, 200));
    } catch (e) { console.error("signal alert send failed", (e as Error).message); }
  }
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const bearer = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const cronSecret = req.headers.get("x-cron-secret") || "";
  let authed = !!SERVICE_ROLE && bearer === SERVICE_ROLE;
  if (!authed && cronSecret) {
    const { data } = await admin.rpc("verify_cron_secret", { _secret: cronSecret });
    authed = data === true;
  }
  if (!authed) return j({ error: "unauthorized" }, 401);

  const signals = await evaluate(admin);
  const nowIso = new Date().toISOString();

  for (const s of signals) {
    // Virtual target row (enabled=false → the HTTP prober never touches it).
    await admin.from("uptime_targets").upsert(
      { target_key: s.key, label: s.label, url: s.key, kind: "signal", enabled: false },
      { onConflict: "target_key", ignoreDuplicates: false },
    );
    const { data: t } = await admin
      .from("uptime_targets")
      .select("id, state, consecutive_failures")
      .eq("target_key", s.key)
      .maybeSingle();
    if (!t) continue;

    const fails = s.ok ? 0 : ((t as any).consecutive_failures || 0) + 1;
    const nextState = s.ok ? "up" : fails >= FAIL_THRESHOLD ? "down" : (t as any).state || "up";

    await admin.from("uptime_targets").update({
      last_checked_at: nowIso,
      consecutive_failures: fails,
      state: nextState,
      last_error: s.ok ? null : s.detail,
    }).eq("id", (t as any).id);

    await admin.from("uptime_checks").insert({
      target_id: (t as any).id, ok: s.ok, status_code: null, latency_ms: null, error: s.ok ? null : s.detail,
    });

    if (nextState === "down" && ((t as any).state || "up") !== "down") {
      const { data: inc } = await admin
        .from("uptime_incidents")
        .insert({ target_id: (t as any).id, label: s.label, url: s.key, last_error: s.detail, checks_failed: fails })
        .select("id").maybeSingle();
      await sendAlert(admin, "BUSINESS ALERT: something is broken", s.label, s.detail);
      if (inc) await admin.from("uptime_incidents").update({ alerted: true }).eq("id", (inc as any).id);
    } else if (s.ok && ((t as any).state || "up") === "down") {
      const { data: open } = await admin
        .from("uptime_incidents").select("id, started_at")
        .eq("target_id", (t as any).id).is("resolved_at", null)
        .order("started_at", { ascending: false }).limit(1).maybeSingle();
      if (open) {
        const mins = Math.max(1, Math.round((Date.now() - new Date((open as any).started_at).getTime()) / 60000));
        await admin.from("uptime_incidents").update({ resolved_at: nowIso }).eq("id", (open as any).id);
        await sendAlert(admin, "RECOVERED: back to normal", s.label, `Issue lasted about ${mins} min. ${s.detail}`);
      }
    }
  }

  return j({ ok: true, signals });
});
