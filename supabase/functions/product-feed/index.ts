import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug");
    const format = url.searchParams.get("format") || "xml"; // xml or csv

    if (!slug) {
      return new Response("Missing ?slug= parameter", {
        status: 400,
        headers: corsHeaders,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get store
    const { data: store, error: storeErr } = await supabase
      .from("stores")
      .select("id, name, slug, currency, custom_domain, description")
      .eq("slug", slug)
      .eq("is_suspended", false)
      .single();

    if (storeErr || !store) {
      return new Response("Store not found", { status: 404, headers: corsHeaders });
    }

    // Get active products with images
    const { data: products, error: prodErr } = await supabase
      .from("products")
      .select("id, name, description, price, sale_price, image_url, category, slug, stock_quantity, sku, is_active")
      .eq("store_id", store.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(5000);

    if (prodErr) {
      return new Response("Error fetching products", { status: 500, headers: corsHeaders });
    }

    // Get additional product images
    const productIds = (products || []).map((p) => p.id);
    const { data: allImages } = productIds.length > 0
      ? await supabase
          .from("product_images")
          .select("product_id, image_url, display_order")
          .in("product_id", productIds)
          .order("display_order", { ascending: true })
      : { data: [] };

    const imagesByProduct = new Map<string, string[]>();
    for (const img of allImages || []) {
      const existing = imagesByProduct.get(img.product_id) || [];
      existing.push(img.image_url);
      imagesByProduct.set(img.product_id, existing);
    }

    // Determine store base URL
    const baseUrl = store.custom_domain
      ? `https://${store.custom_domain}`
      : `https://${store.slug}.yourdomain.com`;

    const currency = store.currency || "INR";

    if (format === "csv") {
      // CSV format for Meta Commerce Manager
      const header = "id,title,description,availability,condition,price,sale_price,link,image_link,additional_image_link,brand,google_product_category";
      const rows = (products || []).map((p) => {
        const desc = (p.description || p.name).replace(/"/g, '""').replace(/\n/g, " ");
        const availability = p.stock_quantity > 0 ? "in stock" : "out of stock";
        const price = `${Number(p.price).toFixed(2)} ${currency}`;
        const salePrice = p.sale_price && p.sale_price < p.price
          ? `${Number(p.sale_price).toFixed(2)} ${currency}`
          : "";
        const link = `${baseUrl}/product/${p.slug || p.id}`;
        const imageLink = p.image_url || "";
        const additionalImages = (imagesByProduct.get(p.id) || []).slice(0, 10).join(",");

        return `"${p.id}","${escapeXml(p.name)}","${desc}","${availability}","new","${price}","${salePrice}","${link}","${imageLink}","${additionalImages}","${escapeXml(store.name)}",""`;
      });

      return new Response([header, ...rows].join("\n"), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${store.slug}-product-feed.csv"`,
        },
      });
    }

    // XML (RSS 2.0 / Meta Product Feed format)
    const items = (products || []).map((p) => {
      const availability = p.stock_quantity > 0 ? "in stock" : "out of stock";
      const link = `${baseUrl}/product/${p.slug || p.id}`;
      const additionalImages = (imagesByProduct.get(p.id) || [])
        .slice(0, 10)
        .map((url) => `      <g:additional_image_link>${escapeXml(url)}</g:additional_image_link>`)
        .join("\n");

      return `    <item>
      <g:id>${escapeXml(p.id)}</g:id>
      <g:title>${escapeXml(p.name)}</g:title>
      <g:description>${escapeXml((p.description || p.name).replace(/\n/g, " "))}</g:description>
      <g:link>${escapeXml(link)}</g:link>
      <g:image_link>${escapeXml(p.image_url || "")}</g:image_link>
${additionalImages}
      <g:availability>${availability}</g:availability>
      <g:price>${Number(p.price).toFixed(2)} ${currency}</g:price>
${p.sale_price && p.sale_price < p.price ? `      <g:sale_price>${Number(p.sale_price).toFixed(2)} ${currency}</g:sale_price>` : ""}
      <g:condition>new</g:condition>
      <g:brand>${escapeXml(store.name)}</g:brand>
${p.category ? `      <g:product_type>${escapeXml(p.category)}</g:product_type>` : ""}
${p.sku ? `      <g:mpn>${escapeXml(p.sku)}</g:mpn>` : ""}
    </item>`;
    });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
  <channel>
    <title>${escapeXml(store.name)} Product Catalog</title>
    <link>${escapeXml(baseUrl)}</link>
    <description>${escapeXml(store.description || store.name)}</description>
${items.join("\n")}
  </channel>
</rss>`;

    return new Response(xml, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/xml; charset=utf-8",
      },
    });
  } catch (err) {
    console.error("product-feed error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
