/**
 * Cloudflare Worker: storivo-router (v4 — static-first)
 *
 * Handles:
 * 1. Subdomain routing + custom domain resolution
 * 2. Static-first rendering via render-page edge function
 * 3. Per-tenant HTML caching with stale-while-revalidate
 * 4. Bot/crawler OG rewriting
 * 5. SEO files (sitemap.xml, robots.txt)
 * 6. Security headers
 * 7. Timeout handling with cached fallback
 * 8. /revalidate API for cache purging
 *
 * Routes:
 *   *.storivo.in/*       → subdomains
 *   storivo.in/store/*   → 301 redirect to subdomain
 *   custom-domains       → resolved via edge function
 *
 * Deploy: Workers & Pages → Create Worker → Paste code → Add routes
 */

const ROOT_DOMAIN = "storivo.in";
const ORIGIN_HOST = "true-path-panel.lovable.app";
const SUPABASE_URL = "https://kzvfjknnslgcwumzlwkb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6dmZqa25uc2xnY3d1bXpsd2tiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NDU1NzEsImV4cCI6MjA4OTQyMTU3MX0.c6TPp3cHVEF2JHYtFcfrCZTlp712eG6t6DwqMaHCAMg";

// Origin fetch timeout (prevents Cloudflare 524)
const ORIGIN_TIMEOUT_MS = 15000;
// Cache TTLs (seconds)
const HTML_CACHE_TTL = 300;       // 5 min for pre-rendered HTML
const STALE_TTL = 86400;          // Serve stale for up to 24h on error
const SEO_CACHE_TTL = 86400;      // 24h for sitemap/robots
const OG_CACHE_TTL = 600;         // 10 min for OG responses
const DOMAIN_CACHE_TTL = 300;     // 5 min for custom domain resolution
const STATIC_CACHE_TTL = 2592000; // 30 days for static assets

const BOT_UA_REGEX =
  /bot|crawler|spider|facebookexternalhit|Facebot|WhatsApp|Twitterbot|TelegramBot|LinkedInBot|Slackbot|Discordbot|Pinterest|Googlebot|Bingbot|YandexBot|OpenGraphIO|Embedly|Iframely|PetalBot|Prerender|Lighthouse/i;

const STATIC_EXT_REGEX = /\.(js|css|png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|ttf|eot|map|json|webmanifest)$/i;

// Storefront page paths that should be pre-rendered
const STOREFRONT_PAGE_REGEX = /^\/($|product\/|category\/|best-sellers|contact|account|cart|checkout|wishlist|track|privacy|terms|returns|shipping)/;

const cache = caches.default;

/* ==================== SECURITY HEADERS ==================== */

const SECURITY_HEADERS = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "X-XSS-Protection": "1; mode=block",
};

function addSecurityHeaders(response) {
  const newResponse = new Response(response.body, response);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    newResponse.headers.set(key, value);
  }
  newResponse.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://fonts.googleapis.com https://wa.me; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https: http:; connect-src 'self' https://*.supabase.co https://fonts.googleapis.com https://wa.me https://*.r2.dev; frame-ancestors 'self'"
  );
  return newResponse;
}

/* ==================== HELPERS ==================== */

function escapeHtml(str = "") {
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function getCacheKey(request, storeSlug) {
  const url = new URL(request.url);
  for (const p of ["fbclid", "gclid", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
    url.searchParams.delete(p);
  }
  if (storeSlug) {
    url.searchParams.set("__store", storeSlug);
  }
  return new Request(url.toString(), { method: "GET" });
}

function isStaticAsset(pathname) {
  return STATIC_EXT_REGEX.test(pathname);
}

function getProductSlugFromPath(pathname) {
  const match = pathname.match(/^\/product\/([^/?#]+)/i);
  return match ? decodeURIComponent(match[1]) : null;
}

function buildStoreUrl(slug, pathname, search = "") {
  return `https://${slug}.${ROOT_DOMAIN}${pathname}${search}`;
}

/* ==================== ORIGIN FETCH WITH TIMEOUT ==================== */

async function fetchWithTimeout(url, options = {}, timeoutMs = ORIGIN_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") throw new Error("ORIGIN_TIMEOUT");
    throw err;
  }
}

/* ==================== SUPABASE EDGE FUNCTION ==================== */

function callEdgeFunction(name, params = {}) {
  const endpoint = new URL(`${SUPABASE_URL}/functions/v1/${name}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") {
      endpoint.searchParams.set(k, String(v));
    }
  }
  return fetchWithTimeout(
    endpoint.toString(),
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    },
    10000
  );
}

/* ==================== CACHED EDGE FUNCTION ==================== */

async function cachedEdgeCall(name, params, cacheKeyUrl, ttl) {
  const cacheKey = new Request(cacheKeyUrl);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  try {
    const response = await callEdgeFunction(name, params);
    if (!response || !response.ok) return response || new Response(null, { status: 502 });

    const body = await response.text();
    const contentType = response.headers.get("Content-Type") || "text/plain";
    const newResponse = new Response(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": `public, max-age=${ttl}, stale-while-revalidate=${STALE_TTL}`,
      },
    });
    await cache.put(cacheKey, newResponse.clone());
    return newResponse;
  } catch {
    return new Response("Service temporarily unavailable", { status: 503 });
  }
}

/* ==================== CUSTOM DOMAIN RESOLUTION ==================== */

async function resolveCustomDomain(hostname) {
  const cacheKeyUrl = `https://cache-internal/domain-resolve/${hostname}`;
  const cacheKey = new Request(cacheKeyUrl);
  const cached = await cache.match(cacheKey);
  if (cached) {
    const data = await cached.json();
    return data.slug || null;
  }

  try {
    const res = await callEdgeFunction("get-store-by-domain", { domain: hostname });
    if (!res.ok) return null;
    const data = await res.json();
    const slug = data.slug || null;
    await cache.put(
      cacheKey,
      new Response(JSON.stringify({ slug }), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": `public, max-age=${DOMAIN_CACHE_TTL}`,
        },
      })
    );
    return slug;
  } catch {
    return null;
  }
}

/* ==================== PROXY TO ORIGIN (SPA FALLBACK) ==================== */

async function proxyToOrigin(request, storeSlug) {
  const originUrl = new URL(request.url);
  originUrl.hostname = ORIGIN_HOST;
  if (storeSlug) {
    originUrl.searchParams.set("store", storeSlug);
  }
  const headers = new Headers(request.headers);
  headers.set("Host", ORIGIN_HOST);
  headers.set("X-Forwarded-Host", new URL(request.url).hostname);
  return fetchWithTimeout(originUrl.toString(), {
    method: request.method,
    headers,
    redirect: "follow",
  });
}

/* ==================== PRE-RENDERED PAGE (STATIC-FIRST) ==================== */

/**
 * Fetch a pre-rendered HTML page from the render-page edge function.
 * Falls back to SPA proxy if rendering fails.
 */
async function fetchPreRenderedPage(request, storeSlug, isCustomDomain) {
  const url = new URL(request.url);
  const hostname = url.hostname;

  try {
    const params = {
      slug: storeSlug,
      path: url.pathname || "/",
      origin: ORIGIN_HOST,
    };
    if (isCustomDomain) {
      params.domain = hostname;
    }

    const response = await callEdgeFunction("render-page", params);
    if (response && response.ok) {
      return response;
    }
  } catch {
    // Fall through to SPA proxy
  }

  // Fallback: proxy to SPA origin
  return proxyToOrigin(request, storeSlug);
}

/* ==================== CACHED PAGE WITH STATIC-FIRST ==================== */

async function handleCachedPage(request, storeSlug, isCustomDomain = false) {
  const url = new URL(request.url);

  // Static assets: long cache, no store isolation needed
  if (isStaticAsset(url.pathname)) {
    const cacheKey = getCacheKey(request, null);
    const cached = await cache.match(cacheKey);
    if (cached) return addSecurityHeaders(cached);

    try {
      const response = await proxyToOrigin(request, storeSlug);
      if (response.ok) {
        const newResponse = new Response(response.body, response);
        newResponse.headers.set("Cache-Control", `public, max-age=${STATIC_CACHE_TTL}, immutable`);
        await cache.put(cacheKey, newResponse.clone());
        return addSecurityHeaders(newResponse);
      }
      return addSecurityHeaders(response);
    } catch {
      return new Response("Asset unavailable", { status: 503 });
    }
  }

  // HTML pages: per-tenant cache
  const cacheKey = getCacheKey(request, storeSlug);
  const cached = await cache.match(cacheKey);

  if (cached) {
    return addSecurityHeaders(cached);
  }

  // No cache — fetch pre-rendered page or SPA fallback
  try {
    const isStorefrontPage = storeSlug && STOREFRONT_PAGE_REGEX.test(url.pathname);
    const response = isStorefrontPage
      ? await fetchPreRenderedPage(request, storeSlug, isCustomDomain)
      : await proxyToOrigin(request, storeSlug);

    if (response.ok) {
      const newResponse = new Response(response.body, response);
      newResponse.headers.set(
        "Cache-Control",
        `public, max-age=${HTML_CACHE_TTL}, stale-while-revalidate=${STALE_TTL}, stale-if-error=${STALE_TTL}`
      );
      newResponse.headers.set("Vary", "Cookie");
      await cache.put(cacheKey, newResponse.clone());
      return addSecurityHeaders(newResponse);
    }

    return addSecurityHeaders(response);
  } catch (err) {
    const staleResponse = await cache.match(cacheKey);
    if (staleResponse) {
      const stale = new Response(staleResponse.body, staleResponse);
      stale.headers.set("X-Cache-Status", "stale-on-error");
      return addSecurityHeaders(stale);
    }

    const status = err.message === "ORIGIN_TIMEOUT" ? 504 : 502;
    return addSecurityHeaders(
      new Response(
        `<!DOCTYPE html><html><head><title>Loading...</title><meta http-equiv="refresh" content="5"></head><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif"><div style="text-align:center"><h2>Just a moment...</h2><p>The store is loading. This page will refresh automatically.</p></div></body></html>`,
        {
          status,
          headers: { "Content-Type": "text/html", "Cache-Control": "no-store" },
        }
      )
    );
  }
}

/* ==================== REVALIDATION HANDLER ==================== */

/**
 * Purge cached pages for a store.
 * Called by the revalidate edge function or directly.
 */
async function handleRevalidate(request, storeSlug, isCustomDomain) {
  const url = new URL(request.url);
  const path = url.searchParams.get("path");

  if (!storeSlug) {
    return new Response(JSON.stringify({ error: "No store context" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Call the revalidate edge function to get the list of paths
  try {
    const revalRes = await callEdgeFunction("revalidate", {
      slug: storeSlug,
      ...(path ? { path } : {}),
    });

    if (!revalRes.ok) {
      return new Response(revalRes.body, { status: revalRes.status, headers: { "Content-Type": "application/json" } });
    }

    const manifest = await revalRes.json();
    let purgedCount = 0;

    // Purge each path from the Cloudflare cache
    for (const pagePath of manifest.paths || []) {
      // Build the cache key URL for this path
      const hostname = isCustomDomain ? url.hostname : `${storeSlug}.${ROOT_DOMAIN}`;
      const purgeUrl = new URL(`https://${hostname}${pagePath}`);
      purgeUrl.searchParams.set("__store", storeSlug);
      const purgeKey = new Request(purgeUrl.toString(), { method: "GET" });

      const deleted = await cache.delete(purgeKey);
      if (deleted) purgedCount++;
    }

    return new Response(
      JSON.stringify({
        slug: storeSlug,
        paths_requested: manifest.paths?.length || 0,
        paths_purged: purgedCount,
        invalidated_at: new Date().toISOString(),
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Revalidation failed", details: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

/* ==================== OG HTML FOR BOTS ==================== */

function buildOgHtml(og, storeUrl) {
  const title = escapeHtml(og.title || "");
  const description = escapeHtml(og.description || "");
  const image = og.image || "";
  const siteName = escapeHtml(og.title?.split("—")[0]?.trim() || og.title || "");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<meta name="description" content="${description}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${escapeHtml(storeUrl)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${siteName}">
${image ? `<meta property="og:image" content="${escapeHtml(image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">` : ""}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
${image ? `<meta name="twitter:image" content="${escapeHtml(image)}">` : ""}
<link rel="canonical" href="${escapeHtml(storeUrl)}">
<meta http-equiv="refresh" content="0;url=${escapeHtml(storeUrl)}">
<script>window.location.replace("${storeUrl}");</script>
</head>
<body><p>Redirecting to <a href="${escapeHtml(storeUrl)}">${siteName}</a>...</p></body>
</html>`;
}

/* ==================== HANDLE STORE REQUEST ==================== */

async function handleStore(request, slug, isCustomDomain) {
  const url = new URL(request.url);

  /* REVALIDATE API — require Authorization header */
  if (url.pathname === "/revalidate") {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }
    return handleRevalidate(request, slug, isCustomDomain);
  }

  /* SITEMAP */
  if (url.pathname === "/sitemap.xml") {
    const sitemapDomain = isCustomDomain ? url.hostname : `${slug}.${ROOT_DOMAIN}`;
    return cachedEdgeCall(
      "sitemap",
      { slug, domain: sitemapDomain },
      `https://cache-internal/sitemap/${slug}/${sitemapDomain}`,
      SEO_CACHE_TTL
    );
  }

  /* ROBOTS.TXT */
  if (url.pathname === "/robots.txt") {
    const robotsDomain = isCustomDomain ? url.hostname : `${slug}.${ROOT_DOMAIN}`;
    return cachedEdgeCall(
      "robots-txt",
      { slug, domain: robotsDomain },
      `https://cache-internal/robots/${slug}/${robotsDomain}`,
      SEO_CACHE_TTL
    );
  }

  /* BOT TRAFFIC → OG tags */
  const ua = request.headers.get("User-Agent") || "";
  if (BOT_UA_REGEX.test(ua)) {
    try {
      const productSlug = getProductSlugFromPath(url.pathname);
      const versionToken = url.searchParams.get("v");

      const shareRes = await cachedEdgeCall(
        "share-page",
        { slug, ...(productSlug ? { product: productSlug } : {}), ...(versionToken ? { v: versionToken } : {}) },
        `https://cache-internal/share/${slug}/${productSlug || "home"}/${versionToken || ""}`,
        OG_CACHE_TTL
      );
      if (shareRes && shareRes.ok) return shareRes;

      const ogRes = await cachedEdgeCall(
        "og-meta",
        { slug, ...(productSlug ? { product: productSlug } : {}) },
        `https://cache-internal/og/${slug}/${productSlug || "home"}`,
        OG_CACHE_TTL
      );
      if (ogRes && ogRes.ok) {
        const og = await ogRes.json();
        const canonical = isCustomDomain
          ? `${url.origin}${url.pathname}${url.search}`
          : buildStoreUrl(slug, url.pathname, url.search);
        return new Response(buildOgHtml(og, canonical), {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": `public, max-age=${OG_CACHE_TTL}, stale-while-revalidate=${STALE_TTL}`,
          },
        });
      }
    } catch {
      // Fall through to normal page
    }
  }

  /* NORMAL USERS — static-first rendering */
  return handleCachedPage(request, slug, isCustomDomain);
}

/* ==================== MAIN ENTRY ==================== */

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const hostname = url.hostname;

    /* 1. ROOT DOMAIN — redirect /store/{slug} paths */
    if (hostname === ROOT_DOMAIN || hostname === `www.${ROOT_DOMAIN}`) {
      const match = url.pathname.match(/^\/store\/([a-zA-Z0-9_-]+)(\/.*)?$/);
      if (match) {
        const slug = match[1];
        const remaining = match[2] || "";
        return new Response(null, {
          status: 301,
          headers: {
            Location: `https://${slug}.${ROOT_DOMAIN}${remaining}${url.search}`,
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      }
      return handleCachedPage(request, null);
    }

    /* 2. SUBDOMAIN ({slug}.storivo.in) */
    if (hostname.endsWith(`.${ROOT_DOMAIN}`)) {
      const slug = hostname.replace(`.${ROOT_DOMAIN}`, "");
      if (!slug || slug.includes(".") || slug === "www") {
        return handleCachedPage(request, null);
      }
      return handleStore(request, slug, false);
    }

    /* 3. CUSTOM DOMAIN */
    const resolvedSlug = await resolveCustomDomain(hostname);
    if (resolvedSlug) {
      return handleStore(request, resolvedSlug, true);
    }

    /* 4. UNKNOWN — proxy as-is */
    return handleCachedPage(request, null);
  },
};
