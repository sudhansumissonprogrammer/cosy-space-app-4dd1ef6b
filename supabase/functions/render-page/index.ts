/**
 * render-page: Pre-renders full HTML for storefront pages.
 *
 * Generates SEO-ready HTML with:
 *  - Complete OG/meta tags
 *  - JSON-LD structured data
 *  - Embedded store + product data for instant SPA hydration
 *  - Critical CSS inlined
 *  - The SPA entry point script
 *
 * The Cloudflare Worker calls this instead of proxying to origin,
 * so the first paint includes real content (not a spinner).
 *
 * Query params:
 *  - slug: store slug (required)
 *  - path: page path (default "/")
 *  - origin: origin URL to fetch SPA assets from
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function esc(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escJson(str: string): string {
  return str.replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
}

const ROOT_DOMAIN = "storivo.in";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  const path = url.searchParams.get("path") || "/";
  const originHost = url.searchParams.get("origin") || "";
  const customDomain = url.searchParams.get("domain") || "";

  if (!slug) {
    return new Response(JSON.stringify({ error: "Missing slug" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ── Fetch storefront data (same RPC the frontend uses) ──
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "get_storefront_data",
    { _slug: slug, _product_limit: 50 },
  );

  if (rpcError || !rpcData?.store) {
    return new Response(JSON.stringify({ error: "Store not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const store = rpcData.store;
  const products = rpcData.products || [];
  const categories = rpcData.categories || [];
  const themeConfig = rpcData.theme_config || null;

  // ── Determine canonical URL ──
  const baseUrl = customDomain
    ? `https://${customDomain}`
    : `https://${slug}.${ROOT_DOMAIN}`;
  const canonicalUrl = `${baseUrl}${path === "/" ? "" : path}`;

  // ── Build page-specific meta ──
  const productSlug = path.match(/^\/product\/([^/?#]+)/)?.[1];
  let product: any = null;

  if (productSlug) {
    product = products.find(
      (p: any) =>
        p.slug === productSlug || p.slug === decodeURIComponent(productSlug),
    );
  }

  const pageTitle = product
    ? `${product.name} — ${store.name}`
    : store.meta_title || `${store.name} — Shop Online`;

  const pageDescription = product
    ? product.description?.slice(0, 160) || `Buy ${product.name} at ${store.name}`
    : store.meta_description ||
      store.description ||
      `Shop the best products at ${store.name}. Fast delivery & easy returns.`;

  const pageImage = product
    ? product.image_url || store.og_image_url || store.banner_url || ""
    : store.og_image_url || store.banner_url || store.logo_url || "";

  // ── JSON-LD ──
  const jsonLd = product
    ? buildProductJsonLd(product, store, baseUrl)
    : buildStoreJsonLd(store, baseUrl);

  // ── Product list HTML for SEO (visible to crawlers, hidden on hydration) ──
  const productListHtml = !product
    ? buildProductListHtml(products, store, baseUrl)
    : "";

  // ── Build the embedded data payload ──
  const embeddedData = {
    store,
    products,
    categories,
    theme_config: themeConfig,
    total_products: rpcData.total_products || products.length,
    _rendered_at: new Date().toISOString(),
    _slug: slug,
  };

  // ── Fetch the SPA shell (index.html) to get current asset references ──
  let spaAssets = { css: [] as string[], js: [] as string[] };
  if (originHost) {
    try {
      const shellRes = await fetch(`https://${originHost}/?store=${slug}`, {
        headers: { "User-Agent": "Storivo-Renderer/1.0" },
        signal: AbortSignal.timeout(8000),
      });
      if (shellRes.ok) {
        const shellHtml = await shellRes.text();
        // Extract CSS links
        const cssMatches = shellHtml.matchAll(
          /href="(\/assets\/[^"]+\.css)"/g,
        );
        for (const m of cssMatches) spaAssets.css.push(m[1]);
        // Extract JS modules
        const jsMatches = shellHtml.matchAll(
          /src="(\/assets\/[^"]+\.js)"/g,
        );
        for (const m of jsMatches) spaAssets.js.push(m[1]);
        // Also catch the main entry
        const mainMatch = shellHtml.match(/src="(\/src\/main\.tsx)"/);
        if (mainMatch) spaAssets.js.push(mainMatch[1]);
      }
    } catch {
      // Fall back to generic entry point
    }
  }

  // ── Primary color from theme ──
  const primaryColor = themeConfig?.primary_color || "#4361ee";

  // ── Build HTML ──
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(pageTitle)}</title>
<meta name="description" content="${esc(pageDescription)}">
<link rel="canonical" href="${esc(canonicalUrl)}">

<!-- Open Graph -->
<meta property="og:type" content="${product ? "product" : "website"}">
<meta property="og:title" content="${esc(pageTitle)}">
<meta property="og:description" content="${esc(pageDescription)}">
<meta property="og:url" content="${esc(canonicalUrl)}">
<meta property="og:site_name" content="${esc(store.name)}">
${pageImage ? `<meta property="og:image" content="${esc(pageImage)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">` : ""}

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(pageTitle)}">
<meta name="twitter:description" content="${esc(pageDescription)}">
${pageImage ? `<meta name="twitter:image" content="${esc(pageImage)}">` : ""}

<meta name="theme-color" content="${esc(primaryColor)}">
${store.logo_url ? `<link rel="icon" type="image/png" href="${esc(store.logo_url)}">` : ""}

<!-- Preconnect -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preconnect" href="https://kzvfjknnslgcwumzlwkb.supabase.co">

<!-- Fonts (deferred) -->
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" media="print" onload="this.media='all'">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Alegreya+SC:wght@400;700&family=Changa:wght@400;600&family=Montserrat:wght@400;600;700&display=swap" media="print" onload="this.media='all'">
<noscript><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Alegreya+SC:wght@400;700&family=Changa:wght@400;600&family=Montserrat:wght@400;600;700&display=swap" rel="stylesheet"></noscript>

<!-- Preload hero image for LCP -->
${pageImage ? `<link rel="preload" as="image" href="${esc(pageImage)}" fetchpriority="high">` : ""}

<!-- SPA CSS -->
${spaAssets.css.map((href) => `<link rel="stylesheet" href="${href}">`).join("\n")}

<!-- JSON-LD -->
<script type="application/ld+json">${escJson(JSON.stringify(jsonLd))}</script>

<!-- Critical inline CSS -->
<style>
body{margin:0;font-family:'Inter','Segoe UI',sans-serif;-webkit-font-smoothing:antialiased;background:${esc(themeConfig?.background_color || "#f8f8fa")};color:${esc(themeConfig?.text_color || "#1a1a1a")}}
#root{min-height:100vh}
.ssr-product-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;padding:16px;max-width:1200px;margin:0 auto}
@media(min-width:768px){.ssr-product-grid{grid-template-columns:repeat(3,1fr)}}
@media(min-width:1024px){.ssr-product-grid{grid-template-columns:repeat(4,1fr)}}
.ssr-card{border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;background:#fff}
.ssr-card img{width:100%;aspect-ratio:4/5;object-fit:cover;display:block}
.ssr-card-body{padding:10px}
.ssr-card-name{font-size:14px;font-weight:600;margin:0 0 4px}
.ssr-card-price{font-size:15px;font-weight:700;color:${esc(primaryColor)}}
.ssr-hero{width:100%;max-height:400px;object-fit:cover;display:block}
.ssr-header{padding:16px;display:flex;align-items:center;gap:12px}
.ssr-logo{width:48px;height:48px;border-radius:12px;object-fit:cover}
.ssr-store-name{font-size:20px;font-weight:700;margin:0}
[data-ssr]{transition:opacity .2s}
</style>

<!-- Embedded storefront data for instant hydration -->
<script id="__STOREFRONT_DATA__" type="application/json">${escJson(JSON.stringify(embeddedData))}</script>
</head>
<body>
<div id="root" data-ssr="true">
<!-- Pre-rendered content (replaced on SPA hydration) -->
<header class="ssr-header">
${store.logo_url ? `<img src="${esc(store.logo_url)}" alt="${esc(store.name)}" class="ssr-logo" width="48" height="48">` : ""}
<h1 class="ssr-store-name">${esc(store.name)}</h1>
</header>
${store.banner_url && !product ? `<img src="${esc(store.banner_url)}" alt="${esc(store.name)} banner" class="ssr-hero" width="1200" height="400" fetchpriority="high">` : ""}
${product ? buildProductDetailHtml(product, store, primaryColor) : ""}
${productListHtml}
</div>

<!-- SPA scripts (deferred — hydrate after content paint) -->
${spaAssets.js.map((src) => `<script type="module" src="${src}"></script>`).join("\n")}
${spaAssets.js.length === 0 ? `<script type="module" src="/src/main.tsx"></script>` : ""}
</body>
</html>`;

  return new Response(html, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
      "CDN-Cache-Control": "public, max-age=300",
      "X-Rendered-At": new Date().toISOString(),
    },
  });
});

// ── JSON-LD builders ──

function buildStoreJsonLd(store: any, baseUrl: string) {
  const data: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "Store",
    name: store.name,
    url: baseUrl,
  };
  if (store.description) data.description = store.description;
  if (store.logo_url) data.logo = store.logo_url;
  if (store.location) {
    data.address = {
      "@type": "PostalAddress",
      addressLocality: store.location,
    };
  }
  if (store.whatsapp_number) {
    data.contactPoint = {
      "@type": "ContactPoint",
      telephone: store.whatsapp_number,
      contactType: "customer service",
    };
  }
  return data;
}

function buildProductJsonLd(product: any, store: any, baseUrl: string) {
  const price =
    product.sale_price && product.sale_price < product.price
      ? product.sale_price
      : product.price;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    url: `${baseUrl}/product/${product.slug || product.id}`,
    sku: product.sku || product.id,
    ...(product.description ? { description: product.description } : {}),
    ...(product.image_url ? { image: product.image_url } : {}),
    brand: { "@type": "Organization", name: store.name },
    offers: {
      "@type": "Offer",
      price: Number(price).toFixed(2),
      priceCurrency: product.currency || "INR",
      availability:
        (product.stock_quantity ?? 0) > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      url: `${baseUrl}/product/${product.slug || product.id}`,
      seller: { "@type": "Organization", name: store.name },
      itemCondition: "https://schema.org/NewCondition",
    },
  };
}

// ── SSR HTML builders ──

function buildProductListHtml(
  products: any[],
  store: any,
  _baseUrl: string,
): string {
  if (!products || products.length === 0) return "";

  const currencySymbol = getCurrencySymbol(store.currency || "INR");
  const cards = products
    .slice(0, 12)
    .map((p: any) => {
      const price =
        p.sale_price && p.sale_price < p.price ? p.sale_price : p.price;
      return `<article class="ssr-card">
${p.image_url ? `<img src="${esc(p.image_url)}" alt="${esc(p.name)}" width="400" height="500" loading="lazy" decoding="async">` : ""}
<div class="ssr-card-body">
<p class="ssr-card-name">${esc(p.name)}</p>
<p class="ssr-card-price">${currencySymbol}${Number(price).toLocaleString()}</p>
</div>
</article>`;
    })
    .join("\n");

  return `<section class="ssr-product-grid" aria-label="Products">\n${cards}\n</section>`;
}

function buildProductDetailHtml(
  product: any,
  store: any,
  primaryColor: string,
): string {
  const currencySymbol = getCurrencySymbol(store.currency || "INR");
  const price =
    product.sale_price && product.sale_price < product.price
      ? product.sale_price
      : product.price;

  return `<article style="max-width:800px;margin:0 auto;padding:16px">
${product.image_url ? `<img src="${esc(product.image_url)}" alt="${esc(product.name)}" style="width:100%;max-height:500px;object-fit:contain;border-radius:12px" width="800" height="800" fetchpriority="high">` : ""}
<h1 style="font-size:22px;margin:16px 0 8px">${esc(product.name)}</h1>
<p style="font-size:20px;font-weight:700;color:${esc(primaryColor)};margin:0 0 12px">${currencySymbol}${Number(price).toLocaleString()}</p>
${product.description ? `<p style="color:#666;line-height:1.6">${esc(product.description.slice(0, 300))}</p>` : ""}
</article>`;
}

function getCurrencySymbol(code: string): string {
  const map: Record<string, string> = {
    INR: "₹",
    USD: "$",
    EUR: "€",
    GBP: "£",
    AED: "AED ",
    SAR: "SAR ",
    BRL: "R$",
    NGN: "₦",
    ZAR: "R",
    PKR: "₨",
    BDT: "৳",
    EGP: "E£",
    MYR: "RM",
    IDR: "Rp",
    PHP: "₱",
  };
  return map[code] || `${code} `;
}
