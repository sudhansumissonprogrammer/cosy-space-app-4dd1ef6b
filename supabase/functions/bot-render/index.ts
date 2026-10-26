import { productSearchDescription, productSearchPrice } from "../_shared/productSeo.ts";
import { discoveryAvailability } from "../_shared/productDiscoveryFacts.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { discoveryPage, discoveryUrl, DISCOVERY_PAGE_SIZE, productImageUrls } from "../_shared/seoDiscovery.ts";

import { createClient } from "npm:@supabase/supabase-js@2";
import TurndownService from "npm:turndown@7.2.0";
import { prefersMarkdown } from "../_shared/agentContent.ts";
import { isUtkalContentStore, UTKAL_HOME_HEADING, UTKAL_STATUS, UTKAL_QUALITY_TERMS, UTKAL_SHOP_TITLE, UTKAL_SHOP_INTRO, utkalCollectionIntroduction } from "../_shared/utkalContent.ts";
import { cityFaqItems, cityIntroParagraph, cityPageDescription, cityPageH1, cityPageTitle, directoryDescription, directoryH1, directoryTitle, formatOpeningHours, locationTypeLabel, mapsSearchUrl } from "../_shared/storeLocations.ts";

/** wa.me needs a country code — owners often save a bare 10-digit mobile. */
function waPhone(raw: unknown): string {
  let d = String(raw ?? "").replace(/[^0-9]/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 13 && d.startsWith("091")) d = d.slice(1);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (d.length === 10) d = `91${d}`;
  return d.length >= 11 ? d : "";
}


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
  const title = esc(product.meta_title || `${product.name} — ${store.name}`);
  const desc = esc(
    productSearchDescription(product, store.name)
  );
  const price = formatPrice(
    productSearchPrice(product),
    product.currency || store.currency || "INR"
  );
  const originalPrice =
    product.sale_price && product.price > product.sale_price
      ? formatPrice(product.price, product.currency || store.currency || "INR")
      : null;
  const allImages = productImageUrls(product.image_url, (images || []).map(i => i.image_url));
  const heroImage = allImages[0] || "";
  const availability = discoveryAvailability(product.stock_quantity);

  const storeBaseForCrumb = canonical.split("/product/")[0];
  const categoryName = product.seo_category?.name || "Shop All";
  const categoryUrl = product.seo_category?.slug ? `${storeBaseForCrumb}/category/${product.seo_category.slug}` : `${storeBaseForCrumb}/shop`;
  const productJsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    ...(product.description?.trim() ? { description: product.description } : {}),
    image: allImages,
    ...(product.sku ? { sku: product.sku } : {}),
    
    url: canonical,
    offers: {
      "@type": "Offer",
      price: productSearchPrice(product),
      priceCurrency: product.currency || store.currency || "INR",
      ...(availability ? { availability: availability === "in stock" ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" } : {}),
      url: canonical,


      seller: { "@type": "Organization", name: store.name },
    },

  });
  const breadcrumbJsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: store.name, item: storeBaseForCrumb },
      { "@type": "ListItem", position: 2, name: categoryName, item: categoryUrl },
      { "@type": "ListItem", position: 3, name: product.name, item: canonical },
    ],
  });
  const jsonLd = `${productJsonLd}</script>\n<script type="application/ld+json">${breadcrumbJsonLd}`;

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
${heroImage ? `<meta property="og:image" content="${esc(heroImage)}">
<meta property="og:image:alt" content="${esc(product.name)}">` : ""}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${desc}">
${heroImage ? `<meta name="twitter:image" content="${esc(heroImage)}">
<meta name="twitter:image:alt" content="${esc(product.name)}">` : ""}
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
<a href="${esc(canonical.split("/product/")[0])}">${storeName}</a> &rsaquo; <a href="${esc(categoryUrl)}">${esc(categoryName)}</a> &rsaquo; ${esc(product.name)}
</nav>
<article class="product" itemscope itemtype="https://schema.org/Product">
<div class="gallery">
${heroImage ? `<img src="${esc(heroImage)}" alt="${esc(product.name)}" itemprop="image" width="500" height="500" loading="eager">` : ""}
${allImages.filter((img) => img !== heroImage).slice(0, 9).map((img: string, i: number) => `<img src="${esc(img)}" alt="${esc(`${product.name} - photo ${i + 2}`)}" itemprop="image" width="500" height="500" loading="lazy">`).join("\n")}
</div>
<div class="info">
<h1 itemprop="name">${esc(product.name)}</h1>
${isUtkalContentStore(store) ? `<p>${esc(UTKAL_STATUS)}</p>` : ""}
<div class="price" itemprop="offers" itemscope itemtype="https://schema.org/Offer">
<span itemprop="price" content="${productSearchPrice(product)}">${price}</span>
<meta itemprop="priceCurrency" content="${product.currency || store.currency || "INR"}">
${originalPrice ? `<span class="original">${originalPrice}</span>` : ""}
${availability ? `<link itemprop="availability" href="${availability === "in stock" ? "https://schema.org/InStock" : "https://schema.org/OutOfStock"}">` : ""}
</div>
${availability ? `<p class="stock">${availability === "in stock" ? "In Stock" : "Out of Stock"}</p>` : ""}
${product.description ? `<div class="description" itemprop="description">${esc(product.description)}</div>` : ""}
${isUtkalContentStore(store) ? `<h2>Product information</h2><p>${esc(UTKAL_QUALITY_TERMS)}</p>` : ""}
</div>
</article>
</main>
<footer class="footer">&copy; ${new Date().getFullYear()} ${storeName}. All rights reserved.</footer>
</body>
</html>`;
}

function buildStoreHtml(
  store: any,
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
  // Store homepage must remain store/brand focused. Do not fall back to a
  // product image here: Meta ad review can treat a homepage whose preview/body
  // is dominated by a single product as landing-page mismatch. Product imagery
  // belongs on /product, /category, /shop, and /best-sellers only.
  const ogImage = store.og_image_url || store.banner_url || store.logo_url || "";

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Store",
    name: store.name,
    description: store.description || "",
    url: canonical,
    image: ogImage,
  });

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
.hero{margin-bottom:24px;max-width:760px}
.hero h1{font-size:32px;margin:0 0 8px}
.hero p{color:#666;font-size:16px;margin:0}
.categories{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:24px}
.cat-link{padding:8px 16px;background:#f5f5f5;border-radius:20px;text-decoration:none;color:#333;font-size:14px}
.info{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-top:24px}
.info-card{background:#f8f8f8;border:1px solid #eee;border-radius:8px;padding:16px}
.info-card h2{font-size:16px;margin:0 0 8px}.info-card p{margin:0;color:#555;line-height:1.6}
.cta{display:inline-block;margin-top:16px;padding:12px 20px;background:#1a1a1a;color:#fff;text-decoration:none;border-radius:6px;font-weight:600}
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
<h1>${isUtkalContentStore(store) ? esc(UTKAL_HOME_HEADING) : storeName}</h1>
${store.description ? `<p>${esc(store.description)}</p>` : ""}
${isUtkalContentStore(store) ? `<h2>Before choosing a watch</h2><p>${esc(UTKAL_STATUS)}</p><p>${esc(UTKAL_QUALITY_TERMS)}</p>` : ""}
<a class="cta" href="${esc(canonical)}/shop">Shop products</a>
</section>
${categories.length > 0 ? `<nav class="categories">${categoryLinks}</nav>` : ""}
<section class="info">
<div class="info-card"><h2>About ${storeName}</h2><p>${esc(store.description || `${store.name} is an online store serving customers across India.`)}</p></div>
${store.city || store.state ? `<div class="info-card"><h2>Location</h2><p>${esc([store.city, store.state].filter(Boolean).join(", "))}, India</p></div>` : ""}
${store.whatsapp_number ? `<div class="info-card"><h2>Contact</h2><p>WhatsApp: <a href="https://wa.me/${esc(waPhone(store.whatsapp_number))}">${esc(store.whatsapp_number)}</a></p></div>` : ""}
</section>
</main>
<footer class="footer">&copy; ${new Date().getFullYear()} ${storeName}. All rights reserved.</footer>
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
  // Listing cards intentionally carry NO Product microdata: the product page
  // is the only page that declares a product, so Google Images / Lens send
  // visitors from a product photo to that product page, not to this listing.
  return `<div class="card">
<a href="${esc(canonicalBase)}/product/${esc(pSlug)}">
${p.image_url ? `<img src="${esc(p.image_url)}" alt="${esc(p.name)}" width="280" height="280" loading="lazy">` : `<div style="width:280px;height:280px;background:#f0f0f0"></div>`}
<h3>${esc(p.name)}</h3>
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
  jsonLd: (string | Record<string, any>)[];
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
${jsonLd.map((j) => `<script type="application/ld+json">${typeof j === "string" ? j : JSON.stringify(j)}</script>`).join("\n")}
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
  return `<footer class="footer">&copy; ${new Date().getFullYear()} ${esc(store.name)}. All rights reserved.</footer>`;
}

function renderPagination(base: string, page: number, hasNext: boolean): string {
  return `<nav aria-label="Product pages">${page > 1 ? `<a href="${esc(discoveryUrl(base, page - 1))}">Previous page</a>` : ""} ${hasNext ? `<a href="${esc(discoveryUrl(base, page + 1))}">Next page</a>` : ""}</nav>`;
}

function buildCategoryHtml(
  store: any,
  category: { name: string; slug: string; description?: string | null; meta_title?: string | null; meta_description?: string | null; image_url?: string | null; og_image_url?: string | null },
  products: any[],
  canonical: string,
  storeBase: string,
  page = 1, hasNext = false,
): string {
  const storeName = esc(store.name);
  const title = category.meta_title || `${category.name} — ${store.name}`;
  const desc =
    category.meta_description || category.description?.slice(0, 160) ||
    `Shop ${category.name} at ${store.name}.`;
  const ogImage = category.og_image_url || category.image_url || store.logo_url || "";

  // Summary-page ItemList (url + name only), as Google recommends for category
  // pages. Full Product/Offer markup lives only on each product page.
  const itemList = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${category.name} — ${store.name}`,
    numberOfItems: products.length,
    itemListElement: products.slice(0, DISCOVERY_PAGE_SIZE).map((p, i) => ({
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

  const cards = products.slice(0, DISCOVERY_PAGE_SIZE).map((p) => renderProductCard(store, p, storeBase)).join("\n");

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
${isUtkalContentStore(store) && page === 1 ? `${utkalCollectionIntroduction(store, category.slug) ? `<p>${esc(utkalCollectionIntroduction(store, category.slug))}</p>` : ""}<p>${esc(UTKAL_STATUS)}</p>` : ""}
<section class="grid">${cards || `<p>No products in this category yet.</p>`}</section>
${renderPagination(`${storeBase}/category/${category.slug}`, page, hasNext)}
</main>
${buildShellFooter(store, canonical)}
</body></html>`;
}

function buildListingHtml(
  store: any,
  products: any[],
  opts: { kind: "shop" | "best-sellers"; title: string; desc: string; page: number; hasNext: boolean },
  canonical: string,
  storeBase: string,
): string {
  const ogImage = store.logo_url || "";
  const breadcrumb = buildBreadcrumb([
    { name: store.name, url: storeBase },
    { name: opts.kind === "shop" ? "Shop" : "Best Sellers", url: canonical },
  ]);
  const cards = products.slice(0, DISCOVERY_PAGE_SIZE).map((p) => renderProductCard(store, p, storeBase)).join("\n");
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
${renderPagination(`${storeBase}/${opts.kind}`, opts.page, opts.hasNext)}
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

function buildStoresDirectoryHtml(
  store: any,
  locations: any[],
  canonical: string,
  storeBase: string,
): string {
  const title = directoryTitle(store);
  const desc = directoryDescription(store, locations);
  const breadcrumb = buildBreadcrumb([
    { name: store.name, url: storeBase },
    { name: "Stores", url: canonical },
  ]);
  const itemList = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${store.name} store & delivery locations`,
    numberOfItems: locations.length,
    itemListElement: locations.map((l, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${storeBase}/stores/${l.slug}`,
      name: l.city,
    })),
  });
  const links = locations
    .map((l) => `<a class="cat-card" href="${esc(storeBase)}/stores/${esc(l.slug)}">${esc(l.city)} — ${esc(locationTypeLabel(l.location_type))}</a>`)
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
<nav class="breadcrumb"><a href="${esc(storeBase)}">${esc(store.name)}</a> &rsaquo; Stores</nav>
<section class="hero"><h1>${esc(directoryH1(store))}</h1><p>${esc(desc)}</p></section>
<nav class="cat-grid">${links}</nav>
</main>
${buildShellFooter(store, canonical)}
</body></html>`;
}

function buildCityHtml(
  store: any,
  loc: any,
  mainStore: any | null,
  products: any[],
  canonical: string,
  storeBase: string,
): string {
  const title = cityPageTitle(store, loc.city);
  const desc = cityPageDescription(store, loc);
  const h1 = cityPageH1(store, loc.city);
  const intro = cityIntroParagraph(store, loc);
  const hours = formatOpeningHours(loc.opening_hours);
  const isPhysical = loc.location_type !== "delivery_only" && !!loc.address_line;
  const faq = cityFaqItems(store, loc, mainStore);

  const breadcrumb = buildBreadcrumb([
    { name: store.name, url: storeBase },
    { name: "Stores", url: `${storeBase}/stores` },
    { name: loc.city, url: canonical },
  ]);
  const graphs: string[] = [breadcrumb];
  // Store markup only when a verified address exists — delivery-only cities
  // must never be marked up as physical branches.
  if (loc.address_line) {
    graphs.push(JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Store",
      "@id": `${canonical}#store`,
      name: loc.store_name || `${store.name} — ${loc.city}`,
      url: canonical,
      address: {
        "@type": "PostalAddress",
        streetAddress: loc.address_line,
        addressLocality: loc.city,
        addressCountry: "IN",
        ...(loc.pincode ? { postalCode: loc.pincode } : {}),
      },
      ...(loc.phone || loc.whatsapp ? { telephone: loc.phone || loc.whatsapp } : {}),
      ...(hours ? { openingHours: hours.replace(/^Open daily, /, "Mo-Su ") } : {}),
      ...(loc.latitude != null && loc.longitude != null
        ? { geo: { "@type": "GeoCoordinates", latitude: loc.latitude, longitude: loc.longitude } }
        : {}),
    }));
  }

  const storeInfo = isPhysical
    ? `<h2>${esc(locationTypeLabel(loc.location_type))} in ${esc(loc.city)}</h2>
<p>${esc(loc.address_line)}${loc.pincode ? ` — ${esc(loc.pincode)}` : ""}</p>
${hours ? `<p>${esc(hours)}</p>` : ""}
<p><a href="${esc(loc.map_url || mapsSearchUrl(loc.address_line))}">Get directions</a></p>`
    : `<h2>Delivery to ${esc(loc.city)}</h2>
<p>${esc(store.name)} does not have a physical branch in ${esc(loc.city)} yet. Order online and${mainStore ? ` your order is dispatched from the main store in ${esc(mainStore.city)}.` : " your order is dispatched from the main store."}</p>
${loc.delivery_notes ? `<p>${esc(loc.delivery_notes)}</p>` : ""}`;

  const cards = products.map((p) => renderProductCard(store, p, storeBase)).join("\n");
  const faqHtml = faq.length
    ? `<section><h2>Common questions</h2>${faq.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join("\n")}</section>`
    : "";

  return `<!DOCTYPE html><html lang="en">${buildShellHead({
    title,
    desc,
    canonical,
    storeName: store.name,
    ogImage: store.og_image_url || store.banner_url || store.logo_url || "",
    jsonLd: graphs,
  })}<body>
${buildShellHeader(store)}
<main class="container">
<nav class="breadcrumb"><a href="${esc(storeBase)}">${esc(store.name)}</a> &rsaquo; <a href="${esc(storeBase)}/stores">Stores</a> &rsaquo; ${esc(loc.city)}</nav>
<section class="hero"><h1>${esc(h1)}</h1><p>${esc(intro)}</p></section>
<section>${storeInfo}</section>
<section><h2>Shop watches delivered to ${esc(loc.city)}</h2>
<div class="grid">${cards || `<p>Products are being added — check the full catalogue soon.</p>`}</div>
<p><a href="${esc(storeBase)}/shop">View the full catalogue</a></p></section>
${faqHtml}
<nav class="breadcrumb"><a href="${esc(storeBase)}/stores">All stores &amp; cities</a> &middot; <a href="${esc(storeBase)}/categories">Categories</a> &middot; <a href="${esc(storeBase)}/contact">Contact</a></nav>
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
    if (isUtkalContentStore(store)) lines.push(`<h2>Before choosing a watch</h2><p>${esc(UTKAL_STATUS)}</p><p>${esc(UTKAL_QUALITY_TERMS)}</p>`);
    if (store.city || store.state) {
      lines.push(`<p><strong>Based in:</strong> ${esc([store.city, store.state].filter(Boolean).join(", "))}, India.</p>`);
    }
    if (usp.length) {
      lines.push(`<h2>Why choose ${esc(store.name)}</h2>`);
      lines.push(`<ul>${usp.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`);
    }
    const contactBits: string[] = [];
    if (store.whatsapp_number) contactBits.push(`WhatsApp <a href="https://wa.me/${esc(waPhone(store.whatsapp_number))}">${esc(store.whatsapp_number)}</a>`);
    if (store.instagram_url) contactBits.push(`<a href="${esc(store.instagram_url)}">Instagram</a>`);
    if (store.facebook_url) contactBits.push(`<a href="${esc(store.facebook_url)}">Facebook</a>`);
    if (contactBits.length) {
      lines.push(`<h2>Get in touch</h2><p>${contactBits.join(" · ")}</p>`);
    }
  } else if (kind === "contact") {
    lines.push(`<p>${esc(meta.intro)}</p>`);
    if (store.whatsapp_number) lines.push(`<p><strong>WhatsApp:</strong> <a href="https://wa.me/${esc(waPhone(store.whatsapp_number))}">${esc(store.whatsapp_number)}</a></p>`);
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
  "Vary": "Accept",
};

async function renderRequest(req: Request): Promise<Response> {
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
  const page = discoveryPage(url.searchParams.get("page"));
  if (page === null) return new Response("Invalid page", { status: 400, headers: corsHeaders });
  const noIndexHeaders = { ...corsHeaders, "X-Robots-Tag": "noindex", "Cache-Control": "no-store" };
  if (["unknown", "cart", "checkout", "account", "search", "track-order", "wishlist", "auth"].includes(kindParam)) {
    return new Response("This page is not available for indexing", { status: kindParam === "unknown" ? 404 : 200, headers: noIndexHeaders });
  }

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

  if (storeErr || !store || store.is_suspended) {
    return new Response("Store not found", {
      status: 404,
      headers: corsHeaders,
    });
  }

  // Build canonical URL
  // Sanitize domain to prevent injection
  const safeDomain = store.custom_domain ? store.custom_domain.replace(/[^a-zA-Z0-9.\-]/g, "") : null;
  const canonical = safeDomain
    ? `https://${safeDomain}`
    : `https://${slug}.${ROOT_DOMAIN}`;

  // ── Social bot JSON response (for WhatsApp, Facebook, Telegram, etc.) ──
  if (isSocial) {
    if (productSlug) {
      let product: any = null;
      const { data: bySlug } = await supabase
        .from("products")
        .select("id, name, slug, description, price, sale_price, currency, image_url, meta_title, meta_description, stock_quantity")
        .eq("store_id", store.id)
        .eq("slug", productSlug)
        .eq("is_active", true)
        .eq("hidden_by_category", false)
        .maybeSingle();
      product = bySlug;
      if (!product) {
        const { data: byId } = await supabase
          .from("products")
          .select("id, name, slug, description, price, sale_price, currency, image_url, meta_title, meta_description, stock_quantity")
          .eq("store_id", store.id)
          .eq("id", productSlug)
          .eq("is_active", true)
          .eq("hidden_by_category", false)
          .maybeSingle();
        product = byId;
      }
      if (product) {
        const price = productSearchPrice(product);
        const currency = product.currency || store.currency || "INR";
        const currencySymbol = currency === "INR" ? "₹" : currency === "USD" ? "$" : currency + " ";
        return new Response(JSON.stringify({
          title: product.meta_title || `${product.name} — ${currencySymbol}${price}`,
          description: productSearchDescription(product, store.name),
          name: product.name,
          productDescription: product.description?.trim() || undefined,
          price, currency,
          availability: discoveryAvailability(product.stock_quantity),
          canonical: `${canonical}/product/${encodeURIComponent(product.slug || product.id)}`,
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
      .select("id, name, slug, meta_description, meta_title, image_url, og_image_url")
      .eq("store_id", store.id)
      .eq("slug", routeSlug)
      .eq("is_hidden", false)
      .maybeSingle();
    if (!cat) return new Response("Category not found", { status: 404, headers: noIndexHeaders });

    const { data: rows, error: catError } = await supabase.rpc("get_category_products_page_by_slug", {
      _store_id: store.id, _category_slug: cat.slug,
      _offset: (page - 1) * DISCOVERY_PAGE_SIZE, _limit: DISCOVERY_PAGE_SIZE + 1,
    });
    if (catError) return new Response("Catalogue unavailable", { status: 503, headers: noIndexHeaders });
    const catProducts = Array.isArray(rows) ? rows : [];
    if (page > 1 && catProducts.length === 0) return new Response("Page not found", { status: 404, headers: noIndexHeaders });

    const html = buildCategoryHtml(
      store,
      cat as any,
      catProducts.slice(0, DISCOVERY_PAGE_SIZE),
      discoveryUrl(`${canonical}/category/${cat.slug}`, page),
      canonical, page, catProducts.length > DISCOVERY_PAGE_SIZE,
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
    if (!page) return new Response("Page not found", { status: 404, headers: noIndexHeaders });
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
      .eq("is_active", true)
      .eq("hidden_by_category", false);
    const showAll = ["theme-10", "theme-12"].includes(store.theme);
    const query = effectiveKind === "best-sellers" && !showAll ? baseQuery.eq("is_best_selling", true) : baseQuery;
    if (effectiveKind === "shop") query.order("display_order");
    const { data: listingProducts, error: listingError } = await query.order("created_at", { ascending: false }).order("id")
      .range((page - 1) * DISCOVERY_PAGE_SIZE, page * DISCOVERY_PAGE_SIZE);
    if (listingError) return new Response("Catalogue unavailable", { status: 503, headers: noIndexHeaders });
    if (page > 1 && !listingProducts?.length) return new Response("Page not found", { status: 404, headers: noIndexHeaders });

    const opts = effectiveKind === "best-sellers" && !showAll
      ? { kind: "best-sellers" as const, title: `Best sellers at ${store.name}`, desc: `Top-selling products at ${store.name}.` }
      : { kind: "shop" as const, title: isUtkalContentStore(store) ? UTKAL_SHOP_TITLE : `Shop all products — ${store.name}`, desc: isUtkalContentStore(store) ? UTKAL_SHOP_INTRO : `Browse the full product catalog at ${store.name}.` };
    const html = buildListingHtml(
      store,
      (listingProducts || []).slice(0, DISCOVERY_PAGE_SIZE),
      { ...opts, page, hasNext: (listingProducts || []).length > DISCOVERY_PAGE_SIZE },
      discoveryUrl(`${canonical}/${effectiveKind}`, page),
      canonical,
    );
    return new Response(html, { headers: { ...corsHeaders, ...HTML_CACHE_HEADERS } });
  }

  // Categories index page
  if (effectiveKind === "categories") {
    const { data: cats } = await supabase
      .from("categories")
      .select("name, slug")
      .eq("is_hidden", false)
      .eq("store_id", store.id)
      .order("name");
    const html = buildCategoriesIndexHtml(store, cats || [], `${canonical}/categories`, canonical);
    return new Response(html, { headers: { ...corsHeaders, ...HTML_CACHE_HEADERS } });
  }

  // Store directory — /stores
  if (effectiveKind === "stores") {
    const { data: locations, error: locError } = await supabase
      .from("store_locations")
      .select("*")
      .eq("store_id", store.id)
      .eq("is_published", true)
      .order("city");
    if (locError) return new Response("Locations unavailable", { status: 503, headers: noIndexHeaders });
    if (!locations?.length) return new Response("Page not found", { status: 404, headers: noIndexHeaders });
    const html = buildStoresDirectoryHtml(store, locations, `${canonical}/stores`, canonical);
    return new Response(html, { headers: { ...corsHeaders, ...HTML_CACHE_HEADERS } });
  }

  // City page — /stores/:citySlug
  if (effectiveKind === "city" && routeSlug) {
    const { data: location, error: locError } = await supabase
      .from("store_locations")
      .select("*")
      .eq("store_id", store.id)
      .eq("slug", routeSlug)
      .eq("is_published", true)
      .maybeSingle();
    if (locError) return new Response("Locations unavailable", { status: 503, headers: noIndexHeaders });
    if (!location) return new Response("Page not found", { status: 404, headers: noIndexHeaders });
    const { data: mainStore } = await supabase
      .from("store_locations")
      .select("*")
      .eq("store_id", store.id)
      .eq("location_type", "main_store")
      .eq("is_published", true)
      .maybeSingle();
    const { data: cityProducts, error: prodError } = await supabase
      .from("products")
      .select("id, name, slug, price, sale_price, currency, image_url, stock_quantity, category")
      .eq("store_id", store.id)
      .eq("is_active", true)
      .eq("hidden_by_category", false)
      .order("display_order")
      .order("created_at", { ascending: false })
      .order("id")
      .range(0, 11);
    if (prodError) return new Response("Catalogue unavailable", { status: 503, headers: noIndexHeaders });
    const html = buildCityHtml(
      store,
      location,
      mainStore || null,
      cityProducts || [],
      `${canonical}/stores/${location.slug}`,
      canonical,
    );
    return new Response(html, { headers: { ...corsHeaders, ...HTML_CACHE_HEADERS } });
  }

  // Static info routes
  if (effectiveKind === "about" || effectiveKind === "contact" || effectiveKind === "track-order" || effectiveKind === "faq") {
    const html = buildStaticInfoHtml(store, effectiveKind as any, `${canonical}/${effectiveKind}`, canonical);
    return new Response(html, { headers: { ...corsHeaders, ...HTML_CACHE_HEADERS } });
  }

  const legalTypes: Record<string, string> = { "privacy-policy": "privacy", "return-policy": "return", "shipping-policy": "shipping", terms: "terms" };
  if (legalTypes[effectiveKind]) {
    const { data: legal, error } = await supabase.from("store_pages")
      .select("title,content,custom_html,image_url,slug,is_active")
      .eq("store_id", store.id).eq("page_type", legalTypes[effectiveKind]).eq("is_active", true).limit(1).maybeSingle();
    if (error) return new Response("Page unavailable", { status: 503, headers: noIndexHeaders });
    if (!legal) return new Response("Page not found", { status: 404, headers: noIndexHeaders });
    return new Response(buildCustomPageHtml(store, legal, `${canonical}/${effectiveKind}`, canonical), { headers: { ...corsHeaders, ...HTML_CACHE_HEADERS } });
  }

  // Product page
  if (effectiveKind === "product" && productSlug) {
    let product: any = null;
    const { data: bySlug } = await supabase
      .from("products")
      .select("id, name, slug, description, price, sale_price, currency, image_url, stock_quantity, category, is_active, sku, meta_title, meta_description")
      .eq("store_id", store.id)
      .eq("slug", productSlug)
      .eq("is_active", true)
      .eq("hidden_by_category", false)
      .maybeSingle();
    product = bySlug;
    if (!product) {
      const { data: byId } = await supabase
        .from("products")
        .select("id, name, slug, description, price, sale_price, currency, image_url, stock_quantity, category, is_active, sku, meta_title, meta_description")
        .eq("store_id", store.id)
        .eq("id", productSlug)
        .eq("is_active", true)
        .eq("hidden_by_category", false)
        .maybeSingle();
      product = byId;
    }
    if (!product) {
      return new Response("Product not found", { status: 404, headers: noIndexHeaders });
    }
    const { data: images } = await supabase
      .from("product_images")
      .select("image_url, display_order")
      .eq("product_id", product.id)
      .order("display_order", { ascending: true })
      .limit(10);

    if (product.category) {
      const { data: category } = await supabase.from("categories").select("name,slug")
        .eq("store_id", store.id).eq("name", product.category).eq("is_hidden", false).maybeSingle();
      product.seo_category = category;
    }
    const productCanonical = `${canonical}/product/${product.slug || product.id}`;
    const html = buildProductHtml(store, product, images || [], productCanonical);
    return new Response(html, { headers: { ...corsHeaders, ...HTML_CACHE_HEADERS } });
  }

  const { data: categories } = await supabase
    .from("categories")
    .select("name, slug")
    .eq("is_hidden", false)
    .eq("store_id", store.id)
    .order("name");

  const html = buildStoreHtml(store, categories || [], canonical);
  return new Response(html, { headers: { ...corsHeaders, ...HTML_CACHE_HEADERS } });
}

// Convert only the successful public renderer, never shopper/account HTML.
Deno.serve(async (req) => {
  const response = await renderRequest(req);
  const headers = new Headers(response.headers);
  headers.set("Vary", "Accept");
  const markdown = new URL(req.url).searchParams.get("format") === "markdown" || prefersMarkdown(req.headers.get("Accept"));
  if (!markdown || !response.ok || !/text\/html/i.test(headers.get("Content-Type") || "") || /noindex/i.test(headers.get("X-Robots-Tag") || "")) {
    return new Response(response.body, { status: response.status, headers });
  }
  const html = await response.text();
  const converter = new TurndownService({ headingStyle: "atx", bulletListMarker: "-", codeBlockStyle: "fenced" });
  converter.remove(["script", "style", "noscript", "header", "footer"]);
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] || "";
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || html;
  const body = `${canonical ? `Source: ${canonical}\n\n` : ""}${converter.turndown(main)}\n`;
  headers.set("Content-Type", "text/markdown; charset=utf-8");
  headers.set("Content-Signal", "search=yes, ai-input=yes, ai-train=yes");
  // Do not claim an exact model-specific token count; none is computed here.
  return new Response(body, { status: response.status, headers });
});
