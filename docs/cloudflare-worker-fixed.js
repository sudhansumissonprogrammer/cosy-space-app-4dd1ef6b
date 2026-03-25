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

/* ============== INJECT STORE SLUG INTO HTML ============== */
/**
 * FIX #2: For custom domains, the SPA running in the browser has no way
 * to detect which store to load.
 *
 * PERF: Also injects window.__STOREFRONT_DATA__ with pre-fetched storefront
 * data so the SPA renders instantly without an API waterfall.
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

  html = html.replace("<head>", `<head>${injection}`);

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
    ctx.waitUntil(
      proxyToOrigin(request)
        .then((res) => {
          const ct = res.headers.get("content-type") || "";
          if (res.ok && ct.includes("text/html")) {
            return cache.put(key, res.clone());
          }
        })
        .catch(() => {})
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
      const res = await callEdgeFunction("seo-page", {
        type: "og",
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
    const res = await callEdgeFunction("seo-page", { type: "sitemap", slug });
    return new Response(await res.text(), {
      status: res.ok ? 200 : 500,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=86400",
      },
    });
  }

  if (url.pathname === "/robots.txt") {
    const res = await callEdgeFunction("seo-page", { type: "robots", slug });
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
