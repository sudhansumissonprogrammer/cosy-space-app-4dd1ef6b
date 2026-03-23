/**
 * STORIVO PRODUCTION ROUTER (FINAL UPGRADED + SEO BOT RENDER)
 * - Subdomain + Custom domain
 * - Full HTML for search engine bots (via bot-render edge function)
 * - OG tags for social bots
 * - SEO files
 * - Edge caching (optimized)
 * - Timeout protection
 * - Multi-tenant safe cache
 * - Admin/API bypass
 */

const ROOT_DOMAIN = "storivo.in";
const ORIGIN_HOST = "true-path-panel.lovable.app";

const SUPABASE_URL = "https://kzvfjknnslgcwumzlwkb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6dmZqa25uc2xnY3d1bXpsd2tiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NDU1NzEsImV4cCI6MjA4OTQyMTU3MX0.c6TPp3cHVEF2JHYtFcfrCZTlp712eG6t6DwqMaHCAMg";

/* ---------------- BOT DETECTION ---------------- */

// Search engine bots — get FULL HTML with visible content
const SEARCH_BOT_REGEX =
  /Googlebot|Bingbot|DuckDuckBot|YandexBot|Baiduspider|Applebot|Sogou|Exabot|ia_archiver|AhrefsBot|MJ12bot|SemrushBot|PetalBot/i;

// Social/preview bots — get OG meta tags only
const SOCIAL_BOT_REGEX =
  /facebookexternalhit|Facebot|WhatsApp|Twitterbot|TelegramBot|LinkedInBot|Slackbot|Discordbot|Pinterest|Instagram|Snapchat/i;

// Combined for general bot check
const BOT_UA_REGEX =
  /bot|crawler|spider|facebookexternalhit|Facebot|WhatsApp|Twitterbot|TelegramBot|LinkedInBot|Slackbot|Discordbot|Pinterest|Googlebot|Bingbot|YandexBot|Instagram|Snapchat|Applebot|DuckDuckBot|Baiduspider|Sogou|Exabot|ia_archiver|AhrefsBot|MJ12bot|SemrushBot|PetalBot|curl|wget|HeadlessChrome/i;

const cache = caches.default;

/* ---------------- CACHE KEY (MULTI-TENANT SAFE) ---------------- */

function getCacheKey(request, slug = "") {
  const url = new URL(request.url);

  url.searchParams.delete("fbclid");
  url.searchParams.delete("gclid");
  url.searchParams.delete("utm_source");

  const host = request.headers.get("host");

  return new Request(`https://cache/${host}/${slug}${url.pathname}${url.search}`);
}

/* ---------------- HELPERS ---------------- */

function escapeHtml(str = "") {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getProductSlug(pathname) {
  const match = pathname.match(/^\/product\/([^/?#]+)/i);
  return match ? decodeURIComponent(match[1]) : null;
}

function buildSubdomainUrl(slug, path, search = "") {
  return `https://${slug}.${ROOT_DOMAIN}${path}${search}`;
}

/* ---------------- SUPABASE ---------------- */

function callEdgeFunction(name, params = {}) {
  const url = new URL(`${SUPABASE_URL}/functions/v1/${name}`);

  Object.entries(params).forEach(([k, v]) => {
    if (v) url.searchParams.set(k, v);
  });

  return fetch(url.toString(), {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
}

/* ---------------- DOMAIN RESOLUTION ---------------- */

async function resolveDomain(hostname) {
  const key = new Request(`https://cache/domain-${hostname}`);

  const cached = await cache.match(key);
  if (cached) {
    const data = await cached.json();
    return data.slug || null;
  }

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/stores?select=slug&custom_domain=eq.${hostname}&limit=1`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );

    if (!res.ok) return null;

    const data = await res.json();
    const slug = data?.[0]?.slug || null;

    await cache.put(
      key,
      new Response(JSON.stringify({ slug }), {
        headers: { "Cache-Control": "public, max-age=300" },
      })
    );

    return slug;
  } catch {
    return null;
  }
}

/* ---------------- ORIGIN FETCH (SAFE + OPTIMIZED) ---------------- */
async function fetchOrigin(request, slug = null, rewritePath = null) {
  const url = new URL(request.url);
  url.hostname = ORIGIN_HOST;

  if (rewritePath) {
    url.pathname = rewritePath;
  }

  const headers = new Headers(request.headers);
  headers.set("Host", ORIGIN_HOST);

  if (slug) {
    url.searchParams.set("store", slug);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(url.toString(), {
      method: request.method,
      headers,
      signal: controller.signal,
      cf: {
        cacheTtl: 0,
        cacheEverything: false,
      },
    });

    clearTimeout(timeout);

    const newRes = new Response(res.body, res);

    const contentType = newRes.headers.get("content-type") || "";

    // Static assets cache (30 days)
    if (
      contentType.includes("image") ||
      contentType.includes("javascript") ||
      contentType.includes("css")
    ) {
      newRes.headers.set(
        "Cache-Control",
        "public, max-age=2592000, immutable"
      );
    }

    // HTML cache (5 min + stale)
    else if (contentType.includes("text/html")) {
      newRes.headers.set(
        "Cache-Control",
        "public, max-age=300, stale-while-revalidate=86400"
      );
    }

    // Security headers
    newRes.headers.set("X-Frame-Options", "SAMEORIGIN");
    newRes.headers.set("X-Content-Type-Options", "nosniff");
    newRes.headers.set("X-XSS-Protection", "1; mode=block");
    newRes.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
    newRes.headers.set(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()"
    );

    return newRes;
  } catch {
    return new Response(
      `
      <html>
        <head>
          <title>Loading...</title>
          <meta http-equiv="refresh" content="3">
        </head>
        <body style="font-family:sans-serif;text-align:center;padding:50px">
          <h2>Loading your store...</h2>
          <p>Please wait, retrying...</p>
        </body>
      </html>
      `,
      { status: 200, headers: { "Content-Type": "text/html" } }
    );
  }
}


async function cachedFetch(request, slug = "", rewritePath = null) {
  const key = getCacheKey(request, slug);
  const url = new URL(request.url);

  // Skip cache for admin/API
  if (
    url.pathname.startsWith("/admin") ||
    url.pathname.startsWith("/api") ||
    request.headers.get("cookie")?.includes("auth")
  ) {
    return fetchOrigin(request, slug, rewritePath);
  }

  // Try cache
  const cached = await cache.match(key);

  if (cached) {
    // Background refresh (stale-while-revalidate)
    event.waitUntil(
      fetchOrigin(request, slug, rewritePath).then((res) => {
        const contentType = res.headers.get("content-type") || "";

        if (res.ok && contentType.includes("text/html")) {
          cache.put(key, res.clone());
        }
      }).catch(() => {})
    );

    return cached;
  }

  let res;

  try {
    res = await fetchOrigin(request, slug, rewritePath);
  } catch {
    const fallback = await cache.match(key);
    if (fallback) return fallback;
    return new Response("Server Error", { status: 500 });
  }

  const contentType = res.headers.get("content-type") || "";

  if (res.ok && contentType.includes("text/html")) {
    await cache.put(key, res.clone());
  }

  return res;
}

/* ---------------- OG HTML (for social bots only) ---------------- */

function buildOgHtml(og, finalUrl) {
  const title = escapeHtml(og.title || "");
  const desc = escapeHtml(og.description || "");
  const img = og.image || "";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${title}</title>

<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${finalUrl}">
${img ? `<meta property="og:image" content="${img}">` : ""}

<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="${finalUrl}">

<meta http-equiv="refresh" content="0;url=${finalUrl}">
<script>location.replace("${finalUrl}")</script>

</head>
<body></body>
</html>`;
}

/* ---------------- BOT HANDLER (UPGRADED) ---------------- */

async function handleBot(request, slug, url, isCustom) {
  const ua = request.headers.get("User-Agent") || "";
  if (!BOT_UA_REGEX.test(ua)) return null;

  const product = getProductSlug(url.pathname);
  const finalUrl = isCustom
    ? `${url.origin}${url.pathname}${url.search}`
    : buildSubdomainUrl(slug, url.pathname, url.search);

  // --- SEARCH ENGINE BOTS: full HTML with visible content ---
  if (SEARCH_BOT_REGEX.test(ua)) {
    try {
      const botCacheKey = new Request(
        `https://cache/bot-render/${slug}/${product || "home"}`
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
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
          },
        });
        await cache.put(botCacheKey, response.clone());
        return response;
      }
    } catch {
      // Fall through to OG fallback
    }
  }

  // --- SOCIAL BOTS: OG meta tags only ---
  try {
    const res = await callEdgeFunction("og-meta", {
      slug,
      ...(product ? { product } : {}),
    });

    if (!res.ok) return null;

    const og = await res.json();

    return new Response(buildOgHtml(og, finalUrl), {
      headers: {
        "Content-Type": "text/html",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch {
    return null;
  }
}

/* ---------------- MAIN ---------------- */

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const hostname = url.hostname;

    // ROOT DOMAIN
    if (hostname === ROOT_DOMAIN || hostname === `www.${ROOT_DOMAIN}`) {
      const match = url.pathname.match(/^\/store\/([a-zA-Z0-9_-]+)(\/.*)?$/);

      if (match) {
        return Response.redirect(
          `https://${match[1]}.${ROOT_DOMAIN}${match[2] || ""}${url.search}`,
          301
        );
      }

      return cachedFetch(request);
    }

    // SUBDOMAIN
    if (hostname.endsWith(`.${ROOT_DOMAIN}`)) {
      const slug = hostname.replace(`.${ROOT_DOMAIN}`, "");

      if (!slug || slug.includes(".")) {
        return cachedFetch(request);
      }

      if (url.pathname === "/sitemap.xml") {
        return callEdgeFunction("sitemap", { slug });
      }

      if (url.pathname === "/robots.txt") {
        return callEdgeFunction("robots-txt", { slug });
      }

      const bot = await handleBot(request, slug, url, false);
      if (bot) return bot;

      return cachedFetch(request, slug);
    }

    // CUSTOM DOMAIN
    const slug = await resolveDomain(hostname);

    if (slug) {
      if (url.pathname === "/sitemap.xml") {
        return callEdgeFunction("sitemap", { slug });
      }

      if (url.pathname === "/robots.txt") {
        return callEdgeFunction("robots-txt", { slug });
      }

      const bot = await handleBot(request, slug, url, true);
      if (bot) return bot;

      return cachedFetch(request, slug);
    }

    // FALLBACK
    return cachedFetch(request);
  },
};
