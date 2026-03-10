const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ROOT_DOMAIN = "storivo.in";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");

  if (!slug) {
    return new Response("Missing slug parameter", { status: 400, headers: corsHeaders });
  }

  const sitemapUrl = `${SUPABASE_URL}/functions/v1/sitemap?slug=${slug}`;

  const robotsTxt = `User-agent: *
Allow: /
Disallow: /dashboard/
Disallow: /admin/
Disallow: /login
Disallow: /signup

Sitemap: ${sitemapUrl}

# Store: ${slug}.${ROOT_DOMAIN}
`;

  return new Response(robotsTxt, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
});
