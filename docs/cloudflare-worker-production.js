/**
 * Cloudflare Worker: storivo-router
 * Handles: subdomain routing, custom domain resolution, OG rewriting, SEO files, caching
 */

const ROOT_DOMAIN = "storivo.in";
const ORIGIN_HOST = "true-path-panel.lovable.app";
const SUPABASE_URL = "https://kzvfjknnslgcwumzlwkb.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_KEY";

const BOT_UA_REGEX =
  /bot|crawler|spider|facebookexternalhit|Facebot|WhatsApp|Twitterbot|TelegramBot|LinkedInBot|Slackbot|Discordbot|Pinterest|Googlebot|Bingbot|YandexBot/i;

const cache = caches.default;

/* ---------------- HELPERS ---------------- */

function getCacheKey(request) {
  const url = new URL(request.url);
  url.searchParams.delete("fbclid");
  url.searchParams.delete("gclid");
  url.searchParams.delete("utm_source");
  return new Request(url.toString(), request);
}

function escapeHtml(str = "") {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getProductSlugFromPath(pathname) {
  const match = pathname.match(/^\/product\/([^/?#]+)/i);
  return match ? decodeURIComponent(match[1]) : null;
}

function buildStoreUrl(slug, pathname, search = "") {
  return `https://${slug}.${ROOT_DOMAIN}${pathname}${search}`;
}

/* ---------------- RESOLVE CUSTOM DOMAIN → SLUG ---------------- */

async function resolveCustomDomain(hostname) {
  const cacheKey = new Request(`https://cache/domain-resolve-${hostname}`);
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

    // Cache the resolution for 5 minutes
    const cacheResponse = new Response(JSON.stringify({ slug }), {
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
    });
    await cache.put(cacheKey, cacheResponse);

    return slug;
  } catch {
    return null;
  }
}

/* ---------------- PROXY TO ORIGIN ---------------- */

async function proxyToOrigin(request, storeSlug) {
  const originUrl = new URL(request.url);
  originUrl.hostname = ORIGIN_HOST;

  // If we resolved a store slug (custom domain), pass it as ?store= so the frontend picks it up
  if (storeSlug) {
    originUrl.searchParams.set("store", storeSlug);
  }

  const headers = new Headers(request.headers);
  headers.set("Host", ORIGIN_HOST);

  try {
    const response = await fetch(originUrl.toString(), {
      method: request.method,
      headers,
      cf: { cacheTtl: 60, cacheEverything: true },
    });
    const newResponse = new Response(response.body, response);
    newResponse.headers.set("Cache-Control", "public, max-age=60, s-maxage=60");
    return newResponse;
  } catch {
    return new Response("Origin fetch failed", { status: 500 });
  }
}

/* ---------------- CACHED PAGE ---------------- */

async function handleCachedPage(request, storeSlug) {
  const cacheKey = getCacheKey(request);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const response = await proxyToOrigin(request, storeSlug);
  if (response.ok) {
    await cache.put(cacheKey, response.clone());
  }
  return response;
}

/* ---------------- SUPABASE EDGE FUNCTION CALL ---------------- */

function callEdgeFunction(name, params = {}) {
  const endpoint = new URL(`${SUPABASE_URL}/functions/v1/${name}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v) endpoint.searchParams.set(k, String(v));
  });
  return fetch(endpoint.toString(), {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
}

async function cachedFetch(fetchPromise, cacheKey, ttl = 300) {
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  let response;
  try {
    response = await fetchPromise;
  } catch {
    return new Response(null, { status: 500 });
  }
  if (!response || !response.ok) return response;

  const newResponse = new Response(response.body, response);
  newResponse.headers.set("Cache-Control", `public, max-age=${ttl}`);
  await cache.put(cacheKey, newResponse.clone());
  return newResponse;
}

/* ---------------- OG HTML ---------------- */

function buildOgHtml(og, storeUrl) {
  const title = escapeHtml(og.title || "");
  const description = escapeHtml(og.description || "");
  const image = og.image || "";
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${title}</title>
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${escapeHtml(storeUrl)}">
${image ? `<meta property="og:image" content="${escapeHtml(image)}">` : ""}
<meta http-equiv="refresh" content="0;url=${escapeHtml(storeUrl)}">
<script>location.replace("${storeUrl}")</script>
</head>
<body>Redirecting...</body>
</html>`;
}

/* ---------------- HANDLE STORE (shared for subdomain + custom domain) ---------------- */

async function handleStore(request, slug, useCustomDomainUrl) {
  const url = new URL(request.url);

  /* SITEMAP */
  if (url.pathname === "/sitemap.xml") {
    const cacheKey = new Request(`https://cache/sitemap-${slug}`);
    return cachedFetch(callEdgeFunction("sitemap", { slug }), cacheKey, 86400);
  }

  /* ROBOTS */
  if (url.pathname === "/robots.txt") {
    const cacheKey = new Request(`https://cache/robots-${slug}`);
    return cachedFetch(callEdgeFunction("robots-txt", { slug }), cacheKey, 86400);
  }

  /* BOT TRAFFIC (OG TAGS) */
  const ua = request.headers.get("User-Agent") || "";
  if (BOT_UA_REGEX.test(ua)) {
    try {
      const productSlug = getProductSlugFromPath(url.pathname);
      const cacheKey = new Request(`https://cache/og-${slug}-${productSlug || "home"}`);
      const ogRes = await cachedFetch(
        callEdgeFunction("og-meta", {
          slug,
          ...(productSlug ? { product: productSlug } : {}),
        }),
        cacheKey,
        600
      );
      if (ogRes && ogRes.ok) {
        const og = await ogRes.json();
        // For custom domains, use the actual URL; for subdomains, build the subdomain URL
        const canonical = useCustomDomainUrl
          ? `${url.origin}${url.pathname}${url.search}`
          : buildStoreUrl(slug, url.pathname, url.search);
        return new Response(buildOgHtml(og, canonical), {
          headers: {
            "Content-Type": "text/html",
            "Cache-Control": "public, max-age=300",
          },
        });
      }
    } catch (err) {
      console.log("OG ERROR:", err);
    }
  }

  /* NORMAL USERS */
  return handleCachedPage(request, useCustomDomainUrl ? slug : null);
}

/* ---------------- MAIN ---------------- */

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const hostname = url.hostname;

    /* 1. ROOT DOMAIN (storivo.in / www.storivo.in) */
    if (hostname === ROOT_DOMAIN || hostname === `www.${ROOT_DOMAIN}`) {
      const match = url.pathname.match(/^\/store\/([a-zA-Z0-9_-]+)(\/.*)?$/);
      if (match) {
        const slug = match[1];
        const remaining = match[2] || "";
        return Response.redirect(
          `https://${slug}.${ROOT_DOMAIN}${remaining}${url.search}`,
          301
        );
      }
      return handleCachedPage(request, null);
    }

    /* 2. SUBDOMAIN (slug.storivo.in) */
    if (hostname.endsWith(`.${ROOT_DOMAIN}`)) {
      const slug = hostname.replace(`.${ROOT_DOMAIN}`, "");
      if (!slug || slug.includes(".") || slug === "www") {
        return handleCachedPage(request, null);
      }
      return handleStore(request, slug, false);
    }

    /* 3. CUSTOM DOMAIN (www.mybrand.com, mybrand.com, etc.) */
    const resolvedSlug = await resolveCustomDomain(hostname);
    if (resolvedSlug) {
      return handleStore(request, resolvedSlug, true);
    }

    /* 4. UNKNOWN DOMAIN — proxy as-is */
    return handleCachedPage(request, null);
  },
};
