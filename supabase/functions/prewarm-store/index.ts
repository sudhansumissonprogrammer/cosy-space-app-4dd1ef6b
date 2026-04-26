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

    // Build prewarm URLs — warm Worker caches.
    //
    // Optimization (2026-04): When a custom domain exists, ONLY warm the custom
    // domain. Paying customers' real shopper traffic goes to the custom domain;
    // the subdomain ({slug}.shopbanao.in) is just a fallback / admin URL and
    // can cold-warm naturally on the rare visit. This halves Worker subrequests
    // and KV writes for custom-domain stores. Purge still hits both hostnames
    // (handled in src/lib/purgeStoreCache.ts) so the subdomain edge cache
    // remains consistent — only proactive warming is skipped.
    if (domain) {
      const domParams = new URLSearchParams({ slug, domain });
      prewarmUrls.push(`https://${domain}/api/prewarm?${domParams}`);
    } else {
      const subParams = new URLSearchParams({ slug });
      prewarmUrls.push(`https://${slug}.${ROOT_DOMAIN}/api/prewarm?${subParams}`);
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
