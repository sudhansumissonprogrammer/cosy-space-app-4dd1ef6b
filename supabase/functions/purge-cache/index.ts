// supabase/functions/purge-cache/index.ts
//
// Authenticated proxy for Cloudflare Worker /api/purge-* endpoints.
//
// Why this exists: the worker now requires a `x-purge-secret` header (fail-closed)
// to prevent anonymous cache-DoS. We don't want to ship that secret to the browser,
// so the dashboard calls THIS edge function with the user's JWT. The function:
//   1) verifies the JWT
//   2) confirms the user owns the store-slug being purged
//   3) calls the worker with the shared secret from env
//
// Required env vars:
//   - WORKER_PURGE_SECRET : same value set as PURGE_SECRET on the Cloudflare Worker
//
// POST body: { slug: string, customDomain?: string|null, shell?: boolean }

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const PURGE_SECRET = Deno.env.get("WORKER_PURGE_SECRET") || "";

    if (!PURGE_SECRET) {
      console.error("WORKER_PURGE_SECRET not configured");
      return json({ error: "Server not configured" }, 500);
    }

    // 1) Verify caller: user JWT, or internal cron secret (ops/automation).
    const adminEarly = createClient(SUPABASE_URL, SERVICE_ROLE);
    const providedCron = req.headers.get("x-cron-secret") || "";
    let isCron = false;
    if (providedCron) {
      if (providedCron === (Deno.env.get("CRON_SECRET") || "\u0000")) {
        isCron = true;
      } else {
        const { data: row } = await adminEarly.from("cron_auth").select("secret").maybeSingle();
        isCron = !!row?.secret && row.secret === providedCron;
      }
    }

    let userId: string | undefined;
    if (!isCron) {
      const authHeader = req.headers.get("Authorization") || "";
      const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
      if (!bearer) return json({ error: "Unauthorized" }, 401);

      const authClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${bearer}` } },
      });
      const { data: claimsRes, error: claimsErr } = await authClient.auth.getClaims(bearer);
      userId = claimsRes?.claims?.sub;
      if (claimsErr || !userId) return json({ error: "Unauthorized" }, 401);
    }

    // 2) Parse + validate input
    const body = await req.json().catch(() => null);
    const slug = typeof body?.slug === "string" ? body.slug.trim().toLowerCase() : "";
    const customDomain = typeof body?.customDomain === "string"
      ? body.customDomain.replace(/^www\./, "").toLowerCase().trim()
      : "";
    const shell = body?.shell === true;
    if (!slug || !/^[a-z0-9-]{2,64}$/.test(slug)) return json({ error: "Invalid slug" }, 400);
    if (customDomain && !/^[a-z0-9.-]{3,253}$/.test(customDomain)) {
      return json({ error: "Invalid customDomain" }, 400);
    }

    // 3) Confirm caller owns the store (or is admin)
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: store } = await admin
      .from("stores")
      .select("id, slug, owner_id, custom_domain")
      .eq("slug", slug)
      .maybeSingle();
    if (!store) return json({ error: "Store not found" }, 404);

    let owns = isCron || store.owner_id === userId;
    if (!owns && userId) {
      const { data: adminRow } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      owns = !!adminRow;
    }
    if (!owns) return json({ error: "Forbidden" }, 403);

    // 4) Call the worker with the shared secret
    const cleanDomain = customDomain || (store.custom_domain || "").replace(/^www\./, "").toLowerCase().trim();
    const bases = [`https://${slug}.shopbanao.in`];
    if (cleanDomain) bases.push(`https://${cleanDomain}`);
    const params = new URLSearchParams({ slug });
    if (cleanDomain) params.set("domain", cleanDomain);

    const headers = { "x-purge-secret": PURGE_SECRET, "Cache-Control": "no-store" };

    const calls: Promise<Response | null>[] = [];
    for (const base of bases) {
      calls.push(
        fetch(`${base}/api/purge-store?${params.toString()}`, { method: "POST", headers }).catch(() => null),
      );
      if (shell) {
        calls.push(
          fetch(`${base}/api/purge-shell?${params.toString()}`, { method: "POST", headers }).catch(() => null),
        );
      }
    }
    const results = await Promise.allSettled(calls);
    const ok = results.every((r) => r.status === "fulfilled" && !!(r.value as Response | null)?.ok);
    return json({ ok, calls: results.length });
  } catch (err) {
    console.error("purge-cache error:", (err as Error).message);
    return json({ error: "Internal error" }, 500);
  }
});
