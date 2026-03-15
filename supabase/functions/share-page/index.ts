import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ROOT_DOMAIN = "storivo.in";

function escapeHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");

  if (!slug) {
    return new Response("Missing slug", { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: store, error } = await supabase
    .from("stores")
    .select("name, description, meta_title, meta_description, og_image_url, logo_url, banner_url, slug")
    .eq("slug", slug)
    .single();

  if (error || !store) {
    return new Response("Store not found", { status: 404 });
  }

  const storeUrl = `https://${slug}.${ROOT_DOMAIN}`;
  const title = escapeHtml(store.meta_title || store.name);
  const description = escapeHtml(store.meta_description || store.description || `Shop at ${store.name}`);
  const image = store.og_image_url || store.banner_url || store.logo_url || "";

  // Serve a lightweight HTML page:
  // - Social crawlers read the OG tags
  // - Human visitors get redirected immediately via JS + meta refresh
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}">
  
  <!-- Open Graph -->
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:url" content="${escapeHtml(storeUrl)}">
  <meta property="og:type" content="website">
  ${image ? `<meta property="og:image" content="${escapeHtml(image)}">` : ""}
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  ${image ? `<meta name="twitter:image" content="${escapeHtml(image)}">` : ""}
  
  <link rel="canonical" href="${escapeHtml(storeUrl)}">
  
  <!-- Redirect humans to the actual store -->
  <meta http-equiv="refresh" content="0;url=${escapeHtml(storeUrl)}">
  <script>window.location.replace("${storeUrl}");</script>
  
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #fafafa; color: #333; }
    .card { text-align: center; padding: 2rem; }
    a { color: #2563eb; text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <p>Redirecting to <a href="${escapeHtml(storeUrl)}">${escapeHtml(store.name)}</a>...</p>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=3600",
    },
  });
});
