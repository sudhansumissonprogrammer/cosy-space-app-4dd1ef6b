const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

import { createClient } from "npm:@supabase/supabase-js@2";

const ROOT_DOMAIN = "shopbanao.in";

function esc(str: string = ""): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatPrice(price: number, currency: string): string {
  const symbols: Record<string, string> = {
    INR: "₹",
    USD: "$",
    EUR: "€",
    GBP: "£",
  };
  return `${symbols[currency] || currency + " "}${price.toLocaleString()}`;
}

function buildProductHtml(
  store: any,
  product: any,
  images: any[],
  canonical: string
): string {
  const storeName = esc(store.name);
  const title = esc(`${product.name} — ${store.name}`);
  const desc = esc(
    product.description?.slice(0, 160) ||
      `Buy ${product.name} at ${store.name}. Fast delivery & easy returns.`
  );
  const price = formatPrice(
    product.sale_price || product.price,
    product.currency || store.currency || "INR"
  );
  const originalPrice =
    product.sale_price && product.price > product.sale_price
      ? formatPrice(product.price, product.currency || store.currency || "INR")
      : null;
  const heroImage = product.image_url || images?.[0]?.image_url || "";
  const allImages = [
    ...(product.image_url ? [product.image_url] : []),
    ...(images || []).map((i: any) => i.image_url).filter(Boolean),
  ].filter((v, i, a) => a.indexOf(v) === i); // dedupe

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description || "",
    image: allImages,
    offers: {
      "@type": "Offer",
      price: product.sale_price || product.price,
      priceCurrency: product.currency || store.currency || "INR",
      availability: product.stock_quantity > 0
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
    brand: { "@type": "Brand", name: store.name },
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:type" content="product">
<meta property="og:site_name" content="${storeName}">
${heroImage ? `<meta property="og:image" content="${esc(heroImage)}">` : ""}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${desc}">
${heroImage ? `<meta name="twitter:image" content="${esc(heroImage)}">` : ""}
<script type="application/ld+json">${jsonLd}</script>
<style>
body{font-family:system-ui,-apple-system,sans-serif;margin:0;padding:0;color:#1a1a1a;background:#fff}
.header{padding:16px 24px;border-bottom:1px solid #eee;display:flex;align-items:center;gap:12px}
.header img{height:40px;width:40px;object-fit:contain;border-radius:8px}
.header h2{margin:0;font-size:18px}
.container{max-width:1200px;margin:0 auto;padding:24px}
.product{display:flex;gap:32px;flex-wrap:wrap}
.gallery{flex:1;min-width:300px}
.gallery img{width:100%;max-width:500px;height:auto;border-radius:8px;display:block;margin-bottom:8px}
.thumbs{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}
.thumbs img{width:80px;height:80px;object-fit:cover;border-radius:4px;border:1px solid #ddd}
.info{flex:1;min-width:280px}
.info h1{font-size:28px;margin:0 0 12px}
.price{font-size:24px;font-weight:700;color:#16a34a;margin-bottom:8px}
.price .original{text-decoration:line-through;color:#999;font-size:18px;font-weight:400;margin-left:8px}
.stock{font-size:14px;color:#666;margin-bottom:16px}
.description{line-height:1.7;color:#333;white-space:pre-wrap}
.breadcrumb{font-size:14px;color:#666;margin-bottom:16px}
.breadcrumb a{color:#666;text-decoration:none}
.footer{margin-top:48px;padding:24px;border-top:1px solid #eee;text-align:center;color:#999;font-size:13px}
</style>
</head>
<body>
<header class="header">
${store.logo_url ? `<img src="${esc(store.logo_url)}" alt="${storeName} logo">` : ""}
<h2 style="font-family:'Alegreya SC',serif;letter-spacing:0.04em">${storeName}</h2>
</header>
<main class="container">
<nav class="breadcrumb">
<a href="${esc(canonical.split("/product/")[0])}">${storeName}</a> &rsaquo; ${esc(product.category || "Products")} &rsaquo; ${esc(product.name)}
</nav>
<article class="product" itemscope itemtype="https://schema.org/Product">
<div class="gallery">
${heroImage ? `<img src="${esc(heroImage)}" alt="${esc(product.name)}" itemprop="image" width="500" height="500" loading="eager">` : ""}
${allImages.length > 1 ? `<div class="thumbs">${allImages.slice(0, 6).map((img: string    ) => `<img src="${esc(img)}" alt="${esc(product.name)}" width="80" height="80" loading="lazy">`).join("")}</div>` : ""}
</div>
<div class="info">
<h1 itemprop="name">${esc(product.name)}</h1>
<div class="price" itemprop="offers" itemscope itemtype="https://schema.org/Offer">
<span itemprop="price" content="${product.sale_price || product.price}">${price}</span>
<meta itemprop="priceCurrency" content="${product.currency || store.currency || "INR"}">
${originalPrice ? `<span class="original">${originalPrice}</span>` : ""}
<link itemprop="availability" href="${product.stock_quantity > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock"}">
</div>
<p class="stock">${product.stock_quantity > 0 ? `In Stock (${product.stock_quantity} available)` : "Out of Stock"}</p>
${product.description ? `<div class="description" itemprop="description">${esc(product.description)}</div>` : ""}
</div>
</article>
</main>
<footer class="footer">&copy; ${new Date().getFullYear()} ${storeName}. All rights reserved.</footer>
<script>window.location.replace(${JSON.stringify(canonical)});</script>
</body>
</html>`;
}

function buildStoreHtml(
  store: any,
  products: any[],
  categories: any[],
  canonical: string
): string {
  const storeName = esc(store.name);
  const title = esc(store.meta_title || `${store.name} — Shop Online`);
  const desc = esc(
    store.meta_description ||
      store.description ||
      `Shop the best products at ${store.name}.`
  );
  const ogImage = store.og_image_url || store.banner_url || store.logo_url || "";

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Store",
    name: store.name,
    description: store.description || "",
    url: canonical,
    image: ogImage,
  });

  const productCards = products
    .slice(0, 30)
    .map((p: any) => {
      const pPrice = formatPrice(
        p.sale_price || p.price,
        p.currency || store.currency || "INR"
      );
      const pSlug = p.slug || p.id;
      return `<div class="card" itemscope itemtype="https://schema.org/Product">
<a href="${esc(canonical)}/product/${esc(pSlug)}">
${p.image_url ? `<img src="${esc(p.image_url)}" alt="${esc(p.name)}" width="280" height="280" loading="lazy" itemprop="image">` : `<div style="width:280px;height:280px;background:#f0f0f0"></div>`}
<h3 itemprop="name">${esc(p.name)}</h3>
<p class="card-price">${pPrice}</p>
</a>
</div>`;
    })
    .join("\n");

  const categoryLinks = categories
    .map(
      (c: any) =>
        `<a href="${esc(canonical)}/category/${esc(c.slug)}" class="cat-link">${esc(c.name)}</a>`
    )
    .join(" ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${storeName}">
${ogImage ? `<meta property="og:image" content="${esc(ogImage)}">` : ""}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${desc}">
${ogImage ? `<meta name="twitter:image" content="${esc(ogImage)}">` : ""}
<script type="application/ld+json">${jsonLd}</script>
<style>
body{font-family:system-ui,-apple-system,sans-serif;margin:0;padding:0;color:#1a1a1a;background:#fff}
.header{padding:16px 24px;border-bottom:1px solid #eee;display:flex;align-items:center;gap:12px}
.header img{height:40px;width:40px;object-fit:contain;border-radius:8px}
.header h2{margin:0;font-size:18px}
.container{max-width:1200px;margin:0 auto;padding:24px}
.hero{margin-bottom:24px}
.hero h1{font-size:32px;margin:0 0 8px}
.hero p{color:#666;font-size:16px;margin:0}
.categories{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:24px}
.cat-link{padding:8px 16px;background:#f5f5f5;border-radius:20px;text-decoration:none;color:#333;font-size:14px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:20px}
.card{border:1px solid #eee;border-radius:8px;overflow:hidden}
.card a{text-decoration:none;color:inherit}
.card img{width:100%;height:280px;object-fit:cover}
.card h3{margin:12px 12px 4px;font-size:16px}
.card-price{margin:4px 12px 12px;font-weight:700;color:#16a34a}
.footer{margin-top:48px;padding:24px;border-top:1px solid #eee;text-align:center;color:#999;font-size:13px}
</style>
</head>
<body>
<header class="header">
${store.logo_url ? `<img src="${esc(store.logo_url)}" alt="${storeName} logo">` : ""}
<h2 style="font-family:'Alegreya SC',serif;letter-spacing:0.04em">${storeName}</h2>
</header>
<main class="container">
<section class="hero">
<h1>${storeName}</h1>
${store.description ? `<p>${esc(store.description)}</p>` : ""}
</section>
${categories.length > 0 ? `<nav class="categories">${categoryLinks}</nav>` : ""}
<section class="grid">
${productCards}
</section>
${products.length > 30 ? `<p style="text-align:center;color:#666;margin-top:24px">Showing 30 of ${products.length} products</p>` : ""}
</main>
<footer class="footer">&copy; ${new Date().getFullYear()} ${storeName}. All rights reserved.</footer>
<script>window.location.replace(${JSON.stringify(canonical)});</script>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// v2 builders — category, custom pages, listing pages, static info pages.
// All emit BreadcrumbList JSON-LD + canonical pointing at primary domain.
// ─────────────────────────────────────────────────────────────────────────────

function buildBreadcrumb(items: Array<{ name: string; url: string }>): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  });
}

function renderProductCard(
  store: any,
  p: any,
  canonicalBase: string,
): string {
  const pPrice = formatPrice(
    p.sale_price || p.price,
    p.currency || store.currency || "INR",
  );
  const pSlug = p.slug || p.id;
  return `<div class="card" itemscope itemtype="https://schema.org/Product">
<a href="${esc(canonicalBase)}/product/${esc(pSlug)}">
${p.image_url ? `<img src="${esc(p.image_url)}" alt="${esc(p.name)}" width="280" height="280" loading="lazy" itemprop="image">` : `<div style="width:280px;height:280px;background:#f0f0f0"></div>`}
<h3 itemprop="name">${esc(p.name)}</h3>
<p class="card-price">${pPrice}</p>
</a>
</div>`;
}

const SHARED_STYLE = `body{font-family:system-ui,-apple-system,sans-serif;margin:0;padding:0;color:#1a1a1a;background:#fff}
.header{padding:16px 24px;border-bottom:1px solid #eee;display:flex;align-items:center;gap:12px}
.header img{height:40px;width:40px;object-fit:contain;border-radius:8px}
.header h2{margin:0;font-size:18px}
.container{max-width:1200px;margin:0 auto;padding:24px}
.hero{margin-bottom:24px}
.hero h1{font-size:32px;margin:0 0 8px}
.hero p{color:#666;font-size:16px;margin:0}
.breadcrumb{font-size:14px;color:#666;margin-bottom:16px}
.breadcrumb a{color:#666;text-decoration:none}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:20px}
.card{border:1px solid #eee;border-radius:8px;overflow:hidden}
.card a{text-decoration:none;color:inherit}
.card img{width:100%;height:280px;object-fit:cover}
.card h3{margin:12px 12px 4px;font-size:16px}
.card-price{margin:4px 12px 12px;font-weight:700;color:#16a34a}
.cat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px;margin:24px 0}
.cat-card{padding:24px;background:#f8f8f8;border-radius:8px;text-align:center;text-decoration:none;color:#1a1a1a;font-weight:600}
.cat-card:hover{background:#eee}
.prose{line-height:1.75;color:#333;max-width:760px}
.prose h2{font-size:22px;margin-top:32px}
.prose p{margin:12px 0}
.cta{display:inline-block;margin-top:16px;padding:12px 20px;background:#1a1a1a;color:#fff;text-decoration:none;border-radius:6px;font-weight:600}
.footer{margin-top:48px;padding:24px;border-top:1px solid #eee;text-align:center;color:#999;font-size:13px}`;

function buildShellHead(opts: {
  title: string;
  desc: string;
  canonical: string;
  storeName: string;
  ogImage?: string;
  jsonLd: string[];
  ogType?: string;
}): string {
  const { title, desc, canonical, storeName, ogImage, jsonLd, ogType = "website" } = opts;
  return `<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canonical)}">
<meta name="robots" content="index,follow">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="${esc(storeName)}">
${ogImage ? `<meta property="og:image" content="${esc(ogImage)}">` : ""}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
${ogImage ? `<meta name="twitter:image" content="${esc(ogImage)}">` : ""}
${jsonLd.map((j) => `<script type="application/ld+json">${j}</script>`).join("\n")}
<style>${SHARED_STYLE}</style>
</head>`;
}

function buildShellHeader(store: any): string {
  const storeName = esc(store.name);
  return `<header class="header">
${store.logo_url ? `<img src="${esc(store.logo_url)}" alt="${storeName} logo">` : ""}
<h2 style="font-family:'Alegreya SC',serif;letter-spacing:0.04em">${storeName}</h2>
</header>`;
}

function buildShellFooter(store: any, canonical: string): string {
  return `<footer class="footer">&copy; ${new Date().getFullYear()} ${esc(store.name)}. All rights reserved.</footer>
<script>window.location.replace(${JSON.stringify(canonical)});</script>`;
}

function buildCategoryHtml(
  store: any,
  category: { name: string; slug: string; description?: string | null },
  products: any[],
  canonical: string,
  storeBase: string,
): string {
  const storeName = esc(store.name);
  const title = `${category.name} — ${store.name}`;
  const desc =
    category.description?.slice(0, 160) ||
    `Shop ${category.name} at ${store.name}. ${products.length} products available.`;
  const ogImage = products[0]?.image_url || store.og_image_url || store.banner_url || store.logo_url || "";

  const itemList = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${category.name} — ${store.name}`,
    numberOfItems: products.length,
    itemListElement: products.slice(0, 30).map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${storeBase}/product/${p.slug || p.id}`,
      name: p.name,
    })),
  });

  const breadcrumb = buildBreadcrumb([
    { name: store.name, url: storeBase },
    { name: "Categories", url: `${storeBase}/categories` },
    { name: category.name, url: canonical },
  ]);

  const cards = products.slice(0, 30).map((p) => renderProductCard(store, p, storeBase)).join("\n");

  return `<!DOCTYPE html><html lang="en">${buildShellHead({
    title,
    desc,
    canonical,
    storeName: store.name,
    ogImage,
    jsonLd: [itemList, breadcrumb],
  })}<body>
${buildShellHeader(store)}
<main class="container">
<nav class="breadcrumb"><a href="${esc(storeBase)}">${storeName}</a> &rsaquo; <a href="${esc(storeBase)}/categories">Categories</a> &rsaquo; ${esc(category.name)}</nav>
<section class="hero"><h1>${esc(category.name)}</h1>${category.description ? `<p>${esc(category.description)}</p>` : ""}</section>
<section class="grid">${cards || `<p>No products in this category yet.</p>`}</section>
${products.length > 30 ? `<p style="text-align:center;color:#666;margin-top:24px">Showing 30 of ${products.length} products</p>` : ""}
</main>
${buildShellFooter(store, canonical)}
</body></html>`;
}

function buildListingHtml(
  store: any,
  products: any[],
  opts: { kind: "shop" | "best-sellers"; title: string; desc: string },
  canonical: string,
  storeBase: string,
): string {
  const ogImage = products[0]?.image_url || store.og_image_url || store.banner_url || store.logo_url || "";
  const breadcrumb = buildBreadcrumb([
    { name: store.name, url: storeBase },
    { name: opts.kind === "shop" ? "Shop" : "Best Sellers", url: canonical },
  ]);
  const cards = products.slice(0, 30).map((p) => renderProductCard(store, p, storeBase)).join("\n");
  return `<!DOCTYPE html><html lang="en">${buildShellHead({
    title: opts.title,
    desc: opts.desc,
    canonical,
    storeName: store.name,
    ogImage,
    jsonLd: [breadcrumb],
  })}<body>
${buildShellHeader(store)}
<main class="container">
<nav class="breadcrumb"><a href="${esc(storeBase)}">${esc(store.name)}</a> &rsaquo; ${opts.kind === "shop" ? "Shop" : "Best Sellers"}</nav>
<section class="hero"><h1>${esc(opts.title)}</h1><p>${esc(opts.desc)}</p></section>
<section class="grid">${cards || `<p>No products yet.</p>`}</section>
</main>
${buildShellFooter(store, canonical)}
</body></html>`;
}

function buildCategoriesIndexHtml(
  store: any,
  categories: any[],
  canonical: string,
  storeBase: string,
): string {
  const title = `Browse categories — ${store.name}`;
  const desc = `Browse all ${categories.length} product categories at ${store.name}.`;
  const breadcrumb = buildBreadcrumb([
    { name: store.name, url: storeBase },
    { name: "Categories", url: canonical },
  ]);
  const itemList = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: title,
    numberOfItems: categories.length,
    itemListElement: categories.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${storeBase}/category/${c.slug}`,
      name: c.name,
    })),
  });
  const links = categories
    .map((c) => `<a class="cat-card" href="${esc(storeBase)}/category/${esc(c.slug)}">${esc(c.name)}</a>`)
    .join("");
  return `<!DOCTYPE html><html lang="en">${buildShellHead({
    title,
    desc,
    canonical,
    storeName: store.name,
    ogImage: store.og_image_url || store.banner_url || store.logo_url || "",
    jsonLd: [itemList, breadcrumb],
  })}<body>
${buildShellHeader(store)}
<main class="container">
<nav class="breadcrumb"><a href="${esc(storeBase)}">${esc(store.name)}</a> &rsaquo; Categories</nav>
<section class="hero"><h1>Categories</h1><p>${esc(desc)}</p></section>
<nav class="cat-grid">${links || `<p>No categories yet.</p>`}</nav>
</main>
${buildShellFooter(store, canonical)}
</body></html>`;
}

// Strip <script>/<style> blocks and dangerous attrs from merchant-authored HTML
// before rendering for bots. Bots don't execute JS but Google still flags risky
// content for the canonical URL — keep it conservative.
function sanitizeContent(html: string): string {
  if (!html) return "";
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "");
}

function buildCustomPageHtml(
  store: any,
  page: { title: string; content: string | null; custom_html: string | null; image_url: string | null; slug: string },
  canonical: string,
  storeBase: string,
): string {
  const body = sanitizeContent(page.custom_html || page.content || "");
  const desc = (page.content || "").replace(/<[^>]+>/g, "").slice(0, 160) || `${page.title} — ${store.name}`;
  const ogImage = page.image_url || store.og_image_url || store.banner_url || store.logo_url || "";

  const breadcrumb = buildBreadcrumb([
    { name: store.name, url: storeBase },
    { name: page.title, url: canonical },
  ]);
  const webPage = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: page.title,
    url: canonical,
    isPartOf: { "@type": "WebSite", name: store.name, url: storeBase },
  });

  return `<!DOCTYPE html><html lang="en">${buildShellHead({
    title: `${page.title} — ${store.name}`,
    desc,
    canonical,
    storeName: store.name,
    ogImage,
    jsonLd: [webPage, breadcrumb],
    ogType: "article",
  })}<body>
${buildShellHeader(store)}
<main class="container">
<nav class="breadcrumb"><a href="${esc(storeBase)}">${esc(store.name)}</a> &rsaquo; ${esc(page.title)}</nav>
<article>
<h1>${esc(page.title)}</h1>
<div class="prose">${body || `<p>No content yet.</p>`}</div>
</article>
</main>
${buildShellFooter(store, canonical)}
</body></html>`;
}

function buildStaticInfoHtml(
  store: any,
  kind: "about" | "contact" | "track-order" | "faq",
  canonical: string,
  storeBase: string,
): string {
  const aboutText: string = store.seo_about_paragraph || store.about_us_text || store.description || "";
  const usp: string[] = Array.isArray(store.usp_bullets) ? store.usp_bullets.filter(Boolean) : [];
  const faq: Array<{ q: string; a: string }> = Array.isArray(store.faq_items)
    ? store.faq_items.filter((f: any) => f && f.q && f.a)
    : [];

  const labels: Record<string, { title: string; intro: string; ogType: string }> = {
    about: {
      title: `About ${store.name}`,
      intro: aboutText || `${store.name} is an online store serving customers across India.`,
      ogType: "website",
    },
    contact: {
      title: `Contact ${store.name}`,
      intro: `Get in touch with ${store.name} for orders, support, and feedback.`,
      ogType: "website",
    },
    "track-order": {
      title: `Track your order — ${store.name}`,
      intro: `Track the live status of your order from ${store.name}.`,
      ogType: "website",
    },
    faq: {
      title: `FAQ — ${store.name}`,
      intro: `Frequently asked questions about shopping at ${store.name}.`,
      ogType: "website",
    },
  };
  const meta = labels[kind];
  const breadcrumb = buildBreadcrumb([
    { name: store.name, url: storeBase },
    { name: meta.title, url: canonical },
  ]);

  const lines: string[] = [];

  if (kind === "about") {
    if (aboutText) lines.push(`<p>${esc(aboutText)}</p>`);
    if (store.city || store.state) {
      lines.push(`<p><strong>Based in:</strong> ${esc([store.city, store.state].filter(Boolean).join(", "))}, India.</p>`);
    }
    if (usp.length) {
      lines.push(`<h2>Why choose ${esc(store.name)}</h2>`);
      lines.push(`<ul>${usp.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`);
    }
    const contactBits: string[] = [];
    if (store.whatsapp_number) contactBits.push(`WhatsApp <a href="https://wa.me/${esc(String(store.whatsapp_number).replace(/[^0-9]/g, ""))}">${esc(store.whatsapp_number)}</a>`);
    if (store.instagram_url) contactBits.push(`<a href="${esc(store.instagram_url)}">Instagram</a>`);
    if (store.facebook_url) contactBits.push(`<a href="${esc(store.facebook_url)}">Facebook</a>`);
    if (contactBits.length) {
      lines.push(`<h2>Get in touch</h2><p>${contactBits.join(" · ")}</p>`);
    }
  } else if (kind === "contact") {
    lines.push(`<p>${esc(meta.intro)}</p>`);
    if (store.whatsapp_number) lines.push(`<p><strong>WhatsApp:</strong> <a href="https://wa.me/${esc(String(store.whatsapp_number).replace(/[^0-9]/g, ""))}">${esc(store.whatsapp_number)}</a></p>`);
    if (store.city || store.state) lines.push(`<p><strong>Location:</strong> ${esc([store.city, store.state].filter(Boolean).join(", "))}, India</p>`);
    if (store.instagram_url) lines.push(`<p><strong>Instagram:</strong> <a href="${esc(store.instagram_url)}">${esc(store.instagram_url)}</a></p>`);
    if (store.facebook_url) lines.push(`<p><strong>Facebook:</strong> <a href="${esc(store.facebook_url)}">${esc(store.facebook_url)}</a></p>`);
    // Business hours block (read by AI engines for "is X open?" queries)
    const bh = store.business_hours;
    if (bh && typeof bh === "object") {
      const dayLabels: Record<string, string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
      const hours = Object.entries(dayLabels)
        .map(([k, label]) => bh[k] ? `<li><strong>${label}:</strong> ${esc(String(bh[k]))}</li>` : null)
        .filter(Boolean);
      if (hours.length) lines.push(`<h2>Business hours</h2><ul>${hours.join("")}</ul>`);
    }
  } else if (kind === "faq") {
    lines.push(`<p>${esc(meta.intro)}</p>`);
    if (faq.length) {
      lines.push(`<dl class="faq">`);
      for (const item of faq) {
        lines.push(`<dt><strong>${esc(item.q)}</strong></dt><dd>${esc(item.a)}</dd>`);
      }
      lines.push(`</dl>`);
    } else {
      lines.push(`<p>No FAQs yet. Contact us via WhatsApp${store.whatsapp_number ? ` at ${esc(store.whatsapp_number)}` : ""} for any questions.</p>`);
    }
  } else {
    lines.push(`<p>${esc(meta.intro)}</p>`);
  }

  const jsonLdBlocks: any[] = [breadcrumb];

  // FAQPage schema — only on /faq page (per Google guidelines)
  if (kind === "faq" && faq.length) {
    jsonLdBlocks.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    });
  }

  // AboutPage schema for /about — strong signal for AI engines
  if (kind === "about") {
    jsonLdBlocks.push({
      "@context": "https://schema.org",
      "@type": "AboutPage",
      name: meta.title,
      url: canonical,
      mainEntity: {
        "@type": "Organization",
        name: store.name,
        description: aboutText || undefined,
        url: storeBase,
        ...(store.logo_url ? { logo: store.logo_url } : {}),
        ...(store.whatsapp_number ? { telephone: store.whatsapp_number } : {}),
        ...(store.city || store.state
          ? {
              address: {
                "@type": "PostalAddress",
                ...(store.city ? { addressLocality: store.city } : {}),
                ...(store.state ? { addressRegion: store.state } : {}),
                addressCountry: "IN",
              },
            }
          : {}),
      },
    });
  }

  // ContactPage schema for /contact
  if (kind === "contact") {
    jsonLdBlocks.push({
      "@context": "https://schema.org",
      "@type": "ContactPage",
      name: meta.title,
      url: canonical,
      mainEntity: {
        "@type": "Organization",
        name: store.name,
        ...(store.whatsapp_number
          ? {
              contactPoint: {
                "@type": "ContactPoint",
                telephone: store.whatsapp_number,
                contactType: "customer service",
                availableLanguage: ["English", "Hindi"],
              },
            }
          : {}),
      },
    });
  }

  return `<!DOCTYPE html><html lang="en">${buildShellHead({
    title: meta.title,
    desc: (aboutText || meta.intro).slice(0, 160),
    canonical,
    storeName: store.name,
    ogImage: store.og_image_url || store.banner_url || store.logo_url || "",
    jsonLd: jsonLdBlocks,
    ogType: meta.ogType,
  })}<body>
${buildShellHeader(store)}
<main class="container">
<nav class="breadcrumb"><a href="${esc(storeBase)}">${esc(store.name)}</a> &rsaquo; ${esc(meta.title)}</nav>
<article><h1>${esc(meta.title)}</h1><div class="prose">${lines.join("")}</div></article>
</main>
${buildShellFooter(store, canonical)}
</body></html>`;
}

// ─────────────────────────────────────────────────────────────────────────────

const HTML_CACHE_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  const productSlug = url.searchParams.get("product");
  const domain = url.searchParams.get("domain");
  const isSocial = url.searchParams.get("social") === "true";
  // v2: richer route kinds. Falls back to product/home for backwards compat.
  const kindParam = (url.searchParams.get("kind") || "").toLowerCase();
  const routeSlug = url.searchParams.get("route_slug") || "";

  if (!slug) {
    return new Response(JSON.stringify({ error: "Missing slug" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Fetch store
  const { data: store, error: storeErr } = await supabase
    .from("stores")
    .select("id, name, slug, description, logo_url, banner_url, currency, meta_title, meta_description, og_image_url, custom_domain, whatsapp_number, instagram_url, facebook_url, order_mode, theme, features, best_selling_carousel, location, city, state, business_hours, return_policy, shipping_policy, is_suspended, is_verified, created_at, updated_at, mobile_hero_url, mobile_hero_images, facebook_pixel_id, about_us_text, seo_about_paragraph, faq_items, usp_bullets")
    .eq("slug", slug)
    .single();

  if (storeErr || !store) {
    return new Response("Store not found", {
      status: 404,
      headers: corsHeaders,
    });
  }

  // og:image fallback chain: og_image_url → banner_url → logo_url → first product image.
  // Backfill store.og_image_url so every downstream builder (categories, legal, contact,
  // not-found) inherits the product fallback without per-callsite changes.
  if (!store.og_image_url && !store.banner_url && !store.logo_url) {
    const { data: firstProd } = await supabase
      .from("products")
      .select("image_url")
      .eq("store_id", store.id)
      .eq("is_active", true)
      .not("image_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (firstProd?.image_url) {
      (store as any).og_image_url = firstProd.image_url;
    }
  }

  // Build canonical URL
  // Sanitize domain to prevent injection
  const safeDomain = domain ? domain.replace(/[^a-zA-Z0-9.\-]/g, "") : null;
  const canonical = safeDomain
    ? `https://${safeDomain}`
    : `https://${slug}.${ROOT_DOMAIN}`;

  // ── Social bot JSON response (for WhatsApp, Facebook, Telegram, etc.) ──
  if (isSocial) {
    if (productSlug) {
      let product: any = null;
      const { data: bySlug } = await supabase
        .from("products")
        .select("id, name, slug, description, price, sale_price, currency, image_url")
        .eq("store_id", store.id)
        .eq("slug", productSlug)
        .eq("is_active", true)
        .single();
      product = bySlug;
      if (!product) {
        const { data: byId } = await supabase
          .from("products")
          .select("id, name, slug, description, price, sale_price, currency, image_url")
          .eq("store_id", store.id)
          .eq("id", productSlug)
          .eq("is_active", true)
          .single();
        product = byId;
      }
      if (product) {
        const price = product.sale_price || product.price;
        const currency = product.currency || store.currency || "INR";
        const currencySymbol = currency === "INR" ? "₹" : currency === "USD" ? "$" : currency + " ";
        return new Response(JSON.stringify({
          title: `${product.name} — ${currencySymbol}${price}`,
          description: product.description?.slice(0, 160) || `Buy ${product.name} at ${store.name}. Fast delivery & easy returns.`,
          image: product.image_url || store.og_image_url || store.banner_url || store.logo_url || "",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
        });
      }
    }
    // Store-level OG data
    return new Response(JSON.stringify({
      title: store.meta_title || `${store.name} — Shop Online`,
      description: store.meta_description || store.description || `Shop the best products at ${store.name}. Fast delivery & easy returns.`,
      image: store.og_image_url || store.banner_url || store.logo_url || "",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
    });
  }

  // ── v2 routing — explicit kind takes precedence ────────────────────────
  // Backwards compat: if kind is missing but productSlug present, treat as product.
  const effectiveKind: string = kindParam
    || (productSlug ? "product" : "home");

  // Category page
  if (effectiveKind === "category" && routeSlug) {
    const { data: cat } = await supabase
      .from("categories")
      .select("id, name, slug, description")
      .eq("store_id", store.id)
      .eq("slug", routeSlug)
      .maybeSingle();
    if (!cat) return new Response("Category not found", { status: 404, headers: corsHeaders });

    const { data: catProducts } = await supabase
      .from("products")
      .select("id, name, slug, price, sale_price, currency, image_url, stock_quantity, category")
      .eq("store_id", store.id)
      .eq("is_active", true)
      .eq("category", cat.name)
      .order("is_best_selling", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50);

    const html = buildCategoryHtml(
      store,
      cat as any,
      catProducts || [],
      `${canonical}/category/${cat.slug}`,
      canonical,
    );
    return new Response(html, { headers: { ...corsHeaders, ...HTML_CACHE_HEADERS } });
  }

  // Merchant-authored custom page (/page/:slug)
  if (effectiveKind === "page" && routeSlug) {
    const { data: page } = await supabase
      .from("store_pages")
      .select("title, content, custom_html, image_url, slug, is_active")
      .eq("store_id", store.id)
      .eq("slug", routeSlug)
      .eq("is_active", true)
      .maybeSingle();
    if (!page) return new Response("Page not found", { status: 404, headers: corsHeaders });
    const html = buildCustomPageHtml(
      store,
      page as any,
      `${canonical}/page/${page.slug}`,
      canonical,
    );
    return new Response(html, { headers: { ...corsHeaders, ...HTML_CACHE_HEADERS } });
  }

  // Listing pages — /shop and /best-sellers
  if (effectiveKind === "shop" || effectiveKind === "best-sellers") {
    const baseQuery = supabase
      .from("products")
      .select("id, name, slug, price, sale_price, currency, image_url, stock_quantity, category")
      .eq("store_id", store.id)
      .eq("is_active", true);
    const { data: listingProducts } = effectiveKind === "best-sellers"
      ? await baseQuery.eq("is_best_selling", true).order("created_at", { ascending: false }).limit(50)
      : await baseQuery.order("is_best_selling", { ascending: false }).order("created_at", { ascending: false }).limit(50);

    const opts = effectiveKind === "best-sellers"
      ? { kind: "best-sellers" as const, title: `Best sellers at ${store.name}`, desc: `Top-selling products at ${store.name}.` }
      : { kind: "shop" as const, title: `Shop all products — ${store.name}`, desc: `Browse the full product catalog at ${store.name}.` };
    const html = buildListingHtml(
      store,
      listingProducts || [],
      opts,
      `${canonical}/${effectiveKind}`,
      canonical,
    );
    return new Response(html, { headers: { ...corsHeaders, ...HTML_CACHE_HEADERS } });
  }

  // Categories index page
  if (effectiveKind === "categories") {
    const { data: cats } = await supabase
      .from("categories")
      .select("name, slug")
      .eq("store_id", store.id)
      .order("name");
    const html = buildCategoriesIndexHtml(store, cats || [], `${canonical}/categories`, canonical);
    return new Response(html, { headers: { ...corsHeaders, ...HTML_CACHE_HEADERS } });
  }

  // Static info routes
  if (effectiveKind === "about" || effectiveKind === "contact" || effectiveKind === "track-order") {
    const html = buildStaticInfoHtml(store, effectiveKind, `${canonical}/${effectiveKind}`, canonical);
    return new Response(html, { headers: { ...corsHeaders, ...HTML_CACHE_HEADERS } });
  }

  // Product page
  if (effectiveKind === "product" && productSlug) {
    let product: any = null;
    const { data: bySlug } = await supabase
      .from("products")
      .select("id, name, slug, description, price, sale_price, currency, image_url, stock_quantity, category, is_active")
      .eq("store_id", store.id)
      .eq("slug", productSlug)
      .eq("is_active", true)
      .single();
    product = bySlug;
    if (!product) {
      const { data: byId } = await supabase
        .from("products")
        .select("id, name, slug, description, price, sale_price, currency, image_url, stock_quantity, category, is_active")
        .eq("store_id", store.id)
        .eq("id", productSlug)
        .eq("is_active", true)
        .single();
      product = byId;
    }
    if (!product) {
      return new Response("Product not found", { status: 404, headers: corsHeaders });
    }
    const { data: images } = await supabase
      .from("product_images")
      .select("image_url, display_order")
      .eq("product_id", product.id)
      .order("display_order", { ascending: true })
      .limit(6);

    const productCanonical = `${canonical}/product/${product.slug || product.id}`;
    const html = buildProductHtml(store, product, images || [], productCanonical);
    return new Response(html, { headers: { ...corsHeaders, ...HTML_CACHE_HEADERS } });
  }

  // Store home page (default)
  const { data: products } = await supabase
    .from("products")
    .select("id, name, slug, price, sale_price, currency, image_url, stock_quantity, category")
    .eq("store_id", store.id)
    .eq("is_active", true)
    .order("is_best_selling", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: categories } = await supabase
    .from("categories")
    .select("name, slug")
    .eq("store_id", store.id)
    .order("name");

  const html = buildStoreHtml(store, products || [], categories || [], canonical);
  return new Response(html, { headers: { ...corsHeaders, ...HTML_CACHE_HEADERS } });
});
