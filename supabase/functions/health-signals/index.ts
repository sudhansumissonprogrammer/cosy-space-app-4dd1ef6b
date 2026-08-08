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

  return out;
}

async function sendAlert(admin: any, headline: string, target: string, detail: string) {
  const { data: recips } = await admin.from("uptime_alert_recipients").select("phone").eq("enabled", true);
  for (const r of ((recips as any[]) || [])) {
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/wa-platform-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE}` },
        body: JSON.stringify({
          mode: "automation",
          phone: String(r.phone),
          template_name: "platform_alert_v1",
          message_type: "platform_alert",
          template_params: [headline.slice(0, 120), target.slice(0, 120), detail.slice(0, 300), istNow()],
        }),
      });
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
