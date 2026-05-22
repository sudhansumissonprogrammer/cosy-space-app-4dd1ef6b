// Meta Product Catalog Feed (CSV, Meta-spec).
// Per-store endpoint:  /functions/v1/meta-product-feed?slug=<store_slug>
// Drop the URL into Meta Commerce Manager → Catalog → Data Sources → Scheduled Feed.
// Required for Advantage+ Shopping campaigns and Dynamic Product Ads.
// https://developers.facebook.com/docs/marketing-api/catalog/reference

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// CSV escape — wrap in quotes, double internal quotes
const csvEscape = (v: string | number | null | undefined): string => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug");
    if (!slug) {
      return new Response("slug query param required", {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: store } = await supabase
      .from("stores")
      .select("id, name, currency, custom_domain, slug")
      .eq("slug", slug)
      .eq("is_suspended", false)
      .maybeSingle();

    if (!store) {
      return new Response("store not found", {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    const { data: products } = await supabase
      .from("products")
      .select("id, name, description, price, sale_price, image_url, stock_quantity, is_active, slug, category")
      .eq("store_id", store.id)
      .eq("is_active", true)
      .limit(5000);

    const currency = store.currency || "INR";
    const baseUrl = store.custom_domain
      ? `https://${store.custom_domain}`
      : `https://${store.slug}.shopbanao.in`;

    // Meta CSV column order (required headers)
    const headers = [
      "id",
      "title",
      "description",
      "availability",
      "condition",
      "price",
      "sale_price",
      "link",
      "image_link",
      "brand",
      "google_product_category",
    ];

    const rows: string[] = [headers.join(",")];

    for (const p of products || []) {
      // Use real column (stock_quantity). NULL = untracked → treat as in stock.
      // Numeric 0 (or negative) = out of stock. Anything > 0 = in stock.
      const qty = p.stock_quantity;
      const availability =
        qty === null || qty === undefined || Number(qty) > 0
          ? "in stock"
          : "out of stock";
      const regularPrice = `${Number(p.price || 0).toFixed(2)} ${currency}`;
      const salePrice = p.sale_price && Number(p.sale_price) > 0 && Number(p.sale_price) < Number(p.price || 0)
        ? `${Number(p.sale_price).toFixed(2)} ${currency}`
        : "";
      rows.push([
        csvEscape(p.id),
        csvEscape(p.name),
        csvEscape((p.description || p.name || "").slice(0, 5000)),
        csvEscape(availability),
        csvEscape("new"),
        csvEscape(regularPrice),
        csvEscape(salePrice),
        csvEscape(`${baseUrl}/product/${p.slug || p.id}`),
        csvEscape(p.image_url || ""),
        csvEscape(store.name || ""),
        csvEscape(p.category || ""),
      ].join(","));
    }

    return new Response(rows.join("\n"), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `inline; filename="${slug}-products.csv"`,
        // 1 hour edge cache — Meta refetches every few hours anyway
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (err) {
    console.error("meta-product-feed error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
