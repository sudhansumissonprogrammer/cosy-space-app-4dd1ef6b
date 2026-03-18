import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

  if (!slug) {
    return new Response("Missing slug parameter", { status: 400, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Fetch store
  const { data: store, error: storeErr } = await supabase
    .from("stores")
    .select("id, slug, name, updated_at")
    .eq("slug", slug)
    .eq("is_suspended", false)
    .single();

  if (storeErr || !store) {
    return new Response("Store not found", { status: 404, headers: corsHeaders });
  }

  // Fetch active products
  const { data: products } = await supabase
    .from("products")
    .select("slug, id, updated_at, image_url, name, price, sale_price")
    .eq("store_id", store.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  // Fetch categories
  const { data: categories } = await supabase
    .from("categories")
    .select("slug, name")
    .eq("store_id", store.id);

  const baseUrl = `https://${slug}.${ROOT_DOMAIN}`;
  const now = new Date().toISOString().split("T")[0];
  const storeUpdated = store.updated_at?.split("T")[0] || now;

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <!-- Homepage -->
  <url>
    <loc>${baseUrl}</loc>
    <lastmod>${storeUpdated}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <!-- Contact -->
  <url>
    <loc>${baseUrl}/contact</loc>
    <lastmod>${storeUpdated}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <!-- Best Sellers -->
  <url>
    <loc>${baseUrl}/best-sellers</loc>
    <lastmod>${storeUpdated}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
`;

  // Category pages
  if (categories) {
    for (const cat of categories) {
      xml += `  <url>
    <loc>${baseUrl}/category/${cat.slug}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
`;
    }
  }

  // Product pages
  if (products) {
    for (const p of products) {
      const productSlug = p.slug || p.id;
      const lastmod = p.updated_at?.split("T")[0] || now;
      xml += `  <url>
    <loc>${baseUrl}/product/${productSlug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>`;
      if (p.image_url) {
        xml += `
    <image:image>
      <image:loc>${escapeXml(p.image_url)}</image:loc>
      <image:title>${escapeXml(p.name)}</image:title>
    </image:image>`;
      }
      xml += `
  </url>
`;
    }
  }

  // Policy pages
  for (const page of ["privacy-policy", "return-policy", "shipping-policy", "terms"]) {
    xml += `  <url>
    <loc>${baseUrl}/${page}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
`;
  }

  xml += `</urlset>`;

  return new Response(xml, {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=1800, s-maxage=3600",
      "CDN-Cache-Control": "public, max-age=3600",
    },
  });
});

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
