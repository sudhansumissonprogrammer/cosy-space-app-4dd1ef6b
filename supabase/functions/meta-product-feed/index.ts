// Meta Product Catalog Feed (CSV, Meta-spec).
// Per-store endpoint:  /functions/v1/meta-product-feed?slug=<store_slug>
// Drop the URL into Meta Commerce Manager → Catalog → Data Sources → Scheduled Feed.
// Required for Advantage+ Shopping campaigns and Dynamic Product Ads.
// https://developers.facebook.com/docs/marketing-api/catalog/reference
//
// Column set matches Meta's official "catalog_products" CSV template:
//   id,title,description,availability,condition,price,link,image_link,brand,
//   google_product_category,fb_product_category,quantity_to_sell_on_facebook,
//   sale_price,item_group_id,additional_image_link,product_type
//
// `id` MUST equal what the Pixel sends as content_ids — we send products.id
// everywhere on the storefront, so the feed uses products.id too.

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

// Meta rejects HTML in description and dislikes ALL-CAPS / excess whitespace.
const cleanText = (raw: string | null | undefined, max: number): string => {
  if (!raw) return "";
  let s = String(raw)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6])>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
  // De-shout: if it's mostly capitals, title-case it (Meta flags ALL CAPS).
  const letters = s.replace(/[^A-Za-z]/g, "");
  if (letters.length > 8 && letters === letters.toUpperCase()) {
    s = s.toLowerCase().replace(/(^|[.!?]\s+|\s)([a-z])/g, (_m, p, c) => p + c.toUpperCase());
  }
  return s.slice(0, max);
};

// Map free-text store categories onto valid Google product taxonomy strings.
// An invalid google_product_category makes Meta drop the field (and hurts
// Advantage+ categorisation), so anything unmatched is left blank and the raw
// value goes into `product_type` instead — which accepts free text.
const GOOGLE_TAXONOMY: [RegExp, string][] = [
  [/mangal\s*sutra|mangalsutra/i, "Apparel & Accessories > Jewelry > Necklaces"],
  [/necklace|haar|chain|pendant/i, "Apparel & Accessories > Jewelry > Necklaces"],
  [/\bring\b|ringe|anguthi/i, "Apparel & Accessories > Jewelry > Rings"],
  [/bracelet|kada|bangle|kangan|brace/i, "Apparel & Accessories > Jewelry > Bracelets"],
  [/ear\s*ring|earring|jhumk|tops|bali/i, "Apparel & Accessories > Jewelry > Earrings"],
  [/anklet|payal/i, "Apparel & Accessories > Jewelry > Anklets"],
  [/watch/i, "Apparel & Accessories > Jewelry > Watches"],
  [/jewel|jewell|ornament/i, "Apparel & Accessories > Jewelry"],
  [/saree|sari|kurta|kurti|dress|shirt|top|apparel|cloth|wear/i, "Apparel & Accessories > Clothing"],
  [/bag|purse|clutch|wallet/i, "Apparel & Accessories > Handbags, Wallets & Cases"],
  [/shoe|sandal|footwear|slipper|sneaker/i, "Apparel & Accessories > Shoes"],
  [/perfume|fragrance|attar/i, "Health & Beauty > Personal Care > Cosmetics > Perfume & Cologne"],
  [/makeup|cosmetic|lipstick|beauty|skin/i, "Health & Beauty > Personal Care > Cosmetics"],
  [/mobile|phone|electronic|gadget|charger|earbud|headphone/i, "Electronics"],
  [/home|decor|kitchen|furnish/i, "Home & Garden > Decor"],
  [/toy|game/i, "Toys & Games"],
];

// Facebook product category (coarse) — optional but improves ad categorisation.
const FB_CATEGORY: [RegExp, string][] = [
  [/jewelry|jewel/i, "Clothing & Accessories > Jewelry & Watches"],
  [/Apparel & Accessories > Shoes/i, "Clothing & Accessories > Shoes"],
  [/Apparel & Accessories > Clothing/i, "Clothing & Accessories > Clothing"],
  [/Handbags/i, "Clothing & Accessories > Handbags & Wallets"],
  [/Health & Beauty/i, "Health & Beauty"],
  [/Electronics/i, "Electronics & Accessories"],
  [/Home & Garden/i, "Home"],
];

const googleCategoryFor = (category: string | null, name: string): string => {
  const probe = `${category || ""} ${name || ""}`;
  for (const [re, val] of GOOGLE_TAXONOMY) if (re.test(probe)) return val;
  return "";
};

const fbCategoryFor = (googleCat: string): string => {
  if (!googleCat) return "";
  for (const [re, val] of FB_CATEGORY) if (re.test(googleCat)) return val;
  return "";
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

    const list = products || [];

    // Gallery images → additional_image_link (Meta allows up to 20, comma-sep).
    const galleryByProduct = new Map<string, string[]>();
    if (list.length) {
      const { data: imgs } = await supabase
        .from("product_images")
        .select("product_id, image_url, display_order")
        .in("product_id", list.map((p) => p.id))
        .order("display_order", { ascending: true });
      for (const img of imgs || []) {
        if (!img.image_url) continue;
        const arr = galleryByProduct.get(img.product_id) || [];
        if (arr.length < 20) arr.push(img.image_url);
        galleryByProduct.set(img.product_id, arr);
      }
    }

    const currency = store.currency || "INR";
    const baseUrl = store.custom_domain
      ? `https://${store.custom_domain}`
      : `https://${store.slug}.shopbanao.in`;

    // Brand must be human-readable (slug fallbacks look spammy in ads).
    const brandRaw = (store.name || store.slug || "").trim();
    const brand = /^[a-z0-9-]+$/.test(brandRaw)
      ? brandRaw.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : brandRaw;

    // Meta CSV column order (template: catalog_products)
    const headers = [
      "id",
      "title",
      "description",
      "availability",
      "condition",
      "price",
      "link",
      "image_link",
      "brand",
      "google_product_category",
      "fb_product_category",
      "quantity_to_sell_on_facebook",
      "sale_price",
      "item_group_id",
      "additional_image_link",
      "product_type",
    ];

    const rows: string[] = [headers.join(",")];

    for (const p of list) {
      // Meta requires a title, a link and an image — skip incomplete rows so
      // the whole feed doesn't get flagged with errors.
      const title = cleanText(p.name, 200);
      if (!title || !p.image_url) continue;

      // Use real column (stock_quantity). NULL = untracked → treat as in stock.
      // Numeric 0 (or negative) = out of stock. Anything > 0 = in stock.
      const qty = p.stock_quantity;
      const untracked = qty === null || qty === undefined;
      const qtyNum = untracked ? 50 : Math.max(0, Number(qty) || 0);
      const availability = untracked || qtyNum > 0 ? "in stock" : "out of stock";

      const regN = Number(p.price || 0);
      const saleN = Number(p.sale_price || 0);
      if (!(regN > 0)) continue; // price is required and must be > 0

      const regularPrice = `${regN.toFixed(2)} ${currency}`;
      // v8.67.0 BAN-FIX P1-2: Cap absurd discounts (sale_price < 5% of price).
      // Meta Commerce catalog auto-flags >70% manufactured discounts as
      // deceptive pricing → suspends the entire catalog + pixel. This usually
      // happens from paise/rupee data-entry mistakes (e.g. ₹1,90,000 → ₹1,800).
      const validSale = saleN > 0 && saleN < regN && saleN / regN >= 0.05;
      const salePrice = validSale ? `${saleN.toFixed(2)} ${currency}` : "";

      const gcat = googleCategoryFor(p.category, p.name || "");
      const gallery = (galleryByProduct.get(p.id) || []).filter((u) => u !== p.image_url);

      rows.push([
        csvEscape(p.id),
        csvEscape(title),
        csvEscape(cleanText(p.description, 9999) || title),
        csvEscape(availability),
        csvEscape("new"),
        csvEscape(regularPrice),
        csvEscape(`${baseUrl}/product/${p.slug || p.id}`),
        csvEscape(p.image_url),
        csvEscape(brand),
        csvEscape(gcat),
        csvEscape(fbCategoryFor(gcat)),
        csvEscape(qtyNum),
        csvEscape(salePrice),
        csvEscape(""), // item_group_id — no shared-variant grouping yet
        csvEscape(gallery.join(",")),
        csvEscape(cleanText(p.category, 750)),
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
