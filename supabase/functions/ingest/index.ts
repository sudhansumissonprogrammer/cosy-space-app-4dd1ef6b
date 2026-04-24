import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Shared in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30;
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

async function handleView(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";

  if (isRateLimited(ip)) {
    return new Response(JSON.stringify({ error: "Rate limited" }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { store_id, path } = await req.json();
  if (!store_id) {
    return new Response(JSON.stringify({ error: "store_id required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = getSupabase();
  await supabase.from("page_views").insert({
    store_id,
    path: path || "/",
    visitor_ip: ip,
  });

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── DB cleanup handler ──────────────────────────────────────────

async function handleCleanup(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = getSupabase();
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
