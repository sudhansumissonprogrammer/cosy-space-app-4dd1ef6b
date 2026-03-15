import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ROOT_DOMAIN = "storivo.in";

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
    const isShopifyCdnAsset = parsed.pathname.includes("/cdn/shop/files/");

    // WhatsApp preview is unreliable with .webp OG images.
    // Shopify supports forcing JPEG output via format=pjpg.
    if (isShopifyCdnAsset && parsed.pathname.toLowerCase().endsWith(".webp")) {
      parsed.searchParams.set("format", "pjpg");
      if (!parsed.searchParams.has("width")) {
        parsed.searchParams.set("width", "1200");
      }
      return parsed.toString();
    }

    return parsed.toString();
  } catch {
    return imageUrl;
  }
}

function buildHtml(title: string, description: string, image: string, canonicalUrl: string, redirectUrl: string, siteName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}">
  
  <!-- Open Graph -->
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${siteName}">
  ${image ? `<meta property="og:image" content="${escapeHtml(image)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">` : ""}
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  ${image ? `<meta name="twitter:image" content="${escapeHtml(image)}">` : ""}
  
  <link rel="canonical" href="${canonicalUrl}">
  
  <!-- Redirect humans to the actual page -->
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  const productSlug = url.searchParams.get("product");

  if (!slug) {
    return new Response("Missing slug", { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Fetch store
  const { data: store, error } = await supabase
    .from("stores")
    .select("id, name, description, meta_title, meta_description, og_image_url, logo_url, banner_url, slug, currency")
    .eq("slug", slug)
    .single();

  if (error || !store) {
    return new Response("Store not found", { status: 404 });
  }

  const storeUrl = `https://${slug}.${ROOT_DOMAIN}`;

  // ── Product share ──
  if (productSlug) {
    let { data: product } = await supabase
      .from("products")
      .select("name, description, image_url, price, sale_price, slug, currency, id")
      .eq("store_id", store.id)
      .eq("slug", productSlug)
      .eq("is_active", true)
      .maybeSingle();

    // Fallback: allow sharing by product ID when slug is unavailable
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
      const productUrl = `${storeUrl}/product/${productPath}`;

      const html = buildHtml(productTitle, productDesc, productImage, productUrl, productUrl, escapeHtml(store.name));
      return new Response(html, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=300, s-maxage=3600",
        },
      });
    }
  }

  // ── Store share (default) ──
  const title = escapeHtml(store.meta_title || store.name);
  const description = escapeHtml(store.meta_description || store.description || `Shop at ${store.name}`);
  const image = store.og_image_url || store.banner_url || store.logo_url || "";

  const html = buildHtml(title, description, image, storeUrl, storeUrl, escapeHtml(store.name));

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=3600",
    },
  });
});
