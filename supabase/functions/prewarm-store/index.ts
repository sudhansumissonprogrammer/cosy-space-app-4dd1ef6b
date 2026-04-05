/**
 * prewarm-store Edge Function
 *
 * Called after: store creation, custom domain connect, product changes.
 * Warms all Cloudflare Worker caches so first user gets instant response.
 *
 * Usage:
 *   POST /functions/v1/prewarm-store
 *   Body: { slug: "my-store", domain?: "mystore.com" }
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ROOT_DOMAIN = "shopbanao.in";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let slug: string | null = null;
    let domain: string | null = null;

    const url = new URL(req.url);
    if (req.headers.get("content-type")?.includes("application/json")) {
      try {
        const body = await req.json();
        slug = body.slug || null;
        domain = body.domain || null;
      } catch {
        // fallback to query params
      }
    }
    slug = slug || url.searchParams.get("slug");
    domain = domain || url.searchParams.get("domain");

    if (!slug) {
      return new Response(
        JSON.stringify({ error: "Missing slug parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: Record<string, unknown> = {};

    // Build prewarm URLs — warm both subdomain and custom domain Worker caches
    const prewarmUrls: string[] = [];

    // 1. Always warm via subdomain
    const subParams = new URLSearchParams({ slug });
    if (domain) subParams.set("domain", domain);
    prewarmUrls.push(`https://${slug}.${ROOT_DOMAIN}/api/prewarm?${subParams}`);

    // 2. If custom domain exists, also warm directly on that domain
    if (domain) {
      const domParams = new URLSearchParams({ slug, domain });
      prewarmUrls.push(`https://${domain}/api/prewarm?${domParams}`);
    }

    // Fire all prewarm requests in parallel (15s timeout each)
    const prewarmResults = await Promise.allSettled(
      prewarmUrls.map(async (prewarmUrl) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15_000);
        try {
          const res = await fetch(prewarmUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ slug, domain }),
            signal: controller.signal,
          });
          clearTimeout(timeout);
          const data = await res.json().catch(() => ({}));
          return { url: prewarmUrl, status: res.status, data };
        } catch (err) {
          clearTimeout(timeout);
          return { url: prewarmUrl, error: String(err) };
        }
      })
    );

    results.targets = prewarmResults.map((r) =>
      r.status === "fulfilled" ? r.value : { error: String(r.reason) }
    );

    return new Response(
      JSON.stringify({ success: true, slug, domain, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
