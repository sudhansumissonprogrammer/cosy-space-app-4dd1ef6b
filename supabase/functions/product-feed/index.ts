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

function escapeCsv(str: string): string {
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug");
    const format = url.searchParams.get("format") || "xml";
    const includeVariants = url.searchParams.get("variants") !== "false";

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

    // Get active products
    const { data: products, error: prodErr } = await supabase
      .from("products")
      .select("id, name, description, price, sale_price, image_url, category, slug, stock_quantity, sku, is_active, updated_at, created_at")
      .eq("store_id", store.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1000);

    if (prodErr) {
      return new Response("Error fetching products", { status: 500, headers: corsHeaders });
    }

    const productIds = (products || []).map((p) => p.id);

    // Fetch images + variants in parallel
    const [imagesResult, variantsResult] = await Promise.all([
      productIds.length > 0
        ? supabase
            .from("product_images")
            .select("product_id, image_url, display_order")
            .in("product_id", productIds)
            .order("display_order", { ascending: true })
        : Promise.resolve({ data: [] }),
      includeVariants && productIds.length > 0
        ? supabase
            .from("product_variants")
            .select("product_id, id, name, price, stock_quantity, sku, is_active")
            .in("product_id", productIds)
            .eq("is_active", true)
            .order("display_order", { ascending: true })
        : Promise.resolve({ data: [] }),
    ]);

    const imagesByProduct = new Map<string, string[]>();
    for (const img of imagesResult.data || []) {
      const existing = imagesByProduct.get(img.product_id) || [];
      existing.push(img.image_url);
      imagesByProduct.set(img.product_id, existing);
    }

    const variantsByProduct = new Map<string, any[]>();
    for (const v of variantsResult.data || []) {
      const existing = variantsByProduct.get(v.product_id) || [];
      existing.push(v);
      variantsByProduct.set(v.product_id, existing);
    }

    // Determine store base URL — use custom domain or Cloudflare subdomain
    const baseUrl = store.custom_domain
      ? `https://${store.custom_domain}`
      : `https://${store.slug}.storiva.in`;

    const currency = store.currency || "INR";
    const now = new Date().toISOString();

    // Build feed items (expanding variants into separate items)
    interface FeedItem {
      id: string;
      item_group_id: string | null;
      title: string;
      description: string;
      availability: string;
      price: string;
      sale_price: string;
      link: string;
      image_link: string;
      additional_images: string[];
      brand: string;
      category: string;
      sku: string;
      updated_at: string;
    }

    const feedItems: FeedItem[] = [];

    for (const p of products || []) {
      const desc = stripHtml(p.description || p.name);
      const link = `${baseUrl}/product/${p.slug || p.id}`;
      const imageLink = p.image_url || "";
      const additionalImages = (imagesByProduct.get(p.id) || []).slice(0, 10);
      const variants = variantsByProduct.get(p.id) || [];

      if (includeVariants && variants.length > 0) {
        // Create one feed item per variant (Meta best practice)
        for (const v of variants) {
          const variantPrice = v.price != null ? v.price : p.price;
          const variantStock = v.stock_quantity;
          const variantSalePrice = v.price != null && p.sale_price && p.sale_price < variantPrice
            ? p.sale_price : (p.sale_price && p.sale_price < p.price ? p.sale_price : null);

          feedItems.push({
            id: v.id,
            item_group_id: p.id,
            title: `${p.name} - ${v.name}`,
            description: desc,
            availability: variantStock > 0 ? "in stock" : "out of stock",
            price: `${Number(variantPrice).toFixed(2)} ${currency}`,
            sale_price: variantSalePrice ? `${Number(variantSalePrice).toFixed(2)} ${currency}` : "",
            link: link,
            image_link: imageLink,
            additional_images: additionalImages,
            brand: store.name,
            category: p.category || "",
            sku: v.sku || p.sku || "",
            updated_at: p.updated_at || p.created_at || now,
          });
        }
      } else {
        // No variants — single item
        feedItems.push({
          id: p.id,
          item_group_id: null,
          title: p.name,
          description: desc,
          availability: p.stock_quantity > 0 ? "in stock" : "out of stock",
          price: `${Number(p.price).toFixed(2)} ${currency}`,
          sale_price: p.sale_price && p.sale_price < p.price
            ? `${Number(p.sale_price).toFixed(2)} ${currency}` : "",
          link: link,
          image_link: imageLink,
          additional_images: additionalImages,
          brand: store.name,
          category: p.category || "",
          sku: p.sku || "",
          updated_at: p.updated_at || p.created_at || now,
        });
      }
    }

    if (format === "csv") {
      const header = "id,item_group_id,title,description,availability,condition,price,sale_price,link,image_link,additional_image_link,brand,google_product_category,mpn";
      const rows = feedItems.map((item) => {
        return [
          escapeCsv(item.id),
          escapeCsv(item.item_group_id || ""),
          escapeCsv(item.title),
          escapeCsv(item.description),
          item.availability,
          "new",
          item.price,
          item.sale_price,
          escapeCsv(item.link),
          escapeCsv(item.image_link),
          escapeCsv(item.additional_images.join(",")),
          escapeCsv(item.brand),
          escapeCsv(item.category),
          escapeCsv(item.sku),
        ].join(",");
      });

      return new Response([header, ...rows].join("\n"), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${store.slug}-product-feed.csv"`,
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    // XML (RSS 2.0 / Meta Product Feed format)
    const items = feedItems.map((item) => {
      const additionalImagesXml = item.additional_images
        .map((u) => `      <g:additional_image_link>${escapeXml(u)}</g:additional_image_link>`)
        .join("\n");

      return `    <item>
      <g:id>${escapeXml(item.id)}</g:id>
${item.item_group_id ? `      <g:item_group_id>${escapeXml(item.item_group_id)}</g:item_group_id>` : ""}
      <g:title>${escapeXml(item.title)}</g:title>
      <g:description>${escapeXml(item.description)}</g:description>
      <g:link>${escapeXml(item.link)}</g:link>
      <g:image_link>${escapeXml(item.image_link)}</g:image_link>
${additionalImagesXml}
      <g:availability>${item.availability}</g:availability>
      <g:price>${item.price}</g:price>
${item.sale_price ? `      <g:sale_price>${item.sale_price}</g:sale_price>` : ""}
      <g:condition>new</g:condition>
      <g:brand>${escapeXml(item.brand)}</g:brand>
${item.category ? `      <g:product_type>${escapeXml(item.category)}</g:product_type>` : ""}
${item.sku ? `      <g:mpn>${escapeXml(item.sku)}</g:mpn>` : ""}
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
        "Cache-Control": "public, max-age=3600",
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
