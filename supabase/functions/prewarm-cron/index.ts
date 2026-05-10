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

  const startedAt = Date.now();
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Pull stores worth keeping warm — custom domain OR recently created.
  // (Schema: id, slug, custom_domain, created_at — no is_active column.)
  const { data: stores, error } = await supabase
    .from("stores")
    .select("slug, custom_domain")
    .or("custom_domain.not.is.null,created_at.gte." +
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .limit(500);

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
