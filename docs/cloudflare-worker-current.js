/**
 * STORIVO PRODUCTION ROUTER v2.6 — EARLY EDGE CACHE EXIT
 *
 * Changes from v2.5:
 *   - EARLY CACHE EXIT: Cache API check happens BEFORE slug resolution,
 *     bot detection, or any origin fetches. On cache HIT, Worker returns
 *     in ~1-5ms with zero processing overhead.
 *   - X-Cache-Timestamp header tracks when response was cached
 *   - cf-cache-status will always be DYNAMIC (expected for Workers —
 *     our caching is via Cache API, tracked by X-Cache-Status)
 *   - Separated cache key for HTML pages vs data
 *
 * Architecture:
 *   User → Edge Cache (Cache API) → Worker processing → KV → Supabase
 *   On HIT: User → Edge Cache → done (~1-5ms)
 *   On MISS: User → Worker → KV/Origin → cache.put → response
 *
 * Routes:
 *   - *.storivo.in/*
 *   - storivo.in/*
 *   - custom domains (melleto.shop, mgwinner.in, etc.)
 *
 * KV Binding:
 *   - STORE_KV: Cloudflare KV namespace for global storefront data cache
 */

const WORKER_VERSION = "2.6";
const ROOT_DOMAIN = "storivo.in";
const ORIGIN_HOST = "core-gleam-hub.lovable.app";

const SUPABASE_URL = "https://vjjlxmqgqtquggdajjvi.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqamx4bXFncXRxdWdnZGFqanZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MjEyNjgsImV4cCI6MjA4OTk5NzI2OH0.AjNH7zdzlAhmQnjwvhCOvDVac356sA04_ORb2j5rA2k";

/* ============== BOT DETECTION ============== */

const SEARCH_BOT_REGEX =
  /Googlebot|Bingbot|DuckDuckBot|YandexBot|Baiduspider|Applebot|Sogou|Exabot|ia_archiver|AhrefsBot|MJ12bot|SemrushBot|PetalBot/i;

const SOCIAL_BOT_REGEX =
  /facebookexternalhit|Facebot|WhatsApp|Twitterbot|TelegramBot|LinkedInBot|Slackbot|Discordbot|Pinterest|Instagram|Snapchat/i;

const BOT_UA_REGEX =
  /bot|crawler|spider|facebookexternalhit|Facebot|WhatsApp|Twitterbot|TelegramBot|LinkedInBot|Slackbot|Discordbot|Pinterest|Googlebot|Bingbot|YandexBot|Instagram|Snapchat|Applebot|DuckDuckBot|Baiduspider|Sogou|Exabot|ia_archiver|AhrefsBot|MJ12bot|SemrushBot|PetalBot|curl|wget|HeadlessChrome/i;

const ORIGIN_TIMEOUT_MS = 15_000;
const EDGE_FN_TIMEOUT_MS = 10_000;
const STOREFRONT_PREFETCH_TIMEOUT_MS = 2_500;

const cache = caches.default;

/* ============== RATE LIMITING ============== */

const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;

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

/**
 * Build a simple early-exit cache key based on hostname + path only.
 * Used for the top-of-handler cache check before any slug resolution.
 */
function getEarlyCacheKey(hostname, pathname) {
  // Normalize: strip tracking params, lowercase
  const cleanPath = pathname.toLowerCase();
  return new Request(`https://edge-html/${hostname}${cleanPath}`);
}

/**
 * Add diagnostic headers to every response.
 * @param {string} dataSource - "kv" | "cache-api" | "origin" | "none"
 */
function addDiagnosticHeaders(response, { slug, cacheStatus, dataSource }) {
  const res = new Response(response.body, response);
  res.headers.set("X-Worker-Version", WORKER_VERSION);
  if (slug) res.headers.set("X-Store-Slug", slug);
  res.headers.set("X-Cache-Status", cacheStatus);
  if (dataSource) res.headers.set("X-Data-Source", dataSource);
  return res;
}

/**
 * Verify that an HTML response contains the tenant marker.
 * Used to prevent caching bare/un-injected HTML for tenant routes.
 */
function htmlContainsTenantMarker(htmlText) {
  return htmlText.includes("__STORE_SLUG__");
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
        "public, max-age=300, stale-while-revalidate=3600"
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
<title>Store Temporarily Unavailable</title>
</head>
<body style="font-family:sans-serif;text-align:center;padding:50px">
<h2>Store Temporarily Unavailable</h2>
<p>The storefront origin timed out. Please retry in a few seconds.</p>
</body></html>`,
      {
        status: 503,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
      }
    );
  }
}

/* ============== PREFETCH STOREFRONT DATA (KV + Cache API) ============== */

const KV_STOREFRONT_TTL = 600; // 10 minutes in KV (global, all colos)
const CACHE_STOREFRONT_TTL = 300; // 5 minutes in Cache API (per-colo)

/**
 * Returns { data, source } where source is "kv" | "cache-api" | "origin" | "none"
 */
async function prefetchStorefrontData(slug, ctx, env) {
  const kvKey = `storefront:${slug}`;
  const dataCacheKey = new Request(`https://cache/storefront-data/${slug}`);

  // 1. Try KV first (global, ~5ms read latency)
  if (env?.STORE_KV) {
    try {
      const kvData = await env.STORE_KV.get(kvKey, { type: "json" });
      if (kvData) return { data: kvData, source: "kv" };
    } catch {}
  }

  // 2. Try per-colo Cache API (~0ms if warm)
  try {
    const cached = await cache.match(dataCacheKey);
    if (cached) {
      const data = await cached.json();
      // Backfill KV if it was a KV miss but cache hit (background)
      if (env?.STORE_KV && data && ctx) {
        ctx.waitUntil(
          env.STORE_KV.put(kvKey, JSON.stringify(data), { expirationTtl: KV_STOREFRONT_TTL })
        );
      }
      return { data, source: "cache-api" };
    }
  } catch {}

  // 3. Cache miss — fetch from Supabase with timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), STOREFRONT_PREFETCH_TIMEOUT_MS);

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
        signal: controller.signal,
        body: JSON.stringify({ _slug: slug, _product_limit: 50 }),
      }
    );
    clearTimeout(timeout);
    if (!res.ok) return { data: null, source: "none" };
    const data = await res.json();

    // Write to both KV (global) and Cache API (per-colo) in background
    if (data && ctx) {
      ctx.waitUntil(
        Promise.all([
          env?.STORE_KV
            ? env.STORE_KV.put(kvKey, JSON.stringify(data), { expirationTtl: KV_STOREFRONT_TTL })
            : Promise.resolve(),
          cache.put(
            dataCacheKey,
            new Response(JSON.stringify(data), {
              headers: { "Cache-Control": `public, max-age=${CACHE_STOREFRONT_TTL}` },
            })
          ),
        ])
      );
    }

    return { data, source: "origin" };
  } catch {
    clearTimeout(timeout);
    return { data: null, source: "none" };
  }
}

/* ============== INJECT STORE SLUG INTO HTML ============== */

/**
 * Returns { response, dataSource }
 */
async function fetchAndInjectSlug(request, slug, ctx, env) {
  const [response, prefetchResult] = await Promise.all([
    proxyToOrigin(request),
    prefetchStorefrontData(slug, ctx, env),
  ]);

  const storefrontData = prefetchResult.data;
  const dataSource = prefetchResult.source;

  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("text/html") || !response.ok) {
    return { response, dataSource };
  }

  let html = await response.text();

  // ── HYDRATION FIX (v2.5) ──
  // The index.html contains an inline <script> that also fetches get_storefront_data
  // when __STOREFRONT_DATA__ is not set. Since we inject __STOREFRONT_DATA__ via the
  // Worker, we need to ensure it's set BEFORE that inline script executes.
  //
  // Strategy: Inject our data script at the very top of <head>, before everything else.
  // The inline script in index.html checks `if(window.__STOREFRONT_DATA__)return;`
  // so it will short-circuit and NOT make a duplicate fetch.

  let injection = `<script>window.__STORE_SLUG__="${escapeHtml(slug)}";`;
  if (storefrontData) {
    const jsonStr = JSON.stringify(storefrontData).replace(/<\/script/gi, "<\\/script");
    injection += `window.__STOREFRONT_DATA__=${jsonStr};`;
  }
  injection += `</script>
<link rel="preconnect" href="${SUPABASE_URL}" crossorigin />
<link rel="dns-prefetch" href="${SUPABASE_URL}" />
<link rel="preconnect" href="${SUPABASE_URL}/storage/v1" crossorigin />
<link rel="dns-prefetch" href="${SUPABASE_URL}/storage/v1" />`;

  let lcpPreload = "";
  if (storefrontData) {
    const store = storefrontData.store;
    if (store) {
      let heroUrl = store.mobile_hero_url;
      const heroImages = store.mobile_hero_images;
      if (heroImages) {
        try {
          const arr = typeof heroImages === "string" ? JSON.parse(heroImages) : heroImages;
          if (Array.isArray(arr) && arr[0]) heroUrl = arr[0];
        } catch {}
      }
      if (heroUrl) {
        let optUrl = heroUrl;
        if (heroUrl.includes("supabase.co/storage")) {
          optUrl = heroUrl.replace("/storage/v1/object/", "/storage/v1/render/image/");
          optUrl += (optUrl.includes("?") ? "&" : "?") + "width=800&quality=75";
        }
        const safeHeroUrl = escapeHtml(optUrl);
        lcpPreload += `<link rel="preload" as="image" href="${safeHeroUrl}" fetchpriority="high" />`;
        try {
          const heroOrigin = new URL(optUrl).origin;
          lcpPreload += `<link rel="preconnect" href="${heroOrigin}" crossorigin />`;
        } catch {}
      }
      if (store.logo_url) {
        lcpPreload += `<link rel="preload" as="image" href="${escapeHtml(store.logo_url)}" />`;
      }
    }

    const products = storefrontData.products || [];
    const firstImage = products[0]?.image_url;
    if (firstImage) {
      const safeUrl = escapeHtml(firstImage);
      lcpPreload += `<link rel="preload" as="image" href="${safeUrl}" />`;
      try {
        const imgOrigin = new URL(firstImage).origin;
        if (imgOrigin && !imgOrigin.includes("supabase")) {
          lcpPreload += `<link rel="preconnect" href="${imgOrigin}" crossorigin />`;
        }
      } catch {}
    }
  }

  // Extract JS chunks for modulepreload — ONLY storefront-relevant ones
  const DASHBOARD_CHUNK_PATTERN = /(?:charts|dash-vendor|admin-pages|dashboard-pages|dashboard-shell|WhatsApp|auth-pages)-/;
  const chunkMatches = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)];
  let modulePreloads = "";
  const seen = new Set();
  for (const m of chunkMatches) {
    if (!seen.has(m[1]) && !DASHBOARD_CHUNK_PATTERN.test(m[1])) {
      seen.add(m[1]);
      modulePreloads += `<link rel="modulepreload" href="${m[1]}" />\n`;
    }
  }

  // ── KEY: Inject data BEFORE <head> content so it's available before inline scripts
  html = html.replace("<head>", `<head>${injection}${lcpPreload}${modulePreloads}`);

  const newHeaders = new Headers(response.headers);
  newHeaders.set("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
  newHeaders.set("X-Store-Slug", slug);
  newHeaders.set("X-Data-Source", dataSource);
  newHeaders.set("X-Cache-Timestamp", new Date().toISOString());

  return {
    response: new Response(html, {
      status: response.status,
      headers: newHeaders,
    }),
    dataSource,
  };
}

/* ============== STORE RESPONSE IN EDGE CACHE ============== */

/**
 * Write the fully-formed HTML response to Cache API under BOTH:
 *  1. The early-exit key (hostname+path) — used for instant returns before any processing
 *  2. The slug-specific key — used as fallback validation
 */
function storeInEdgeCache(ctx, hostname, pathname, slug, response) {
  const earlyKey = getEarlyCacheKey(hostname, pathname);
  // Clone twice: one for early key, one for slug key
  ctx.waitUntil(
    Promise.all([
      cache.put(earlyKey, response.clone()),
      slug
        ? cache.put(getCacheKey({ url: `https://${hostname}${pathname}`, headers: { get: () => hostname } }, slug), response.clone())
        : Promise.resolve(),
    ]).catch(() => {})
  );
}

/* ============== CACHED FETCH (HARDENED) ============== */

async function cachedFetch(request, slug = "", ctx, isCustomDomain = false, env = {}) {
  const url = new URL(request.url);
  const hostname = request.headers.get("host") || url.hostname;

  // Only cache GET requests — all others bypass to origin
  if (request.method !== "GET") {
    if (isCustomDomain && slug) {
      const { response, dataSource } = await fetchAndInjectSlug(request, slug, ctx, env);
      return addDiagnosticHeaders(response, { slug, cacheStatus: "BYPASS", dataSource });
    }
    return addDiagnosticHeaders(await proxyToOrigin(request), { slug, cacheStatus: "BYPASS", dataSource: "none" });
  }

  // Skip cache for admin, API, dashboard, and authenticated requests
  if (
    url.pathname.startsWith("/admin") ||
    url.pathname.startsWith("/api") ||
    url.pathname.startsWith("/dashboard") ||
    request.headers.get("cookie")?.includes("auth")
  ) {
    if (isCustomDomain && slug) {
      const { response, dataSource } = await fetchAndInjectSlug(request, slug, ctx, env);
      return addDiagnosticHeaders(response, { slug, cacheStatus: "BYPASS", dataSource });
    }
    return addDiagnosticHeaders(await proxyToOrigin(request), { slug, cacheStatus: "BYPASS", dataSource: "none" });
  }

  // NOTE: Cache lookup already happened in main handler (early exit).
  // If we're here, it was a MISS. Fetch fresh and store.

  let res;
  let dataSource = "none";
  try {
    if (slug) {
      const result = await fetchAndInjectSlug(request, slug, ctx, env);
      res = result.response;
      dataSource = result.dataSource;
    } else {
      res = await proxyToOrigin(request);
    }
  } catch {
    const earlyKey = getEarlyCacheKey(hostname, url.pathname);
    const fallback = await cache.match(earlyKey);
    if (fallback) return addDiagnosticHeaders(fallback, { slug, cacheStatus: "STALE-FALLBACK", dataSource: "cached" });
    return new Response("Server Error", { status: 500 });
  }

  const contentType = res.headers.get("content-type") || "";
  if (res.status === 200 && contentType.includes("text/html")) {
    // Validate tenant marker before caching
    if (slug) {
      const htmlSlugHeader = res.headers.get("X-Store-Slug");
      if (htmlSlugHeader === slug) {
        storeInEdgeCache(ctx, hostname, url.pathname, slug, res);
      }
    } else {
      storeInEdgeCache(ctx, hostname, url.pathname, "", res);
    }
  }

  return addDiagnosticHeaders(res, { slug, cacheStatus: "MISS", dataSource });
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
      const res = await callEdgeFunction("seo-page", {
        slug,
        type: "og",
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
    const res = await callEdgeFunction("seo-page", { slug, type: "sitemap" });
    return new Response(await res.text(), {
      status: res.ok ? 200 : 500,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=86400",
      },
    });
  }

  if (url.pathname === "/robots.txt") {
    const res = await callEdgeFunction("seo-page", { slug, type: "robots" });
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

        // Also check KV binding status
        let kvStatus = "not-bound";
        if (env?.STORE_KV) {
          try {
            await env.STORE_KV.get("__health_check__");
            kvStatus = "connected";
          } catch {
            kvStatus = "error";
          }
        }

        return new Response(
          JSON.stringify({
            status: originCheck.ok ? "healthy" : "degraded",
            origin: originCheck.status,
            workerVersion: WORKER_VERSION,
            kvStatus,
            timestamp: new Date().toISOString(),
          }),
          {
            status: originCheck.ok ? 200 : 503,
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          }
        );
      } catch {
        return new Response(
          JSON.stringify({ status: "unhealthy", origin: "timeout", workerVersion: WORKER_VERSION, timestamp: new Date().toISOString() }),
          { status: 503, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }
        );
      }
    }

    // ─── RATE LIMIT CLEANUP ───
    cleanRateLimitMap();

    // ─── STATIC ASSETS → PROXY TO ORIGIN ───
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

    // ─── SUPABASE API → pass through ───
    if (url.pathname.startsWith("/api") || url.pathname.startsWith("/rest")) {
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
        const customDomain = await getCustomDomainForSlug(redirectSlug);
        if (customDomain) {
          return Response.redirect(
            `https://${customDomain}${remainingPath}${url.search}`,
            301
          );
        }
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

      return cachedFetch(request, "", ctx, false, env);
    }

    // ─── SUBDOMAIN ───
    if (hostname.endsWith(`.${ROOT_DOMAIN}`)) {
      const slug = hostname.replace(`.${ROOT_DOMAIN}`, "");

      if (!slug || slug.includes(".") || slug === "www") {
        return cachedFetch(request, "", ctx, false, env);
      }

      // Parallelize: custom domain check + SEO files + bot detection + main fetch
      const [customDomain, seoResponse, botResponse] = await Promise.all([
        getCustomDomainForSlug(slug),
        handleSeoFiles(url, slug),
        handleBot(request, slug, url, false),
      ]);

      // 301 redirect to custom domain if one exists
      if (customDomain) {
        return Response.redirect(
          `https://${customDomain}${url.pathname}${url.search}`,
          301
        );
      }

      if (seoResponse) return seoResponse;
      if (botResponse) return botResponse;

      return cachedFetch(request, slug, ctx, false, env);
    }

    // ─── CUSTOM DOMAIN ───

    // Canonical redirect: www → apex for custom domains
    if (hostname.startsWith("www.")) {
      const apex = hostname.slice(4);
      return Response.redirect(
        `https://${apex}${url.pathname}${url.search}`,
        301
      );
    }

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

      return cachedFetch(request, slug, ctx, true, env);
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
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=60",
          "X-Worker-Version": WORKER_VERSION,
        },
      }
    );
  },
};
