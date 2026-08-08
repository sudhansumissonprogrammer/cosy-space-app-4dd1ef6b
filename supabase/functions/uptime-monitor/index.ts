// uptime-monitor — runs every minute via pg_cron.
//
// Purpose: 24/7 synthetic monitoring of the whole storefront surface so a
// night-time breakage never burns ad spend silently.
//
// What it does each run:
//   1. Auto-syncs targets from `stores` (custom domain + platform subdomain)
//      plus fixed platform targets (landing, REST API, edge functions).
//   2. Picks the targets due for a check (round-robin by last_checked_at) and
//      probes them with a hard timeout, recording status + latency.
//   3. Opens an incident after N consecutive failures, sends ONE WhatsApp
//      alert per incident, and sends a recovery message when it heals.
//
// Everything is idempotent — safe to run every 60s.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Some runtimes only expose the newer publishable-key name; fall back so the
// REST probe never fails with a self-inflicted 401.
const ANON_KEY =
  Deno.env.get("SUPABASE_ANON_KEY") ||
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxZXBleXdnZnRicHhlZXFmdXd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMjgxMzksImV4cCI6MjA5MDkwNDEzOX0.OtLtoGBJZuEthQyePzNgAltWJwSUEpWl1z_Bx_FY6Mk";

const CONCURRENCY = 10;
const TIMEOUT_MS = 12_000;
const FAIL_THRESHOLD = 2; // consecutive failed probes before we alert
const MAX_STORE_TARGETS = 400;
const BATCH = 60; // targets probed per minute

const j = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function istNow(): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().replace("T", " ").slice(0, 16) + " IST";
}

async function probe(t: any): Promise<{ ok: boolean; status: number | null; latency: number; error: string | null }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), t.timeout_ms || TIMEOUT_MS);
  const started = Date.now();
  try {
    const res = await fetch(t.url, {
      method: t.method || "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "ShopBanaoUptime/1.0 (+https://shopbanao.in)",
        "Cache-Control": "no-cache",
        ...(t.kind === "api" ? { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } : {}),
      },
      signal: ctrl.signal,
    });
    const latency = Date.now() - started;
    let body = "";
    if (t.expect_text) body = (await res.text()).slice(0, 200_000);
    const statusOk = res.status === (t.expect_status || 200);
    const textOk = !t.expect_text || body.includes(t.expect_text);
    return {
      ok: statusOk && textOk,
      status: res.status,
      latency,
      error: statusOk ? (textOk ? null : `body missing "${t.expect_text}"`) : `HTTP ${res.status}`,
    };
  } catch (e) {
    return { ok: false, status: null, latency: Date.now() - started, error: String((e as Error).message || e).slice(0, 300) };
  } finally {
    clearTimeout(timer);
  }
}

async function sendAlert(admin: any, headline: string, target: string, detail: string) {
  const { data: recips } = await admin
    .from("uptime_alert_recipients")
    .select("phone")
    .eq("enabled", true);
  const phones = ((recips as any[]) || []).map((r) => String(r.phone));
  if (!phones.length) return;

  for (const phone of phones) {
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/wa-platform-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE}` },
        body: JSON.stringify({
          mode: "automation",
          recipient_phone: phone,
          template_name: "platform_alert_v1",
          message_type: "platform_alert",
          template_params: [
            headline.slice(0, 120),
            target.slice(0, 120),
            detail.slice(0, 300).replace(/\s+/g, " "),
            istNow(),
          ],
        }),
      });
    } catch (e) {
      console.error("alert send failed", (e as Error).message);
    }
  }
}

async function syncTargets(admin: any) {
  const fixed = [
    { key: "platform:landing", label: "ShopBanao landing", url: "https://shopbanao.in/", kind: "platform", expect_text: null },
    // PostgREST's root path always answers 401, so probe a real public read instead.
    { key: "platform:rest", label: "Database API", url: `${SUPABASE_URL}/rest/v1/stores?select=id&limit=1&apikey=${ANON_KEY}`, kind: "api", expect_status: 200, expect_text: null },
    { key: "platform:auth", label: "Login / auth service", url: `${SUPABASE_URL}/auth/v1/health`, kind: "api", expect_status: 200, expect_text: null },
    { key: "platform:functions", label: "Edge functions", url: `${SUPABASE_URL}/functions/v1/pincode-lookup?pincode=110001`, kind: "api", expect_status: 200, expect_text: null },
    { key: "platform:checkout-api", label: "Checkout / order API", url: `${SUPABASE_URL}/functions/v1/place-order`, kind: "api", method: "OPTIONS", expect_status: 200, expect_text: null },
    { key: "platform:cdn", label: "Image CDN", url: "https://cdn.shopbanao.in/product-images/2479461d-8d10-4024-aa94-f3d02adc5f80/771a3012-393c-421a-b1c9-2ca918e6917f/1779195802537-kle0wl-800w.webp", kind: "api", expect_status: 200, expect_text: null },
  ];
  for (const f of fixed) {
    await admin.from("uptime_targets").upsert(
      { target_key: f.key, label: f.label, url: f.url, kind: f.kind, method: (f as any).method ?? "GET", expect_status: (f as any).expect_status ?? 200, expect_text: f.expect_text },
      { onConflict: "target_key", ignoreDuplicates: false },
    );
  }

  const { data: stores } = await admin
    .from("stores")
    .select("id, name, slug, custom_domain, is_suspended")
    .eq("is_suspended", false)
    .limit(MAX_STORE_TARGETS);

  // Stores that took an order in the last 7 days get DEEP checks (shop grid +
  // checkout page), because those are the ones with live ad spend behind them.
  const { data: recentOrders } = await admin
    .from("orders")
    .select("store_id")
    .gte("created_at", new Date(Date.now() - 7 * 86400_000).toISOString())
    .limit(5000);
  const activeStores = new Set(((recentOrders as any[]) || []).map((o) => String(o.store_id)));

  const wantedKeys = new Set<string>();
  for (const s of ((stores as any[]) || [])) {
    const host = s.custom_domain ? `https://${String(s.custom_domain).replace(/^https?:\/\//, "")}` : `https://${s.slug}.shopbanao.in`;
    const label = s.name || s.slug;
    const rows: any[] = [
      { target_key: `store:${s.id}`, store_id: s.id, label, url: `${host}/`, kind: "storefront", expect_status: 200 },
    ];
    if (activeStores.has(String(s.id))) {
      rows.push(
        { target_key: `store:${s.id}:shop`, store_id: s.id, label: `${label} - product grid`, url: `${host}/shop`, kind: "storefront", expect_status: 200 },
        { target_key: `store:${s.id}:checkout`, store_id: s.id, label: `${label} - checkout page`, url: `${host}/checkout`, kind: "storefront", expect_status: 200 },
      );
    }
    for (const r of rows) {
      wantedKeys.add(r.target_key);
      await admin.from("uptime_targets").upsert(r, { onConflict: "target_key", ignoreDuplicates: false });
    }
  }

  // Retire targets for stores that got suspended/deleted or went inactive.
  const { data: existing } = await admin.from("uptime_targets").select("id, target_key").eq("kind", "storefront");
  const stale = ((existing as any[]) || []).filter((t) => !wantedKeys.has(t.target_key)).map((t) => t.id);
  if (stale.length) await admin.from("uptime_targets").delete().in("id", stale);
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

  const body = await req.json().catch(() => ({}));

  // Target sync is cheap but not needed every minute.
  if (body?.sync !== false) {
    const minute = new Date().getUTCMinutes();
    if (minute % 10 === 0 || body?.sync === true) await syncTargets(admin);
  }

  const dueBefore = new Date(Date.now() - 55_000).toISOString();
  const { data: targets } = await admin
    .from("uptime_targets")
    .select("*")
    .eq("enabled", true)
    .or(`last_checked_at.is.null,last_checked_at.lt.${dueBefore}`)
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .limit(BATCH);

  const list = (targets as any[]) || [];
  const results: any[] = [];
  let cursor = 0;

  async function worker() {
    while (cursor < list.length) {
      const t = list[cursor++];
      const r = await probe(t);
      results.push({ key: t.target_key, ...r });

      const nowIso = new Date().toISOString();
      const fails = r.ok ? 0 : (t.consecutive_failures || 0) + 1;
      const nextState = r.ok ? "up" : fails >= FAIL_THRESHOLD ? "down" : t.state || "up";

      await admin.from("uptime_targets").update({
        last_checked_at: nowIso,
        consecutive_failures: fails,
        state: nextState,
        last_status: r.status,
        last_latency_ms: r.latency,
        last_error: r.error,
      }).eq("id", t.id);

      // Store a check row only on failures or every 10th minute (keeps table small).
      if (!r.ok || new Date().getUTCMinutes() % 10 === 0) {
        await admin.from("uptime_checks").insert({
          target_id: t.id,
          ok: r.ok,
          status_code: r.status,
          latency_ms: r.latency,
          error: r.error,
        });
      }

      // ── Incident lifecycle ────────────────────────────────────────────────
      if (nextState === "down" && (t.state || "up") !== "down") {
        const { data: inc } = await admin
          .from("uptime_incidents")
          .insert({ target_id: t.id, label: t.label, url: t.url, last_error: r.error, checks_failed: fails })
          .select("id")
          .maybeSingle();
        await sendAlert(
          admin,
          "DOWN: storefront check failed",
          `${t.label} (${t.url})`,
          `${r.error || "no response"} - latency ${r.latency}ms`,
        );
        if (inc) await admin.from("uptime_incidents").update({ alerted: true }).eq("id", (inc as any).id);
      } else if (r.ok && (t.state || "up") === "down") {
        const { data: open } = await admin
          .from("uptime_incidents")
          .select("id, started_at")
          .eq("target_id", t.id)
          .is("resolved_at", null)
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (open) {
          const mins = Math.max(1, Math.round((Date.now() - new Date((open as any).started_at).getTime()) / 60000));
          await admin.from("uptime_incidents").update({ resolved_at: nowIso }).eq("id", (open as any).id);
          await sendAlert(
            admin,
            "RECOVERED: storefront is back online",
            `${t.label} (${t.url})`,
            `Downtime approx ${mins} min - responded in ${r.latency}ms`,
          );
        }
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, list.length || 1) }, worker));

  const down = results.filter((r) => !r.ok);
  return j({ ok: true, checked: results.length, failing: down.length, failures: down.slice(0, 20) });
});
