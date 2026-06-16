import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Shared in-memory rate limiter.
// IMPORTANT: real ad traffic from mobile carriers and Cloudflare often shares
// IPs across many users (NAT). A low global per-IP limit silently drops real
// pageviews and undercounts analytics by 70-90%. Keep this generous; it only
// exists to block obvious abuse, not to throttle real visitors.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 600; // ~10/sec sustained per IP+store
const WINDOW_MS = 60_000;

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

// Tier-1 #2: 30s page_view dedupe (see handlePageView below).
const _pvDedup = new Map<string, number>();
const PV_DEDUP_TTL_MS = 30_000;

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// ── Error logging handler ───────────────────────────────────────

async function handleError(req: Request) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await req.json();
  const { message, context, stack, level, url, user_agent, metadata } = body;

  if (!message || typeof message !== "string") {
    return new Response(JSON.stringify({ error: "message required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Drop info-level noise at the source — only persist 'error' and 'warn'.
  // 'info' rows were the largest contributor to error_logs growth (~1.5 MB table).
  // Returning ok:true keeps clients quiet without an extra round-trip cost.
  const normalizedLevel = ["error", "warn", "info"].includes(level) ? level : "error";
  if (normalizedLevel === "info") {
    return new Response(JSON.stringify({ ok: true, dropped: "info" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = getSupabase();
  const { error } = await supabase.from("error_logs").insert({
    message: String(message).slice(0, 500),
    context: context ? String(context).slice(0, 100) : null,
    stack: stack ? String(stack).slice(0, 2000) : null,
    level: normalizedLevel,
    url: url ? String(url).slice(0, 500) : null,
    user_agent: user_agent ? String(user_agent).slice(0, 300) : null,
    metadata: metadata && typeof metadata === "object" ? metadata : null,
  });

  if (error) {
    return new Response(JSON.stringify({ error: "Failed to log" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Page view tracking handler ──────────────────────────────────

// Tier-2 #A: skip bots + PWA standalone hits. Bots = ~15-25% of writes,
// PWA repeat visitors = ~10-15%. Returning ok:true silently drops them
// without any client retry/log noise.
const BOT_UA_RX = /bot|crawler|spider|crawling|facebookexternalhit|whatsapp|telegram|slack|discord|preview|fetch|curl|wget|headless|lighthouse|gtmetrix|pagespeed|pingdom|uptimerobot|monitor|axios\/|python-requests|go-http-client|java\/|okhttp/i;

async function handleView(req: Request) {
  // Dashboard analytics are computed from public.page_views — this handler
  // MUST write rows. (Previous INGEST_VIEW_NOOP escape hatch removed; it was
  // silently dropping ~100% of traffic when the env var lingered as "true".)

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";

  const url = new URL(req.url);
  const ua = req.headers.get("user-agent") || "";

  // Skip bot UAs at the edge — no DB write, no invocation cost beyond fn entry.
  if (BOT_UA_RX.test(ua)) {
    return new Response(JSON.stringify({ ok: true, dropped: "bot_ua" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Skip PWA standalone sessions — these are repeat visitors already counted
  // on first install, and they generate 5-10x more pageviews per user.
  if (url.searchParams.get("source") === "pwa") {
    return new Response(JSON.stringify({ ok: true, dropped: "pwa" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { body = {}; }
  const store_id = body.store_id as string | undefined;
  if (!store_id) {
    return new Response(JSON.stringify({ error: "store_id required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Rate limit per IP+store so a shared mobile/CF NAT IP visiting one store
  // doesn't block other stores' analytics. 204 = silent drop, no client retry.
  if (isRateLimited(`${ip}:${store_id}`)) {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Filter out non-page paths so analytics only counts real visitor pageviews.
  const cleanPath = ((body.path as string) || "/").toString().slice(0, 500);
  const isNonPage =
    cleanPath.startsWith("/~api/") ||
    cleanPath.startsWith("/api/") ||
    cleanPath.startsWith("/cf-img") ||
    cleanPath.startsWith("/_") ||
    /\.(js|css|map|png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|otf|json|xml|txt)(\?|$)/i.test(cleanPath);

  if (isNonPage) {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // 30s dedupe per (store, ip, path).
  const dedupKey = `${store_id}:${ip}:${cleanPath}`;
  const nowMs = Date.now();
  const lastTs = _pvDedup.get(dedupKey);
  if (lastTs && nowMs - lastTs < PV_DEDUP_TTL_MS) {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  _pvDedup.set(dedupKey, nowMs);
  if (_pvDedup.size > 5000) {
    for (const [k, t] of _pvDedup) {
      if (nowMs - t > PV_DEDUP_TTL_MS) _pvDedup.delete(k);
    }
  }

  // Capture full dimensions so dashboard analytics (sessions, unique visitors,
  // referrer/UTM/device breakdowns) work end-to-end. Sanitize/trim everything
  // the client sent — never trust raw beacon input.
  const str = (v: unknown, max = 200) =>
    typeof v === "string" && v.length ? v.slice(0, max) : null;

  const supabase = getSupabase();
  await supabase.from("page_views").insert({
    store_id,
    path: cleanPath,
    visitor_id: str(body.visitor_id, 100),
    session_id: str(body.session_id, 100),
    is_bot: body.is_bot === true,
    referrer: str(body.referrer, 500),
    utm_source: str(body.utm_source, 100),
    utm_medium: str(body.utm_medium, 100),
    utm_campaign: str(body.utm_campaign, 200),
    utm_term: str(body.utm_term, 200),
    utm_content: str(body.utm_content, 200),
    country: str(req.headers.get("cf-ipcountry") || (body.country as string), 4),
    device: str(body.device, 32),
    browser: str(body.browser, 32),
    os: str(body.os, 32),
    landing_path: str(body.landing_path, 200),
  });

  // 204 on success so the client beacon's "status===204 = handled" check
  // passes and doesn't trigger its PostgREST fallback (double-write).
  return new Response(null, { status: 204, headers: corsHeaders });
}

// ── DB cleanup handler ──────────────────────────────────────────

async function handleCleanup(req: Request) {
  // SECURITY: this endpoint deletes data from many tables. It must require a
  // real admin JWT — not just a "Bearer " prefix (which the public anon key
  // satisfies). We validate the token and check the user has the admin role.
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );
  const { data: claims, error: claimsErr } = await authClient.auth.getClaims(token);
  if (claimsErr || !claims?.claims?.sub) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = getSupabase();
  const { data: isAdmin, error: roleErr } = await admin.rpc("has_role", {
    _user_id: claims.claims.sub,
    _role: "admin",
  });
  if (roleErr || !isAdmin) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = admin;
  const results: Record<string, number> = {};

  // 1. Delete page_views older than 90 days
  const { count: pvCount } = await supabase
    .from("page_views")
    .delete({ count: "exact" })
    .lt("created_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());
  results.page_views_deleted = pvCount ?? 0;

  // 2. Delete abandoned_carts older than 7 days (unrecovered only)
  const { count: acCount } = await supabase
    .from("abandoned_carts")
    .delete({ count: "exact" })
    .eq("recovered", false)
    .lt("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
  results.abandoned_carts_deleted = acCount ?? 0;

  // 3. Delete email_send_log older than 14 days
  const { count: elCount } = await supabase
    .from("email_send_log")
    .delete({ count: "exact" })
    .lt("created_at", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString());
  results.email_send_log_deleted = elCount ?? 0;

  // 4. Delete whatsapp_messages older than 30 days
  const { count: wmCount } = await supabase
    .from("whatsapp_messages")
    .delete({ count: "exact" })
    .lt("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
  results.whatsapp_messages_deleted = wmCount ?? 0;

  // 5. Delete error_logs older than 30 days
  const { count: errCount } = await supabase
    .from("error_logs")
    .delete({ count: "exact" })
    .lt("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
  results.error_logs_deleted = errCount ?? 0;

  // 6. Tier-2 #I: delete customer_leads older than 180 days (keeps table bounded)
  const { count: leadCount } = await supabase
    .from("customer_leads")
    .delete({ count: "exact" })
    .lt("created_at", new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString());
  results.customer_leads_deleted = leadCount ?? 0;

  console.log("[ingest/cleanup] Results:", results);

  return new Response(JSON.stringify({ success: true, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Router ──────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const type = url.searchParams.get("type") || "view";

  try {
    switch (type) {
      case "error":
        return await handleError(req);
      case "view":
        return await handleView(req);
      case "cleanup":
        return await handleCleanup(req);
      default:
        return new Response(JSON.stringify({ error: `Unknown type: ${type}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
