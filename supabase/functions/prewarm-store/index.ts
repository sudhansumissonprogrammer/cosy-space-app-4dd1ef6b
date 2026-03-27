/**
 * prewarm-store Edge Function
 *
 * Called after: store creation, custom domain connect, deployment.
 * Warms all Cloudflare Worker caches so first user gets instant response.
 *
 * Usage:
 *   POST /functions/v1/prewarm-store
 *   Body: { slug: "my-store", domain?: "mystore.com" }
 *
 * Can also be called from DB triggers via pg_net.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ROOT_DOMAIN = "storivo.in";

// All known Cloudflare Worker endpoints that serve storefronts
const PREWARM_TARGETS = [
  // Subdomain endpoint (always exists)
  (slug: string) => `https://${slug}.${ROOT_DOMAIN}/api/prewarm?slug=${slug}`,
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let slug: string | null = null;
    let domain: string | null = null;

    // Accept JSON body or query params
    const url = new URL(req.url);
    if (req.headers.get("content-type")?.includes("application/json")) {
      const body = await req.json();
      slug = body.slug || null;
      domain = body.domain || null;
    }
    slug = slug || url.searchParams.get("slug");
    domain = domain || url.searchParams.get("domain");

    if (!slug) {
      return new Response(
        JSON.stringify({ error: "Missing slug parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: Record<string, any> = {};

    // Build prewarm URLs
    const prewarmUrls: string[] = [];

    // 1. Always warm via subdomain
    const subdomainUrl = `https://${slug}.${ROOT_DOMAIN}/api/prewarm?slug=${slug}${domain ? `&domain=${encodeURIComponent(domain)}` : ""}`;
    prewarmUrls.push(subdomainUrl);

    // 2. If custom domain exists, also warm directly on that domain
    if (domain) {
      const customDomainUrl = `https://${domain}/api/prewarm?slug=${slug}&domain=${encodeURIComponent(domain)}`;
      prewarmUrls.push(customDomainUrl);
    }

    // Fire all prewarm requests in parallel
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
          return { url: prewarmUrl, error: (err as Error).message };
        }
      })
    );

    results.prewarmTargets = prewarmResults.map((r) =>
      r.status === "fulfilled" ? r.value : { error: (r as PromiseRejectedResult).reason }
    );

    return new Response(
      JSON.stringify({ success: true, slug, domain, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
