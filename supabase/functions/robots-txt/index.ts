const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ROOT_DOMAIN = "storivo.in";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  // Allow custom domain override for sitemap URL
  const domain = url.searchParams.get("domain");

  if (!slug) {
    return new Response("Missing slug parameter", { status: 400, headers: corsHeaders });
  }

  const storeHost = domain || `${slug}.${ROOT_DOMAIN}`;
  const sitemapUrl = `https://${storeHost}/sitemap.xml`;

  const robotsTxt = `User-agent: *
Allow: /
Disallow: /dashboard/
Disallow: /admin/
Disallow: /login
Disallow: /signup
Disallow: /checkout
Disallow: /cart

Sitemap: ${sitemapUrl}

# Store: ${storeHost}
`;

  return new Response(robotsTxt, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "CDN-Cache-Control": "public, max-age=86400",
    },
  });
});
