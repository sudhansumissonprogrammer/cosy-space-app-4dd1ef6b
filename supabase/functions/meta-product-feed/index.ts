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
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { readAllRows, productImageUrls } from "../_shared/seoDiscovery.ts";
import { discoveryAvailability, discoverySalePrice, hasRequiredFeedFacts } from "../_shared/productDiscoveryFacts.ts";

// CSV escape — wrap in quotes, double internal quotes
const csvEscape = (v: string | number | null | undefined): string => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

// Slug-looking titles ("rakhdi-set-ranihar-nath") read as spam in ads.
const deSlug = (s: string): string =>
  /^[a-z0-9]+(?:[-_][a-z0-9]+)+$/.test(s.trim())
    ? s.trim().replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : s;

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
  s = deSlug(s);
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
  [/necklace|haar|haar|ranihar|chain|pendant|chokar|choker|aad\b|thushi|sankh/i, "Apparel & Accessories > Jewelry > Necklaces"],
  [/\bring\b|ringe|anguthi/i, "Apparel & Accessories > Jewelry > Rings"],
  [/bracelet|kada|bangle|kangan|brace|ponchi|gokharu|bajuband|baju\b|hathful|hathphool|armlet/i, "Apparel & Accessories > Jewelry > Bracelets"],
  [/ear\s*ring|earring|jhumk|tops|bali/i, "Apparel & Accessories > Jewelry > Earrings"],
  [/anklet|payal/i, "Apparel & Accessories > Jewelry > Anklets"],
  [/watch/i, "Apparel & Accessories > Jewelry > Watches"],
  [/rakhdi|borla|maang\s*tikka|\btika\b|tikka|nath\b|nathni|sheeshphool|hairband|hair\s*band|jewel|jewell|ornament|combo[-\s]?set/i, "Apparel & Accessories > Jewelry"],
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
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: { ...corsHeaders, Allow: "GET, HEAD, OPTIONS", "Cache-Control": "no-store" } });
  }

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug");
    if (!slug || !/^[a-z0-9][a-z0-9-]{0,99}$/.test(slug)) {
      return new Response("slug query param required", {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id, name, currency, custom_domain, slug")
      .eq("slug", slug)
      .eq("is_suspended", false)
      .maybeSingle();
    if (storeError) throw new Error("Store retrieval failed");

    if (!store) {
      return new Response("store not found", {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    const list = await readAllRows<any>((from, to) => supabase
      .from("products")
      .select("id, name, description, price, sale_price, image_url, stock_quantity, is_active, slug, category")
      .eq("store_id", store.id)
      .eq("is_active", true)
      .eq("hidden_by_category", false)
      .order("id").range(from, to));

    // Gallery images → additional_image_link (Meta allows up to 20, comma-sep).
    const galleryByProduct = new Map<string, string[]>();
    for (let i = 0; i < list.length; i += 100) {
      const imgs = await readAllRows<any>((from, to) => supabase
        .from("product_images")
        .select("id, product_id, image_url, display_order")
        .in("product_id", list.slice(i, i + 100).map((p) => p.id))
        .order("display_order", { ascending: true }).order("id").range(from, to));
      for (const img of imgs || []) {
        if (!img.image_url) continue;
        const arr = galleryByProduct.get(img.product_id) || [];
        if (arr.length < 9) arr.push(img.image_url);
        galleryByProduct.set(img.product_id, arr);
      }
    }

    const currency = store.currency || "INR";
    const baseUrl = store.custom_domain
      ? `https://${store.custom_domain}`
      : `https://${store.slug}.shopbanao.in`;

    // Store-level fallback taxonomy: use the dominant top-level category of the
    // products we *could* match, so odd/regional item names never ship blank.
    const catTally = new Map<string, number>();
    for (const p of list) {
      const g = googleCategoryFor(p.category, p.name || "");
      if (!g) continue;
      const top = g.split(" > ").slice(0, 3).join(" > ");
      catTally.set(top, (catTally.get(top) || 0) + 1);
    }
    let fallbackCat = "";
    let best = 0;
    for (const [k, v] of catTally) if (v > best) { best = v; fallbackCat = k; }
    // Prefer the safe parent node (e.g. ".. > Jewelry") over a leaf like Rings.
    if (fallbackCat.split(" > ").length === 3) {
      fallbackCat = fallbackCat.split(" > ").slice(0, 2).join(" > ") + " > " + fallbackCat.split(" > ")[2];
    }

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
      "age_group",
      "gender",
      "color",
      "material",
    ];

    const rows: string[] = [headers.join(",")];

    for (const p of list) {
      // Meta requires a title, a link and an image — skip incomplete rows so
      // the whole feed doesn't get flagged with errors.
      const title = cleanText(p.name, 200);
      const realImages = productImageUrls(p.image_url, galleryByProduct.get(p.id) || []).filter(u => /^https:\/\//i.test(u));
      if (!title || !hasRequiredFeedFacts(p, realImages)) continue;

      // Unknown inventory was excluded above. Do not export the unlimited-stock sentinel as a quantity.
      const qty = p.stock_quantity;
      const untracked = qty === null || qty === undefined;
      const qtyNum = untracked || Number(qty) >= 999999 ? "" : Math.min(9999, Math.max(0, Number(qty)));
      const availability = discoveryAvailability(qty);

      const regN = Number(p.price || 0);
      const saleN = Number(p.sale_price || 0);
      if (!(regN > 0)) continue; // price is required and must be > 0

      const regularPrice = `${regN.toFixed(2)} ${currency}`;
      // Discovery must match the actual valid parent sale price; never hide large discounts.
      const validSale = discoverySalePrice(regN, saleN) !== undefined;
      const salePrice = validSale ? `${saleN.toFixed(2)} ${currency}` : "";

      const gcat = googleCategoryFor(p.category, p.name || "") || fallbackCat;
      const gallery = realImages.slice(1);
      const productType = cleanText(p.category, 750);
      // Preserve supplied facts; absent descriptions get neutral identity only.
      let description = cleanText(p.description, 9999);
      if (!description) description = `View ${title} at ${store.name}.`;

      rows.push([
        csvEscape(p.id),
        csvEscape(title),
        csvEscape(description),
        csvEscape(availability),
        csvEscape(""),
        csvEscape(regularPrice),
        csvEscape(`${baseUrl}/product/${p.slug || p.id}`),
        csvEscape(realImages[0]),
        csvEscape(""),
        csvEscape(gcat),
        csvEscape(fbCategoryFor(gcat)),
        csvEscape(qtyNum),
        csvEscape(salePrice),
        // item_group_id mirrors id: no shared-variant grouping yet, but a
        // populated group id means events sent with content_type
        // "product_group" still match the catalog instead of scoring 0%.
        csvEscape(p.id),
        csvEscape(gallery.join(",")),
        csvEscape(productType),
        csvEscape(""),
        csvEscape(""),
        csvEscape(""),
        csvEscape(""),
      ].join(","));
    }


    return new Response(req.method === "HEAD" ? null : rows.join("\n"), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `inline; filename="${slug}-products.csv"`,
        // Bounded freshness; provider scheduling and acceptance are external.
        "Cache-Control": "public, max-age=60, s-maxage=60",
      },
    });
  } catch (err) {
    console.error("meta-product-feed error:", err);
    return new Response(
      JSON.stringify({ error: "Product feed temporarily unavailable" }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } },
    );
  }
});
