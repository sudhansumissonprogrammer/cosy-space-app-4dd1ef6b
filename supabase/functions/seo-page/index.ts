import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ROOT_DOMAIN = "shopbanao.in";

// ── Shared helpers ──────────────────────────────────────────────

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function normalizeOgImageUrl(imageUrl: string): string {
  if (!imageUrl) return "";
  try {
    const parsed = new URL(imageUrl);
    const pathname = parsed.pathname.toLowerCase();
    const isShopifyCdnAsset =
      parsed.hostname.includes("shopify.com") ||
      parsed.pathname.includes("/cdn/shop/files/");
    if (isShopifyCdnAsset && !pathname.endsWith(".gif")) {
      parsed.searchParams.set("format", "pjpg");
      parsed.searchParams.set("width", "1200");
    }
    return parsed.toString();
  } catch {
    return imageUrl;
  }
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

function appendVersionParam(targetUrl: string, versionToken: string | null): string {
  if (!versionToken) return targetUrl;
  try {
    const parsed = new URL(targetUrl);
    parsed.searchParams.set("v", versionToken);
    return parsed.toString();
  } catch {
    return targetUrl;
  }
}

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// ── OG Meta handler ─────────────────────────────────────────────

async function handleOgMeta(url: URL) {
  const slug = url.searchParams.get("slug");
  if (!slug) {
    return new Response(JSON.stringify({ error: "Missing slug" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = getSupabase();
  const { data: store, error } = await supabase
    .from("stores")
    .select("name, description, meta_title, meta_description, og_image_url, logo_url, banner_url, slug")
    .eq("slug", slug)
    .single();

  if (error || !store) {
    return new Response(JSON.stringify({ error: "Store not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const ogTitle = store.meta_title || `${store.name} — Shop Online`;
  const ogDescription = store.meta_description || store.description || `Shop the best products at ${store.name}. Fast delivery & easy returns.`;
  const ogImage = normalizeOgImageUrl(store.og_image_url || store.banner_url || store.logo_url || "");

  return new Response(
    JSON.stringify({ title: ogTitle, description: ogDescription, image: ogImage, slug: store.slug }),
    {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=1800, s-maxage=3600",
        "CDN-Cache-Control": "public, max-age=3600",
      },
    }
  );
}

// ── Share Page handler ──────────────────────────────────────────

function buildShareHtml(title: string, description: string, image: string, canonicalUrl: string, redirectUrl: string, siteName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${siteName}">
  ${image ? `<meta property="og:image" content="${escapeHtml(image)}">
  <meta property="og:image:secure_url" content="${escapeHtml(image)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">` : ""}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  ${image ? `<meta name="twitter:image" content="${escapeHtml(image)}">` : ""}
  <link rel="canonical" href="${canonicalUrl}">
  <meta http-equiv="refresh" content="0;url=${redirectUrl}">
  <script>window.location.replace("${redirectUrl}");</script>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #fafafa; color: #333; }
    .card { text-align: center; padding: 2rem; }
    a { color: #2563eb; text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <p>Redirecting to <a href="${redirectUrl}">${siteName}</a>...</p>
  </div>
</body>
</html>`;
}

async function handleSharePage(url: URL) {
  const slug = url.searchParams.get("slug");
  const productSlug = url.searchParams.get("product");
  const versionToken = url.searchParams.get("v");

  if (!slug) {
    return new Response("Missing slug", { status: 400 });
  }

  const supabase = getSupabase();
  const { data: store, error } = await supabase
    .from("stores")
    .select("id, name, description, meta_title, meta_description, og_image_url, logo_url, banner_url, slug, currency")
    .eq("slug", slug)
    .single();

  if (error || !store) {
    return new Response("Store not found", { status: 404 });
  }

  const baseStoreUrl = `https://${slug}.${ROOT_DOMAIN}`;
  const storeUrl = appendVersionParam(baseStoreUrl, versionToken);

  if (productSlug) {
    let { data: product } = await supabase
      .from("products")
      .select("name, description, image_url, price, sale_price, slug, currency, id")
      .eq("store_id", store.id)
      .eq("slug", productSlug)
      .eq("is_active", true)
      .maybeSingle();

    if (!product) {
      const { data: byId } = await supabase
        .from("products")
        .select("name, description, image_url, price, sale_price, slug, currency, id")
        .eq("store_id", store.id)
        .eq("id", productSlug)
        .eq("is_active", true)
        .maybeSingle();
      product = byId;
    }

    if (product) {
      const price = product.sale_price || product.price;
      const currency = product.currency || store.currency || "INR";
      const currencySymbol = currency === "INR" ? "₹" : currency === "USD" ? "$" : currency;
      const priceText = `${currencySymbol}${price}`;

      const productTitle = escapeHtml(`${product.name} - ${priceText}`);
      const productDesc = escapeHtml(product.description || `Shop ${product.name} at ${store.name}`);
      const rawProductImage = product.image_url || store.og_image_url || store.banner_url || "";
      const productImage = normalizeOgImageUrl(rawProductImage);
      const productPath = product.slug || product.id;
      const productUrl = appendVersionParam(`${baseStoreUrl}/product/${productPath}`, versionToken);

      const html = buildShareHtml(productTitle, productDesc, productImage, productUrl, productUrl, escapeHtml(store.name));
      return new Response(html, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=300, s-maxage=3600",
        },
      });
    }
  }

  const title = escapeHtml(store.meta_title || store.name);
  const description = escapeHtml(store.meta_description || store.description || `Shop at ${store.name}`);
  const rawStoreImage = store.og_image_url || store.banner_url || store.logo_url || "";
  const image = normalizeOgImageUrl(rawStoreImage);

  const html = buildShareHtml(title, description, image, storeUrl, storeUrl, escapeHtml(store.name));
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=3600",
    },
  });
}

// ── Sitemap handler ─────────────────────────────────────────────

async function handleSitemap(url: URL) {
  const slug = url.searchParams.get("slug");
  const domain = url.searchParams.get("domain");

  if (!slug) {
    return new Response("Missing slug parameter", { status: 400, headers: corsHeaders });
  }

  const supabase = getSupabase();
  const { data: store, error: storeErr } = await supabase
    .from("stores")
    .select("id, slug, name, updated_at, custom_domain")
    .eq("slug", slug)
    .eq("is_suspended", false)
    .single();

  if (storeErr || !store) {
    return new Response("Store not found", { status: 404, headers: corsHeaders });
  }

  const storeHost = domain || store.custom_domain || `${slug}.${ROOT_DOMAIN}`;
  const baseUrl = `https://${storeHost}`;

  const [productsResult, categoriesResult] = await Promise.all([
    supabase
      .from("products")
      .select("slug, id, updated_at, image_url, name, price, sale_price")
      .eq("store_id", store.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("categories")
      .select("slug, name")
      .eq("store_id", store.id),
  ]);

  const products = productsResult.data;
  const categories = categoriesResult.data;
  const now = new Date().toISOString().split("T")[0];
  const storeUpdated = store.updated_at?.split("T")[0] || now;

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>${baseUrl}</loc>
    <lastmod>${storeUpdated}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/contact</loc>
    <lastmod>${storeUpdated}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>${baseUrl}/best-sellers</loc>
    <lastmod>${storeUpdated}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>${baseUrl}/shop</loc>
    <lastmod>${storeUpdated}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
`;

  if (categories) {
    for (const cat of categories) {
      xml += `  <url>
    <loc>${baseUrl}/category/${escapeXml(cat.slug)}</loc>
    <lastmod>${storeUpdated}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
`;
    }
  }

  if (products) {
    for (const p of products) {
      const productSlug = p.slug || p.id;
      const lastmod = p.updated_at?.split("T")[0] || now;
      xml += `  <url>
    <loc>${baseUrl}/product/${escapeXml(productSlug)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>`;
      if (p.image_url) {
        const images = p.image_url.split(",").map((u: string) => u.trim()).filter(Boolean);
        for (const img of images) {
          xml += `
    <image:image>
      <image:loc>${escapeXml(img)}</image:loc>
      <image:title>${escapeXml(p.name)}</image:title>
    </image:image>`;
        }
      }
      xml += `
  </url>
`;
    }
  }

  for (const page of ["about", "privacy-policy", "return-policy", "shipping-policy", "terms"]) {
    xml += `  <url>
    <loc>${baseUrl}/${page}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
`;
  }

  xml += `</urlset>`;

  return new Response(xml, {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "CDN-Cache-Control": "public, max-age=3600",
    },
  });
}

// ── Robots.txt handler ──────────────────────────────────────────

async function handleRobots(url: URL) {
  const slug = url.searchParams.get("slug");
  const domain = url.searchParams.get("domain");

  if (!slug) {
    return new Response("Missing slug parameter", { status: 400, headers: corsHeaders });
  }

  // v8.14.0: Prefer the actual hostname the request came in on (passed as
  // `domain` by the worker). Falls back to store.custom_domain → subdomain.
  // Google requires the Sitemap: URL to live on the same host as the URLs it
  // lists, so cross-host sitemaps get rejected in Search Console.
  let storeHost = domain;
  if (!storeHost) {
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && supabaseKey) {
        const r = await fetch(
          `${supabaseUrl}/rest/v1/stores?slug=eq.${encodeURIComponent(slug)}&select=custom_domain`,
          { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
        );
        if (r.ok) {
          const rows = await r.json();
          if (Array.isArray(rows) && rows[0]?.custom_domain) storeHost = rows[0].custom_domain;
        }
      }
    } catch { /* fall through */ }
  }
  if (!storeHost) storeHost = `${slug}.${ROOT_DOMAIN}`;
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
}

// ── Product Feed handler ────────────────────────────────────────

async function handleProductFeed(url: URL) {
  const slug = url.searchParams.get("slug");
  const format = url.searchParams.get("format") || "xml";
  const includeVariants = url.searchParams.get("variants") !== "false";

  if (!slug) {
    return new Response("Missing ?slug= parameter", { status: 400, headers: corsHeaders });
  }

  const supabase = getSupabase();
  const { data: store, error: storeErr } = await supabase
    .from("stores")
    .select("id, name, slug, currency, custom_domain, description")
    .eq("slug", slug)
    .eq("is_suspended", false)
    .single();

  if (storeErr || !store) {
    return new Response("Store not found", { status: 404, headers: corsHeaders });
  }

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

  const baseUrl = store.custom_domain
    ? `https://${store.custom_domain}`
    : `https://${store.slug}.shopbanao.in`;

  const currency = store.currency || "INR";
  const now = new Date().toISOString();

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
          link,
          image_link: imageLink,
          additional_images: additionalImages,
          brand: store.name,
          category: p.category || "",
          sku: v.sku || p.sku || "",
          updated_at: p.updated_at || p.created_at || now,
        });
      }
    } else {
      feedItems.push({
        id: p.id,
        item_group_id: null,
        title: p.name,
        description: desc,
        availability: p.stock_quantity > 0 ? "in stock" : "out of stock",
        price: `${Number(p.price).toFixed(2)} ${currency}`,
        sale_price: p.sale_price && p.sale_price < p.price
          ? `${Number(p.sale_price).toFixed(2)} ${currency}` : "",
        link,
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

  const xmlFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
  <channel>
    <title>${escapeXml(store.name)} Product Catalog</title>
    <link>${escapeXml(baseUrl)}</link>
    <description>${escapeXml(store.description || store.name)}</description>
${items.join("\n")}
  </channel>
</rss>`;

  return new Response(xmlFeed, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=1800, s-maxage=3600",
      "CDN-Cache-Control": "public, max-age=3600",
    },
  });
}

// ── Router ──────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const type = url.searchParams.get("type") || "og";

  try {
    switch (type) {
      case "og":
        return await handleOgMeta(url);
      case "share":
        return await handleSharePage(url);
      case "sitemap":
        return await handleSitemap(url);
      case "robots":
        return handleRobots(url);
      case "feed":
        return await handleProductFeed(url);
      default:
        return new Response(JSON.stringify({ error: `Unknown type: ${type}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (err) {
    console.error(`[seo-page] Error (type=${type}):`, err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
