/**
 * STORIVO PRODUCTION ROUTER — FIXED
 *
 * 3 bugs fixed from previous version:
 * 1. Asset bypass did fetch(request) → looped back to custom domain → 403
 *    Now: all assets proxy through to origin with correct Host header
 * 2. Custom domains had no slug injection → SPA showed auth/login page
 *    Now: injects window.__STORE_SLUG__ into HTML for custom domains
 * 3. Subdomain path rewrite was redundant (SPA detects subdomain itself)
 *    Now: just proxies to origin, SPA handles slug detection
 *
 * Routes:
 *   - *.storivo.in/*
 *   - storivo.in/*
 *   - custom domains (melleto.shop, etc.)
 */

const ROOT_DOMAIN = "storivo.in";
const ORIGIN_HOST = "true-path-panel.lovable.app";

const SUPABASE_URL = "https://kzvfjknnslgcwumzlwkb.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6dmZqa25uc2xnY3d1bXpsd2tiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NDU1NzEsImV4cCI6MjA4OTQyMTU3MX0.c6TPp3cHVEF2JHYtFcfrCZTlp712eG6t6DwqMaHCAMg";

/* ============== BOT DETECTION ============== */

const SEARCH_BOT_REGEX =
  /Googlebot|Bingbot|DuckDuckBot|YandexBot|Baiduspider|Applebot|Sogou|Exabot|ia_archiver|AhrefsBot|MJ12bot|SemrushBot|PetalBot/i;

const SOCIAL_BOT_REGEX =
  /facebookexternalhit|Facebot|WhatsApp|Twitterbot|TelegramBot|LinkedInBot|Slackbot|Discordbot|Pinterest|Instagram|Snapchat/i;

const BOT_UA_REGEX =
  /bot|crawler|spider|facebookexternalhit|Facebot|WhatsApp|Twitterbot|TelegramBot|LinkedInBot|Slackbot|Discordbot|Pinterest|Googlebot|Bingbot|YandexBot|Instagram|Snapchat|Applebot|DuckDuckBot|Baiduspider|Sogou|Exabot|ia_archiver|AhrefsBot|MJ12bot|SemrushBot|PetalBot|curl|wget|HeadlessChrome/i;

const ORIGIN_TIMEOUT_MS = 15_000;
const EDGE_FN_TIMEOUT_MS = 10_000;

const cache = caches.default;

/* ============== RATE LIMITING ============== */

const rateLimitMap = new Map(); // key → { count, resetAt }
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 60; // max domain lookups per IP per minute

function isRateLimited(ip) {
  if (!ip) return false;
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) return true;
  return false;
}

// Periodically clean stale entries (runs on every request, lightweight)
function cleanRateLimitMap() {
  if (rateLimitMap.size < 1000) return;
  const now = Date.now();
  for (const [key, val] of rateLimitMap) {
    if (now > val.resetAt) rateLimitMap.delete(key);
  }
}

/* ============== SECURITY HEADERS ============== */

const SECURITY_HEADERS = {
  "X-Frame-Options": "SAMEORIGIN",
  "X-Content-Type-Options": "nosniff",
  "X-XSS-Protection": "1; mode=block",
  "Strict-Transport-Security":
    "max-age=31536000; includeSubDomains; preload",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

/* ============== HELPERS ============== */

function escapeHtml(str = "") {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/'/g, "&#x27;");
}

function getProductSlug(pathname) {
  const match = pathname.match(/^\/product\/([^/?#]+)/i);
  return match ? decodeURIComponent(match[1]) : null;
}

function buildSubdomainUrl(slug, path, search = "") {
  return `https://${slug}.${ROOT_DOMAIN}${path}${search}`;
}

function getCacheKey(request, slug = "") {
  const url = new URL(request.url);
  ["fbclid", "gclid", "utm_source", "utm_medium", "utm_campaign"].forEach(
    (p) => url.searchParams.delete(p)
  );
  const host = request.headers.get("host") || url.hostname;
  return new Request(`https://cache/${host}/${slug}${url.pathname}${url.search}`);
}

/* ============== SUPABASE EDGE FUNCTION CALLS ============== */

async function callEdgeFunction(name, params = {}) {
  const url = new URL(`${SUPABASE_URL}/functions/v1/${name}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") {
      url.searchParams.set(k, String(v));
    }
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EDGE_FN_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res;
  } catch (err) {
    clearTimeout(timeout);
    return new Response("Edge function timeout", { status: 504 });
  }
}

/* ============== DOMAIN RESOLUTION ============== */

async function resolveDomain(hostname) {
  const domain = hostname.replace(/^www\./, "").toLowerCase().trim();
  const key = new Request(`https://cache/domain-${domain}`);

  const cached = await cache.match(key);
  if (cached) {
    const data = await cached.json();
    return data.slug || null;
  }

  try {
    // ✅ FIX: Query exact domain instead of fetching ALL stores
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/stores?select=slug&custom_domain=eq.${encodeURIComponent(domain)}&limit=1`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );

    if (!res.ok) return null;
    const data = await res.json();
    const slug = data[0]?.slug || null;

    // Cache hits for 5 min, misses for 60s (faster activation)
    const ttl = slug ? 300 : 60;

    await cache.put(
      key,
      new Response(JSON.stringify({ slug }), {
        headers: { "Cache-Control": `public, max-age=${ttl}` },
      })
    );

    return slug;
  } catch (err) {
    return null;
  }
}

/* ============== CUSTOM DOMAIN LOOKUP BY SLUG ============== */

async function getCustomDomainForSlug(slug) {
  const key = new Request(`https://cache/slug-domain-${slug}`);

  const cached = await cache.match(key);
  if (cached) {
    const data = await cached.json();
    return data.custom_domain || null;
  }

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/stores?select=custom_domain&slug=eq.${encodeURIComponent(slug)}&limit=1`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );

    if (!res.ok) return null;
    const data = await res.json();
    const customDomain = data[0]?.custom_domain || null;

    await cache.put(
      key,
      new Response(JSON.stringify({ custom_domain: customDomain }), {
        headers: { "Cache-Control": "public, max-age=300" },
      })
    );

    return customDomain;
  } catch {
    return null;
  }
}

/* ============== PROXY TO ORIGIN ============== */
/**
 * FIX #1: ALL requests proxy to origin via this function.
 * Previously, static assets used fetch(request) which sent the request
 * back to the custom domain (melleto.shop) instead of the origin,
 * causing 403 errors and infinite loading.
 */
async function proxyToOrigin(request) {
  const url = new URL(request.url);
  url.hostname = ORIGIN_HOST;

  const headers = new Headers(request.headers);
  headers.set("Host", ORIGIN_HOST);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ORIGIN_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      method: request.method,
      headers,
      signal: controller.signal,
      cf: { cacheTtl: 0, cacheEverything: false },
    });
    clearTimeout(timeout);

    const newRes = new Response(res.body, res);
    const contentType = newRes.headers.get("content-type") || "";

    // Cache static assets aggressively
    if (
      contentType.includes("image") ||
      contentType.includes("javascript") ||
      contentType.includes("css") ||
      contentType.includes("font")
    ) {
      if (newRes.ok) {
        newRes.headers.set(
          "Cache-Control",
          "public, max-age=2592000, immutable"
        );
      }
    } else if (contentType.includes("text/html")) {
      newRes.headers.set(
        "Cache-Control",
        "public, max-age=300, stale-while-revalidate=86400"
      );
    }

    for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
      newRes.headers.set(k, v);
    }

    return newRes;
  } catch {
    clearTimeout(timeout);
    return new Response(
      `<!DOCTYPE html>
<html><head>
<title>Loading...</title>
<meta http-equiv="refresh" content="3">
</head>
<body style="font-family:sans-serif;text-align:center;padding:50px">
<h2>Loading your store...</h2>
<p>Please wait, retrying...</p>
</body></html>`,
      {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
      }
    );
  }
}

/* ============== PREFETCH STOREFRONT DATA ============== */

async function prefetchStorefrontData(slug) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/get_storefront_data`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ _slug: slug, _product_limit: 50 }),
      }
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/* ============== SERVER-RENDER CRITICAL HTML ============== */

/**
 * Generates real storefront HTML at the edge using prefetched data.
 * This replaces the generic skeleton with actual store content (marquee,
 * nav bar, product cards) so users see real content before JS loads.
 */
function buildServerRenderedShell(storefrontData) {
  const store = storefrontData?.store;
  if (!store) return "";

  const products = (storefrontData.products || []).filter(p => p.is_active).slice(0, 4);
  const categories = (storefrontData.categories || []).slice(0, 6);
  const themeConfig = storefrontData.theme_config;
  const storeName = escapeHtml(store.name || "");
  const currency = store.currency || "INR";
  const currencySymbol = currency === "INR" ? "₹" : currency === "USD" ? "$" : currency;

  // Marquee
  const marqueeEnabled = themeConfig?.marquee_enabled !== false;
  const marqueeGradient = themeConfig?.marquee_gradient || "linear-gradient(90deg, #b8873c, #f1d78a, #d1a24a)";
  const marqueeText = themeConfig?.marquee_text || "🚚 Free Delivery • 🔄 Easy Returns • 🔒 Secure Payments • 💰 Cash On Delivery • 👜 Premium Quality";
  const marqueeSegments = marqueeText.split(" • ").filter(Boolean);
  const marqueeItemsHtml = marqueeSegments.map(s => `<span style="white-space:nowrap">${escapeHtml(s.trim())}</span>`).join('<span style="opacity:.7">•</span>');

  const marqueeHtml = marqueeEnabled ? `<div style="width:100%;overflow:hidden;padding:10px 0;font-size:13px;font-weight:500;background:${escapeHtml(marqueeGradient)};color:#000;font-variant:small-caps"><div class="flex w-max animate-marquee" style="display:flex;gap:35px;padding-right:35px">${marqueeItemsHtml}${marqueeItemsHtml}</div></div>` : "";

  // Nav bar with real logo/store name
  const logoHtml = store.logo_url
    ? `<img src="${escapeHtml(store.logo_url)}" alt="${storeName}" width="160" height="48" style="height:40px;width:auto;max-width:160px;object-fit:contain" />`
    : `<div style="display:flex;align-items:center;gap:8px"><div style="width:36px;height:36px;border-radius:8px;background:#4361ee;display:flex;align-items:center;justify-content:center"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg></div><span style="font-size:18px;font-weight:700">${storeName}</span></div>`;

  const navHtml = `<div style="position:sticky;top:0;z-index:30;display:flex;align-items:center;height:56px;padding:0 12px;background:rgba(255,255,255,.85);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-bottom:1px solid #e5e5e5"><div style="width:40px;height:40px;border-radius:10px;background:#e8e8e8"></div><div style="margin-left:6px">${logoHtml}</div><div style="flex:1"></div><div style="width:36px;height:36px;border-radius:50%;background:#e8e8e8;margin-left:4px"></div><div style="width:36px;height:36px;border-radius:50%;background:#e8e8e8;margin-left:4px"></div><div style="width:36px;height:36px;border-radius:50%;background:#e8e8e8;margin-left:4px"></div></div>`;

  // Categories
  let catsHtml = "";
  if (categories.length > 0) {
    const catItems = categories.map(cat => {
      const catImg = cat.image_url
        ? `<img src="${escapeHtml(cat.image_url)}" alt="${escapeHtml(cat.name)}" width="64" height="64" style="width:64px;height:64px;border-radius:50%;object-fit:cover" loading="lazy" />`
        : `<div style="width:64px;height:64px;border-radius:50%;background:#e8e8e8" class="sf-shimmer"></div>`;
      return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex-shrink:0"><div style="border-radius:50%;overflow:hidden">${catImg}</div><span style="font-size:11px;text-align:center;max-width:72px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(cat.name)}</span></div>`;
    }).join("");
    catsHtml = `<div style="display:flex;gap:12px;padding:12px 16px;max-width:72rem;margin:0 auto;overflow-x:auto">${catItems}</div>`;
  }

  // Product cards
  let gridHtml = "";
  if (products.length > 0) {
    const primaryColor = themeConfig?.primary_color || "#b8873c";
    const isLight = (hex) => {
      const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
      return (r * 299 + g * 587 + b * 114) / 1000 > 160;
    };
    const btnText = isLight(primaryColor) ? "#1a1a1a" : "#ffffff";

    const cards = products.map((p, idx) => {
      const name = escapeHtml(p.name || "");
      const imgUrl = escapeHtml(p.image_url || "");
      const price = p.sale_price || p.price || 0;
      const originalPrice = p.sale_price ? p.price : null;
      const discount = originalPrice ? Math.round((1 - price / originalPrice) * 100) : 0;
      const loadAttr = idx < 2 ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"';

      const priceHtml = originalPrice
        ? `<div style="display:flex;align-items:center;gap:6px"><span style="font-size:15px;font-weight:700">${currencySymbol}${price}</span><span style="font-size:12px;text-decoration:line-through;opacity:.5">${currencySymbol}${originalPrice}</span>${discount > 0 ? `<span style="font-size:11px;font-weight:600;color:#16a34a">${discount}% off</span>` : ""}</div>`
        : `<span style="font-size:15px;font-weight:700">${currencySymbol}${price}</span>`;

      return `<div style="border-radius:16px;overflow:hidden;background:#fff;border:1px solid #e8e8e8"><img src="${imgUrl}" alt="${name}" width="400" height="500" style="width:100%;aspect-ratio:4/5;object-fit:cover;display:block" ${loadAttr} /><div style="padding:8px 10px 10px"><div style="font-size:12px;opacity:.5;margin-bottom:2px">${escapeHtml(p.category || "")}</div><div style="font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:4px">${name}</div>${priceHtml}<div style="height:36px;border-radius:8px;margin-top:6px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;background:${primaryColor};color:${btnText};cursor:pointer">Add to Cart</div></div></div>`;
    }).join("");

    gridHtml = `<div style="padding:16px 16px 0;max-width:72rem;margin:0 auto"><div style="font-size:18px;font-weight:700;margin-bottom:12px">All Products</div></div><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;padding:0 16px 16px;max-width:72rem;margin:0 auto">${cards}</div>`;
  }

  return `<div id="sf-skeleton" data-server-rendered="true">${marqueeHtml}${navHtml}${catsHtml}${gridHtml}</div>`;
}

/* ============== INJECT STORE SLUG INTO HTML ============== */
/**
 * FIX #2: For custom domains, the SPA running in the browser has no way
 * to detect which store to load.
 *
 * PERF: Also injects window.__STOREFRONT_DATA__ with pre-fetched storefront
 * data so the SPA renders instantly without an API waterfall.
 * PERF: Server-renders real store content into the HTML shell at the edge.
 */
async function fetchAndInjectSlug(request, slug) {
  // Fetch origin HTML and storefront data in parallel
  const [response, storefrontData] = await Promise.all([
    proxyToOrigin(request),
    prefetchStorefrontData(slug),
  ]);

  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("text/html") || !response.ok) {
    return response;
  }

  let html = await response.text();

  let injection = `<script>window.__STORE_SLUG__="${escapeHtml(slug)}";`;
  if (storefrontData) {
    const jsonStr = JSON.stringify(storefrontData).replace(/<\/script/gi, "<\\/script");
    injection += `window.__STOREFRONT_DATA__=${jsonStr};`;
  }
  injection += `</script>
<link rel="preconnect" href="${SUPABASE_URL}" />`;

  // LCP optimization: preload the first product image with srcset for responsive sizes
  let lcpPreload = "";
  if (storefrontData) {
    const products = storefrontData.products || [];
    const firstImage = products[0]?.image_url;
    if (firstImage) {
      const safeUrl = escapeHtml(firstImage);
      // Generate srcset with multiple widths for responsive preloading
      const widths = [200, 400, 600, 800];
      const srcsetParts = widths.map(w => `${safeUrl} ${w}w`);
      const srcsetAttr = srcsetParts.join(", ");
      lcpPreload += `<link rel="preload" as="image" href="${safeUrl}" imagesrcset="${srcsetAttr}" imagesizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" fetchpriority="high" />`;
      // Preconnect to the image CDN origin
      try {
        const imgOrigin = new URL(firstImage).origin;
        if (imgOrigin && !imgOrigin.includes("supabase")) {
          lcpPreload += `<link rel="preconnect" href="${imgOrigin}" crossorigin />`;
        }
      } catch {}
    }
  }

  html = html.replace("<head>", `<head>${injection}${lcpPreload}`);

  // Server-render real store content into the HTML shell
  if (storefrontData?.store) {
    const serverHtml = buildServerRenderedShell(storefrontData);
    if (serverHtml) {
      // Replace the generic skeleton with real server-rendered content
      html = html.replace(
        /<div class="sf-shell" id="sf-skeleton">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/,
        serverHtml
      );
    }
  }

  return new Response(html, {
    status: response.status,
    headers: response.headers,
  });
}

/* ============== CACHED FETCH ============== */

async function cachedFetch(request, slug = "", ctx, isCustomDomain = false) {
  const key = getCacheKey(request, slug);
  const url = new URL(request.url);

  // Skip cache for admin, API, and authenticated requests
  if (
    url.pathname.startsWith("/admin") ||
    url.pathname.startsWith("/api") ||
    url.pathname.startsWith("/dashboard") ||
    request.headers.get("cookie")?.includes("auth")
  ) {
    if (isCustomDomain && slug) {
      return fetchAndInjectSlug(request, slug);
    }
    return proxyToOrigin(request);
  }

  // Try cache first
  const cached = await cache.match(key);

  if (cached) {
    // Background revalidation: re-fetch and re-inject for fresh cache
    ctx.waitUntil(
      (async () => {
        try {
          let freshRes;
          if (slug) {
            freshRes = await fetchAndInjectSlug(request, slug);
          } else {
            freshRes = await proxyToOrigin(request);
          }
          const ct = freshRes.headers.get("content-type") || "";
          if (freshRes.ok && ct.includes("text/html")) {
            await cache.put(key, freshRes.clone());
          }
        } catch {}
      })()
    );
    return cached;
  }

  // Cache miss
  let res;
  try {
    if (slug) {
      // Inject storefront data for both subdomains and custom domains
      res = await fetchAndInjectSlug(request, slug);
    } else {
      res = await proxyToOrigin(request);
    }
  } catch {
    const fallback = await cache.match(key);
    if (fallback) return fallback;
    return new Response("Server Error", { status: 500 });
  }

  // Cache the fully injected HTML (with SSR content + __STOREFRONT_DATA__)
  // so subsequent first-visit requests from the same edge POP get pre-rendered HTML
  const contentType = res.headers.get("content-type") || "";
  if (res.ok && contentType.includes("text/html")) {
    ctx.waitUntil(cache.put(key, res.clone()));
  }

  return res;
}

/* ============== OG HTML ============== */

function buildOgHtml(og, finalUrl) {
  const title = escapeHtml(og.title || "");
  const desc = escapeHtml(og.description || "");
  const img = escapeHtml(og.image || "");
  const siteName = escapeHtml(
    og.title?.split("—")[0]?.trim() || og.title || ""
  );
  const safeUrl = escapeHtml(finalUrl);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<meta name="description" content="${desc}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${safeUrl}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${siteName}">
${img ? `<meta property="og:image" content="${img}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">` : ""}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${desc}">
${img ? `<meta name="twitter:image" content="${img}">` : ""}
<link rel="canonical" href="${safeUrl}">
<meta http-equiv="refresh" content="0;url=${safeUrl}">
<script>window.location.replace(${JSON.stringify(finalUrl)});</script>
</head>
<body>
<p>Redirecting to <a href="${safeUrl}">${siteName}</a>...</p>
</body>
</html>`;
}

/* ============== BOT HANDLER ============== */

async function handleBot(request, slug, url, isCustom) {
  const ua = request.headers.get("User-Agent") || "";
  if (!BOT_UA_REGEX.test(ua)) return null;

  const product = getProductSlug(url.pathname);
  const finalUrl = isCustom
    ? `${url.origin}${url.pathname}${url.search}`
    : buildSubdomainUrl(slug, url.pathname, url.search);

  if (SEARCH_BOT_REGEX.test(ua)) {
    try {
      const domainType = isCustom ? "custom" : "sub";
      const botCacheKey = new Request(
        `https://cache/bot-render/${domainType}/${slug}/${product || "home"}`
      );
      const cached = await cache.match(botCacheKey);
      if (cached) return cached;

      const domain = isCustom ? url.hostname : null;
      const res = await callEdgeFunction("bot-render", {
        slug,
        ...(product ? { product } : {}),
        ...(domain ? { domain } : {}),
      });

      if (res && res.ok) {
        const html = await res.text();
        const response = new Response(html, {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
            ...SECURITY_HEADERS,
          },
        });
        await cache.put(botCacheKey, response.clone());
        return response;
      }
    } catch {
      // Fall through
    }
  }

  if (SOCIAL_BOT_REGEX.test(ua) || SEARCH_BOT_REGEX.test(ua)) {
    try {
      const res = await callEdgeFunction("og-meta", {
        slug,
        ...(product ? { product } : {}),
      });
      if (!res.ok) return null;
      const og = await res.json();
      return new Response(buildOgHtml(og, finalUrl), {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=300, s-maxage=3600",
        },
      });
    } catch {
      return null;
    }
  }

  return null;
}

/* ============== SEO FILES ============== */

async function handleSeoFiles(url, slug) {
  if (url.pathname === "/sitemap.xml") {
    const res = await callEdgeFunction("sitemap", { slug });
    return new Response(await res.text(), {
      status: res.ok ? 200 : 500,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=86400",
      },
    });
  }

  if (url.pathname === "/robots.txt") {
    const res = await callEdgeFunction("robots-txt", { slug });
    return new Response(await res.text(), {
      status: res.ok ? 200 : 500,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=86400",
      },
    });
  }

  return null;
}

/* ============== MAIN HANDLER ============== */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const hostname =
      request.headers.get("x-forwarded-host") ||
      request.headers.get("host") ||
      url.hostname;

    // ─── HEALTH CHECK ENDPOINT ───
    if (url.pathname === "/__health") {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const originCheck = await fetch(`https://${ORIGIN_HOST}/`, {
          method: "HEAD",
          headers: { Host: ORIGIN_HOST },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        return new Response(
          JSON.stringify({
            status: originCheck.ok ? "healthy" : "degraded",
            origin: originCheck.status,
            timestamp: new Date().toISOString(),
          }),
          {
            status: originCheck.ok ? 200 : 503,
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          }
        );
      } catch {
        return new Response(
          JSON.stringify({ status: "unhealthy", origin: "timeout", timestamp: new Date().toISOString() }),
          { status: 503, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }
        );
      }
    }

    // ─── RATE LIMIT CLEANUP ───
    cleanRateLimitMap();

    // ─── FIX #1: STATIC ASSETS → PROXY TO ORIGIN ───
    const isStaticAsset =
      url.pathname.startsWith("/assets/") ||
      url.pathname.startsWith("/static/") ||
      url.pathname === "/registerSW.js" ||
      url.pathname === "/sw-push.js" ||
      url.pathname === "/manifest.webmanifest" ||
      url.pathname === "/sw.js" ||
      url.pathname === "/favicon.ico" ||
      (url.pathname.includes(".") &&
        !url.pathname.startsWith("/api") &&
        !url.pathname.startsWith("/rest") &&
        url.pathname !== "/sitemap.xml" &&
        url.pathname !== "/robots.txt");

    if (isStaticAsset) {
      return proxyToOrigin(request);
    }

    // ─── SUPABASE API → pass through (with edge caching for read-only storefront RPCs) ───
    if (url.pathname.startsWith("/api") || url.pathname.startsWith("/rest")) {
      // Cache GET requests to storefront data RPC at the edge for 5 min
      const isStorefrontRpc =
        request.method === "GET" &&
        url.pathname.includes("/rpc/get_storefront_data");

      if (isStorefrontRpc) {
        const apiCacheKey = new Request(`https://cache/api${url.pathname}${url.search}`);
        const cachedApi = await cache.match(apiCacheKey);
        if (cachedApi) return cachedApi;

        const apiRes = await fetch(request);
        if (apiRes.ok) {
          const cloned = new Response(apiRes.body, apiRes);
          cloned.headers.set("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
          ctx.waitUntil(cache.put(apiCacheKey, cloned.clone()));
          return cloned;
        }
        return apiRes;
      }

      return fetch(request);
    }

    // ─── ROOT DOMAIN ───
    if (hostname === ROOT_DOMAIN || hostname === `www.${ROOT_DOMAIN}`) {
      const storeMatch = url.pathname.match(
        /^\/store\/([a-zA-Z0-9_-]+)(\/.*)?$/
      );

      if (storeMatch) {
        const redirectSlug = storeMatch[1];
        const remainingPath = storeMatch[2] || "";
        return Response.redirect(
          `https://${redirectSlug}.${ROOT_DOMAIN}${remainingPath}${url.search}`,
          301
        );
      }

      if (hostname === `www.${ROOT_DOMAIN}`) {
        return Response.redirect(
          `https://${ROOT_DOMAIN}${url.pathname}${url.search}`,
          301
        );
      }

      return cachedFetch(request, "", ctx);
    }

    // ─── SUBDOMAIN ───
    if (hostname.endsWith(`.${ROOT_DOMAIN}`)) {
      const slug = hostname.replace(`.${ROOT_DOMAIN}`, "");

      if (!slug || slug.includes(".") || slug === "www") {
        return cachedFetch(request, "", ctx);
      }

      // 301 redirect to custom domain if one exists
      const customDomain = await getCustomDomainForSlug(slug);
      if (customDomain) {
        return Response.redirect(
          `https://${customDomain}${url.pathname}${url.search}`,
          301
        );
      }

      const seoResponse = await handleSeoFiles(url, slug);
      if (seoResponse) return seoResponse;

      const botResponse = await handleBot(request, slug, url, false);
      if (botResponse) return botResponse;

      return cachedFetch(request, slug, ctx);
    }

    // ─── CUSTOM DOMAIN ───
    // Rate limit domain resolution lookups
    const clientIP = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for");
    if (isRateLimited(clientIP)) {
      return new Response("Too Many Requests", {
        status: 429,
        headers: { "Retry-After": "60", "Content-Type": "text/plain" },
      });
    }

    const cleanDomain = hostname.replace(/^www\./, "").toLowerCase().trim();
    const slug = await resolveDomain(cleanDomain);

    if (slug) {
      const seoResponse = await handleSeoFiles(url, slug);
      if (seoResponse) return seoResponse;

      const botResponse = await handleBot(request, slug, url, true);
      if (botResponse) return botResponse;

      return cachedFetch(request, slug, ctx, true);
    }

    // ─── UNKNOWN DOMAIN → 404 (strict tenant resolution) ───
    return new Response(
      `<!DOCTYPE html><html><head><title>Store Not Found</title></head>
<body style="font-family:sans-serif;text-align:center;padding:60px">
<h1>Store Not Found</h1>
<p>No store is configured for this domain.</p>
</body></html>`,
      {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=60" },
      }
    );
  },
};
