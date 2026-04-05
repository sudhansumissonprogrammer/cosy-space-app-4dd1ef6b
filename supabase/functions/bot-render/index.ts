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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  const productSlug = url.searchParams.get("product");
  const domain = url.searchParams.get("domain");
  const isSocial = url.searchParams.get("social") === "true";

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
    .select("id, name, slug, description, logo_url, banner_url, currency, meta_title, meta_description, og_image_url, custom_domain, whatsapp_number, instagram_url, facebook_url, order_mode, theme, features, best_selling_carousel, location, city, state, business_hours, return_policy, shipping_policy, is_suspended, is_verified, created_at, updated_at, mobile_hero_url, mobile_hero_images, facebook_pixel_id")
    .eq("slug", slug)
    .single();

  if (storeErr || !store) {
    return new Response("Store not found", {
      status: 404,
      headers: corsHeaders,
    });
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

  // Product page
  if (productSlug) {
    // Try by slug first, then by id
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
      return new Response("Product not found", {
        status: 404,
        headers: corsHeaders,
      });
    }

    // Fetch product images
    const { data: images } = await supabase
      .from("product_images")
      .select("image_url, display_order")
      .eq("product_id", product.id)
      .order("display_order", { ascending: true })
      .limit(6);

    const productCanonical = `${canonical}/product/${product.slug || product.id}`;
    const html = buildProductHtml(store, product, images || [], productCanonical);

    return new Response(html, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
      },
    });
  }

  // Store home page
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

  return new Response(html, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
    },
  });
});
