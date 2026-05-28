/**
 * prewarm-cron — fires every 15 min via pg_cron.
 *
 * Walks all stores that have shopper traffic potential (custom_domain set
 * OR active in last 7 days) and triggers prewarm-store for each so the
 * Cloudflare Worker edge cache stays hot. Result: cold-load TTFB stays
 * ~150ms instead of climbing back to 1.5s when CF Cache evicts (~30 min idle).
 *
 * Concurrency-bounded (8 in flight) and timeboxed (45s wall) so a single
 * slow domain can never starve the whole batch.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PREWARM_FN_URL = `${SUPABASE_URL}/functions/v1/prewarm-store`;
const CONCURRENCY = 8;
const WALL_MS = 45_000;

async function callPrewarm(slug: string, domain: string | null) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(PREWARM_FN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_ROLE}`,
      },
      body: JSON.stringify({ slug, domain: domain || undefined }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    return { slug, domain, status: res.status };
  } catch (err) {
    clearTimeout(t);
    return { slug, domain, error: String(err) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Auth: accept either the dedicated env secret (manual runs) or a DB-issued
  // cron secret (what pg_cron sends, verified via SECURITY DEFINER RPC).
  const provided = req.headers.get("x-cron-secret") || "";
  const envSecret = Deno.env.get("PREWARM_CRON_SECRET") || "";
  let ok = !!provided && provided === envSecret;
  if (!ok && provided) {
    const { data } = await supabase.rpc("verify_cron_secret", { _secret: provided });
    ok = data === true;
  }
  if (!ok) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const startedAt = Date.now();


  // v8.5.0 cost-cut: tightened activity window 24h -> 6h. Combined with the
  // pg_cron schedule moving from */15 -> */30, this cuts Worker AMS
  // invocations roughly 4x (cron half as often, fewer stores per run).
  // Custom-domain stores still always warm. Quiet stores pay a one-time
  // ~300ms cold hit on the next visitor — acceptable given they had no
  // traffic in the prior 6h.
  const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const { data: activeRows, error: activeErr } = await supabase
    .from("page_views")
    .select("store_id")
    .gte("created_at", since)
    .limit(10000);

  if (activeErr) {
    return new Response(JSON.stringify({ error: activeErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const activeIds = Array.from(new Set((activeRows || []).map((r: any) => r.store_id).filter(Boolean)));

  // Always include stores with a custom domain even if quiet today.
  const { data: domainRows } = await supabase
    .from("stores")
    .select("id, slug, custom_domain")
    .not("custom_domain", "is", null)
    .limit(500);

  const { data: activeStores } = activeIds.length
    ? await supabase.from("stores").select("id, slug, custom_domain").in("id", activeIds)
    : { data: [] as any[] };

  const map = new Map<string, { slug: string; custom_domain: string | null }>();
  for (const s of [...(domainRows || []), ...(activeStores || [])]) {
    if (s?.slug) map.set(s.id, { slug: s.slug, custom_domain: s.custom_domain ?? null });
  }
  const stores = Array.from(map.values());
  const error = null as { message: string } | null;

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const targets = (stores || []).filter((s) => s.slug);
  const results: any[] = [];

  // Bounded concurrency worker pool
  let i = 0;
  async function worker() {
    while (i < targets.length && Date.now() - startedAt < WALL_MS) {
      const idx = i++;
      const s = targets[idx];
      results.push(await callPrewarm(s.slug, s.custom_domain ?? null));
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  return new Response(
    JSON.stringify({
      ok: true,
      total: targets.length,
      processed: results.length,
      durationMs: Date.now() - startedAt,
      results: results.slice(0, 50), // truncate verbose body
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
