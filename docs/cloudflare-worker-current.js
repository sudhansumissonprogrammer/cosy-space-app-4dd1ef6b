/**
 * STORIVO PRODUCTION ROUTER v4.0 — NON-BLOCKING FAST SHELL
 *
 * Changes from v3.4:
 *   - NON-BLOCKING COLD LOAD: On cache MISS, returns shell HTML immediately
 *     with only slug + generic skeleton. DB data fetched in background via
 *     ctx.waitUntil and warms the full HTML cache for the NEXT request.
 *   - FAST SHELL MODE: New injectFastShell() — zero DB dependency, ~50ms.
 *     Only injects slug, preconnects, and a generic themed skeleton.
 *   - FULL INJECTION ONLY ON CACHE WARM: injectIntoHtml() (with data, theme,
 *     categories) only runs during prewarm and background revalidation —
 *     never on the critical response path.
 *   - ELIMINATED Promise.all BLOCKING: fetchAndInjectSlug no longer awaits
 *     prefetchStorefrontData before returning.
 *   - INCREASED EARLY HTML TTL: 600s → 1200s for edge cache.
 *
 * Architecture:
 *   User → Edge Cache (full HTML with data) → DONE (0 fetches)
 *        ↓ MISS
 *   SPA Shell (Cache API → KV → origin) → Fast Shell inject → Response (~50ms)
 *        ↓ ctx.waitUntil (background)
 *   prefetchStorefrontData → injectIntoHtml → warm Edge Cache for next request
 *
 * Result: Cold load Worker response in 50-120ms instead of 200-600ms.
 */

const WORKER_VERSION = "4.0";
const ROOT_DOMAIN = "storivo.in";
const ORIGIN_HOST = "dear-console.lovable.app";

const SUPABASE_URL = "https://soxuyuupzodkufxbbndq.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNveHV5dXVwem9ka3VmeGJibmRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1OTI5ODYsImV4cCI6MjA5MDE2ODk4Nn0.cnK4FujigfVvNaXfNwQBb9qUQei8IQecHbDoVjFewQU";

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

/* ============== REVALIDATION COOLDOWN ============== */

const revalCooldowns = new Map();
const REVAL_COOLDOWN_MS = 30_000;
const REVAL_MAP_MAX = 5_000;

function shouldRevalidate(key) {
  const now = Date.now();
  const lastReval = revalCooldowns.get(key) || 0;
  if (now - lastReval < REVAL_COOLDOWN_MS) return false;
  if (!revalCooldowns.has(key) && revalCooldowns.size >= REVAL_MAP_MAX) return false;
  revalCooldowns.set(key, now);
  return true;
}

async function shouldRevalidateGlobal(key, env) {
  if (!shouldRevalidate(key)) return false;
  if (env?.STORE_KV) {
    try {
      const lockKey = `reval-lock:${key}`;
      const existing = await env.STORE_KV.get(lockKey);
      if (existing) return false;
      await env.STORE_KV.put(lockKey, "1", { expirationTtl: 30 });
    } catch {}
  }
  return true;
}

let lastRevalCleanup = 0;
function cleanRevalMap() {
  const now = Date.now();
  if (now - lastRevalCleanup < 60_000 && revalCooldowns.size < 500) return;
  lastRevalCleanup = now;
  for (const [key, ts] of revalCooldowns) {
    if (now - ts > REVAL_COOLDOWN_MS * 2) revalCooldowns.delete(key);
  }
}

/* ============== RATE LIMITING ============== */

const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_MAP_MAX = 10_000;

function isRateLimited(ip) {
  if (!ip) return false;
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    if (!entry && rateLimitMap.size >= RATE_LIMIT_MAP_MAX) return true;
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) return true;
  return false;
}

let lastCleanup = 0;
function cleanRateLimitMap() {
  const now = Date.now();
  if (now - lastCleanup < 30_000 && rateLimitMap.size < 500) return;
  lastCleanup = now;
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
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://connect.facebook.net https://www.googletagmanager.com https://checkout.razorpay.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https://*.supabase.co https://*.r2.dev https://*.cloudinary.com https://*.unsplash.com https://*.shopify.com https://*.myshopify.com https: ; connect-src 'self' https://*.supabase.co https://connect.facebook.net https://graph.facebook.com https://api.razorpay.com https://lrcpkt0a.api.lc; frame-src https://api.razorpay.com https://checkout.razorpay.com; object-src 'none'; base-uri 'self'; form-action 'self';",
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

function getEarlyCacheKey(hostname, pathname) {
  const cleanPath = pathname.toLowerCase();
  return new Request(`https://edge-html/${hostname.toLowerCase()}${cleanPath}`);
}

function addDiagnosticHeaders(response, { slug, cacheStatus, dataSource }) {
  const res = new Response(response.body, response);
  res.headers.set("X-Worker-Version", WORKER_VERSION);
  if (slug) res.headers.set("X-Store-Slug", slug);
  res.headers.set("X-Cache-Status", cacheStatus);
  if (dataSource) res.headers.set("X-Data-Source", dataSource);
  return res;
}

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

/* ============== DOMAIN RESOLUTION (Cache API → KV → DB) ============== */

const KV_DOMAIN_TTL = 3600;

async function resolveDomain(hostname, env) {
  const domain = hostname.replace(/^www\./, "").toLowerCase().trim();

  const key = new Request(`https://cache/domain-${domain}`);
  try {
    const cached = await cache.match(key);
    if (cached) {
      const data = await cached.json();
      return data.slug || null;
    }
  } catch {}

  if (env?.STORE_KV) {
    try {
      const kvData = await env.STORE_KV.get(`domain:${domain}`, { type: "json" });
      if (kvData) {
        cache.put(
          key,
          new Response(JSON.stringify(kvData), {
            headers: { "Cache-Control": "public, max-age=300" },
          })
        ).catch(() => {});
        return kvData.slug || null;
      }
    } catch {}
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
    const cacheData = JSON.stringify({ slug });

    const writes = [
      cache.put(
        key,
        new Response(cacheData, {
          headers: { "Cache-Control": `public, max-age=${ttl}` },
        })
      ),
    ];
    if (env?.STORE_KV && slug) {
      writes.push(
        env.STORE_KV.put(`domain:${domain}`, cacheData, { expirationTtl: KV_DOMAIN_TTL })
      );
    }
    await Promise.all(writes);

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

/* ============== SPA SHELL CACHE (Cache API → KV → origin) ============== */

const SPA_SHELL_KV_KEY = "spa-shell:v1";
const SPA_SHELL_KV_TTL = 3600;
const SPA_SHELL_CACHE_TTL = 600;

let inflightShellFetch = null;

async function getSpaShell(request, ctx, env) {
  const shellCacheKey = new Request("https://cache/spa-shell");
  try {
    const cached = await cache.match(shellCacheKey);
    if (cached) {
      const html = await cached.text();
      return { html, source: "cache-shell" };
    }
  } catch {}

  if (env?.STORE_KV) {
    try {
      const kvHtml = await env.STORE_KV.get(SPA_SHELL_KV_KEY);
      if (kvHtml) {
        if (ctx) {
          ctx.waitUntil(
            cache.put(
              shellCacheKey,
              new Response(kvHtml, {
                headers: {
                  "Content-Type": "text/html; charset=utf-8",
                  "Cache-Control": `public, max-age=${SPA_SHELL_CACHE_TTL}`,
                },
              })
            ).catch(() => {})
          );
        }
        return { html: kvHtml, source: "kv-shell" };
      }
    } catch {}
  }

  if (inflightShellFetch) {
    try {
      const html = await inflightShellFetch;
      return html ? { html, source: "origin-coalesced" } : null;
    } catch { return null; }
  }

  const fetchPromise = _fetchSpaShellFromOrigin(request, ctx, env, shellCacheKey);
  inflightShellFetch = fetchPromise;

  try {
    const html = await fetchPromise;
    return html ? { html, source: "origin" } : null;
  } catch { return null; }
  finally { inflightShellFetch = null; }
}

async function _fetchSpaShellFromOrigin(request, ctx, env, shellCacheKey) {
  const response = await proxyToOrigin(request);
  const contentType = response.headers.get("content-type") || "";

  if (!response.ok || !contentType.includes("text/html")) return null;

  const html = await response.text();
  if (!html || html.length < 200) return null;

  if (ctx) {
    ctx.waitUntil(
      Promise.all([
        env?.STORE_KV
          ? env.STORE_KV.put(SPA_SHELL_KV_KEY, html, { expirationTtl: SPA_SHELL_KV_TTL })
          : Promise.resolve(),
        cache.put(
          shellCacheKey,
          new Response(html, {
            headers: {
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": `public, max-age=${SPA_SHELL_CACHE_TTL}`,
            },
          })
        ),
      ]).catch(() => {})
    );
  }

  return html;
}


const KV_STOREFRONT_TTL = 3600;
const CACHE_STOREFRONT_TTL = 600;

/* ============== REQUEST COALESCING ============== */
const inflightRequests = new Map();

async function prefetchStorefrontData(slug, ctx, env) {
  const kvKey = `storefront:${slug}`;
  const dataCacheKey = new Request(`https://cache/storefront-data/${slug}`);

  try {
    const cached = await cache.match(dataCacheKey);
    if (cached) {
      const data = await cached.json();
      return { data, source: "cache-api" };
    }
  } catch {}

  if (env?.STORE_KV) {
    try {
      const kvData = await env.STORE_KV.get(kvKey, { type: "json" });
      if (kvData) {
        if (ctx) {
          ctx.waitUntil(
            cache.put(
              dataCacheKey,
              new Response(JSON.stringify(kvData), {
                headers: { "Cache-Control": `public, max-age=${CACHE_STOREFRONT_TTL}` },
              })
            ).catch(() => {})
          );
        }
        return { data: kvData, source: "kv" };
      }
    } catch {}
  }

  if (inflightRequests.has(slug)) {
    try {
      const data = await inflightRequests.get(slug);
      return { data, source: "origin" };
    } catch {
      return { data: null, source: "none" };
    }
  }

  const fetchPromise = _fetchShellFromSupabase(slug, ctx, env);
  inflightRequests.set(slug, fetchPromise);

  try {
    const data = await fetchPromise;
    return { data, source: "origin" };
  } catch {
    return { data: null, source: "none" };
  } finally {
    inflightRequests.delete(slug);
  }
}

async function _fetchShellFromSupabase(slug, ctx, env) {
  const kvKey = `storefront:${slug}`;
  const dataCacheKey = new Request(`https://cache/storefront-data/${slug}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), STOREFRONT_PREFETCH_TIMEOUT_MS);

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/get_storefront_shell`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({ _slug: slug }),
      }
    );
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();

    if (data && ctx) {
      const dataStr = JSON.stringify(data);
      const storeId = data?.store?.id;
      const storeSlug = data?.store?.slug;
      ctx.waitUntil(
        Promise.all([
          env?.STORE_KV
            ? env.STORE_KV.put(kvKey, dataStr, { expirationTtl: KV_STOREFRONT_TTL })
            : Promise.resolve(),
          cache.put(
            dataCacheKey,
            new Response(dataStr, {
              headers: { "Cache-Control": `public, max-age=${CACHE_STOREFRONT_TTL}` },
            })
          ),
          storeId ? _prewarmProducts(storeId, storeSlug, ctx, env) : Promise.resolve(),
        ])
      );
    }

    return data;
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

async function _prewarmProducts(storeId, slug, ctx, env) {
  const domain = slug ? `${slug}.${ROOT_DOMAIN}` : "unknown";
  const cacheKey = _buildProductsCacheKey(domain, {});
  const kvKey = _buildProductsKvKey(domain, {});

  try {
    const existing = await cache.match(cacheKey);
    if (existing) return;
  } catch {}

  try {
    const data = await _fetchProductsFromDb(storeId, {}, PRODUCTS_DB_TIMEOUT_MS);
    const body = JSON.stringify(data || []);
    await Promise.all([
      cache.put(
        cacheKey,
        new Response(body, {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": `public, max-age=${PRODUCTS_CACHE_TTL}`,
          },
        })
      ).catch(() => {}),
      env?.STORE_KV
        ? env.STORE_KV.put(kvKey, body, { expirationTtl: PRODUCTS_KV_TTL }).catch(() => {})
        : Promise.resolve(),
    ]);
  } catch {}
}

/* ============== PRODUCTS API (Cache → DB, KV fallback only) ============== */

const PRODUCTS_CACHE_TTL = 300;
const PRODUCTS_KV_TTL = 1800;
const PRODUCTS_DB_TIMEOUT_MS = 3000;
const PRODUCTS_PAGE_SIZE = 20;
const PRODUCT_COLUMNS = "id,category,cost_price,created_at,currency,description,image_url,is_active,is_best_selling,name,price,sale_price,sku,slug,stock_quantity,store_id,updated_at";

const inflightProductRequests = new Map();
const inflightDomainResolutions = new Map();

const domainStoreIdCache = new Map();

async function _resolveStoreId(domain, env) {
  const memEntry = domainStoreIdCache.get(domain);
  if (memEntry && Date.now() < memEntry.expiresAt) return memEntry.storeId;

  const storeIdCacheKey = new Request(`https://cache/store-id:${domain}`);
  try {
    const cached = await cache.match(storeIdCacheKey);
    if (cached) {
      const storeId = await cached.text();
      domainStoreIdCache.set(domain, { storeId, expiresAt: Date.now() + 300_000 });
      return storeId || null;
    }
  } catch {}

  const kvKey = `store-id:${domain}`;
  if (env?.STORE_KV) {
    try {
      const kvVal = await env.STORE_KV.get(kvKey);
      if (kvVal) {
        domainStoreIdCache.set(domain, { storeId: kvVal, expiresAt: Date.now() + 300_000 });
        cache.put(storeIdCacheKey, new Response(kvVal, {
          headers: { "Cache-Control": "public, max-age=600" },
        })).catch(() => {});
        return kvVal;
      }
    } catch {}
  }

  if (inflightDomainResolutions.has(domain)) {
    try {
      return await inflightDomainResolutions.get(domain);
    } catch {
      return null;
    }
  }

  const resolvePromise = _fetchStoreIdFromDb(domain);
  inflightDomainResolutions.set(domain, resolvePromise);

  try {
    const storeId = await resolvePromise;

    if (storeId) {
      domainStoreIdCache.set(domain, { storeId, expiresAt: Date.now() + 300_000 });
      cache.put(storeIdCacheKey, new Response(storeId, {
        headers: { "Cache-Control": "public, max-age=600" },
      })).catch(() => {});
      if (env?.STORE_KV) {
        env.STORE_KV.put(kvKey, storeId, { expirationTtl: 3600 }).catch(() => {});
      }
    } else {
      domainStoreIdCache.set(domain, { storeId: null, expiresAt: Date.now() + 60_000 });
    }

    return storeId;
  } catch {
    return null;
  } finally {
    inflightDomainResolutions.delete(domain);
  }
}

async function _fetchStoreIdFromDb(domain) {
  const isSubdomain = domain.endsWith(`.${ROOT_DOMAIN}`);
  const query = isSubdomain
    ? `slug=eq.${encodeURIComponent(domain.replace(`.${ROOT_DOMAIN}`, ""))}`
    : `custom_domain=eq.${encodeURIComponent(domain)}`;

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/stores?select=id&${query}&limit=1`,
    { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
  );
  if (!res.ok) return null;
  const rows = await res.json();
  return rows[0]?.id || null;
}

function _buildProductsCacheKey(domain, filters) {
  const parts = [`https://cache/products:${domain}`];
  if (filters.category) parts.push(`category=${filters.category}`);
  if (filters.page) parts.push(`page=${filters.page}`);
  if (filters.sort) parts.push(`sort=${filters.sort}`);
  return new Request(parts.join(":"));
}

function _buildProductsKvKey(domain, filters) {
  let key = `products:${domain}`;
  if (filters.category) key += `:cat=${filters.category}`;
  if (filters.page) key += `:p=${filters.page}`;
  if (filters.sort) key += `:s=${filters.sort}`;
  return key;
}

async function handlePurgeProducts(request, url, ctx, env) {
  const domain = (request.headers.get("host") || url.hostname).toLowerCase().trim();

  const defaultCacheKey = _buildProductsCacheKey(domain, {});
  const defaultKvKey = _buildProductsKvKey(domain, {});

  const purgeOps = [
    cache.delete(defaultCacheKey).catch(() => {}),
  ];

  if (env?.STORE_KV) {
    purgeOps.push(env.STORE_KV.delete(defaultKvKey).catch(() => {}));
  }

  for (const sort of ["price_asc", "price_desc", "newest"]) {
    const ck = _buildProductsCacheKey(domain, { sort });
    purgeOps.push(cache.delete(ck).catch(() => {}));
    if (env?.STORE_KV) {
      purgeOps.push(env.STORE_KV.delete(_buildProductsKvKey(domain, { sort })).catch(() => {}));
    }
  }

  await Promise.all(purgeOps);

  return addCorsHeaders(
    new Response(JSON.stringify({ purged: true, domain }), {
      headers: { "Content-Type": "application/json" },
    }),
    "purge"
  );
}

async function handleProductsApi(request, url, ctx, env) {
  const domain = (request.headers.get("host") || url.hostname).toLowerCase().trim();

  const filters = {
    category: url.searchParams.get("category") || "",
    page: url.searchParams.get("page") || "",
    sort: url.searchParams.get("sort") || "",
  };

  const cacheKey = _buildProductsCacheKey(domain, filters);
  const kvKey = _buildProductsKvKey(domain, filters);

  try {
    const cached = await cache.match(cacheKey);
    if (cached) {
      const revalKey = `products:${domain}:${filters.category}:${filters.page}:${filters.sort}`;
      if (await shouldRevalidateGlobal(revalKey, env)) {
        ctx.waitUntil(_refreshProductsBackground(domain, filters, cacheKey, env));
      }
      return addCorsHeaders(cached, "cache-api");
    }
  } catch {}

  const storeId = await _resolveStoreId(domain, env);
  if (!storeId) {
    return addCorsHeaders(
      new Response("[]", {
        headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60" },
      }),
      "no-store"
    );
  }

  const coalesceKey = `${domain}:${filters.category}:${filters.page}:${filters.sort}`;

  if (inflightProductRequests.has(coalesceKey)) {
    try {
      const data = await inflightProductRequests.get(coalesceKey);
      return buildProductResponse(data, cacheKey, ctx, "origin-coalesced");
    } catch {
      return await _fallbackProducts(domain, cacheKey, kvKey, env);
    }
  }

  const fetchPromise = _fetchProductsWithRetry(storeId, filters);
  inflightProductRequests.set(coalesceKey, fetchPromise);

  try {
    const data = await fetchPromise;
    return buildProductResponse(data, cacheKey, ctx, "origin");
  } catch {
    return await _fallbackProducts(domain, cacheKey, kvKey, env);
  } finally {
    inflightProductRequests.delete(coalesceKey);
  }
}

async function _fetchProductsWithRetry(storeId, filters) {
  try {
    return await _fetchProductsFromDb(storeId, filters, PRODUCTS_DB_TIMEOUT_MS);
  } catch (firstErr) {
    try {
      return await _fetchProductsFromDb(storeId, filters, 2000);
    } catch {
      throw firstErr;
    }
  }
}

async function _fetchProductsFromDb(storeId, filters, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const params = new URLSearchParams({
      select: PRODUCT_COLUMNS,
      store_id: `eq.${storeId}`,
      is_active: "eq.true",
      limit: String(PRODUCTS_PAGE_SIZE),
    });

    if (filters.category) {
      params.set("category", `eq.${filters.category}`);
    }

    const sort = filters.sort || "popular";
    switch (sort) {
      case "price_asc":
        params.set("order", "price.asc,id.asc");
        break;
      case "price_desc":
        params.set("order", "price.desc,id.asc");
        break;
      case "newest":
        params.set("order", "created_at.desc,id.asc");
        break;
      default:
        params.set("order", "is_best_selling.desc,created_at.desc,id.asc");
    }

    const page = parseInt(filters.page, 10);
    if (page > 0) {
      params.set("offset", String(page * PRODUCTS_PAGE_SIZE));
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/products?${params}`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`DB error: ${res.status}`);
    return await res.json();
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

function buildProductResponse(data, cacheKey, ctx, source) {
  const body = JSON.stringify(data || []);
  const response = new Response(body, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=${PRODUCTS_CACHE_TTL}, stale-while-revalidate=${PRODUCTS_KV_TTL}`,
    },
  });

  ctx.waitUntil(
    cache.put(cacheKey, response.clone()).catch(() => {})
  );

  return addCorsHeaders(response, source);
}

async function _refreshProductsBackground(domain, filters, cacheKey, env) {
  try {
    const storeId = await _resolveStoreId(domain, env);
    if (!storeId) return;
    const data = await _fetchProductsFromDb(storeId, filters, PRODUCTS_DB_TIMEOUT_MS);
    const body = JSON.stringify(data || []);

    await cache.put(
      cacheKey,
      new Response(body, {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": `public, max-age=${PRODUCTS_CACHE_TTL}`,
        },
      })
    ).catch(() => {});
  } catch {}
}

async function _fallbackProducts(domain, cacheKey, kvKey, env) {
  try {
    const stale = await cache.match(cacheKey);
    if (stale) return addCorsHeaders(stale, "cache-stale");
  } catch {}

  if (env?.STORE_KV) {
    try {
      const stale = await env.STORE_KV.get(kvKey, { type: "text" });
      if (stale) return addCorsHeaders(
        new Response(stale, {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        }),
        "kv-stale"
      );
    } catch {}

    const defaultKvKey = _buildProductsKvKey(domain, {});
    if (defaultKvKey !== kvKey) {
      try {
        const defaultStale = await env.STORE_KV.get(defaultKvKey, { type: "text" });
        if (defaultStale) return addCorsHeaders(
          new Response(defaultStale, {
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          }),
          "kv-default-stale"
        );
      } catch {}
    }
  }

  const defaultCacheKey = _buildProductsCacheKey(domain, {});
  try {
    const defaultStale = await cache.match(defaultCacheKey);
    if (defaultStale) return addCorsHeaders(defaultStale, "cache-default-stale");
  } catch {}

  return addCorsHeaders(
    new Response("[]", {
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    }),
    "fallback-empty"
  );
}

function addCorsHeaders(response, source) {
  const res = new Response(response.body, response);
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type");
  res.headers.set("X-Products-Source", source || "unknown");
  res.headers.set("X-Worker-Version", WORKER_VERSION);
  return res;
}

/* ============== INJECT DATA INTO HTML (FULL — background/prewarm only) ============== */

/**
 * Full injection — used ONLY during:
 *   1. Background revalidation (ctx.waitUntil)
 *   2. Prewarm endpoint
 * NEVER on the critical response path.
 */
function injectIntoHtml(html, slug, storefrontData, dataSource) {
  let injection = `<script>window.__STORE_SLUG__="${escapeHtml(slug)}";`;
  if (storefrontData) {
    const jsonStr = JSON.stringify(storefrontData).replace(/<\/script/gi, "<\\/script");
    injection += `window.__STOREFRONT_DATA__=${jsonStr};`;
  }
  injection += `</script>
<link rel="preconnect" href="${SUPABASE_URL}" crossorigin />
<link rel="dns-prefetch" href="${SUPABASE_URL}" />
<link rel="preconnect" href="https://soxuyuupzodkufxbbndq.supabase.co/storage" crossorigin />`;

  let inlineThemeCss = "";
  let primaryColor = "#004643";
  let bgColor = "#ffffff";
  let textColor = "#1a1a1a";
  let btnTextColor = "#ffffff";
  let btnRadius = "0.5rem";
  let primaryLight = "#4d8b89";

  if (storefrontData?.theme_config) {
    const tc = storefrontData.theme_config;
    primaryColor = tc.primary_color || "#004643";
    bgColor = tc.background_color || "#ffffff";
    textColor = tc.text_color || "#1a1a1a";
    const r = parseInt(primaryColor.slice(1, 3), 16);
    const g = parseInt(primaryColor.slice(3, 5), 16);
    const b = parseInt(primaryColor.slice(5, 7), 16);
    const lighten = (c) => Math.min(255, Math.round(c + (255 - c) * 0.35));
    primaryLight = `#${lighten(r).toString(16).padStart(2, "0")}${lighten(g).toString(16).padStart(2, "0")}${lighten(b).toString(16).padStart(2, "0")}`;
    btnTextColor = (r * 299 + g * 587 + b * 114) / 1000 > 160 ? "#1a1a1a" : "#ffffff";
    btnRadius = tc.button_style === "pill" ? "9999px" : tc.button_style === "square" ? "0px" : "0.5rem";

    inlineThemeCss += `<style id="edge-theme">:root{`
      + `--storefront-primary:${primaryColor};`
      + `--storefront-primary-light:${primaryLight};`
      + `--storefront-accent:${tc.accent_color || primaryColor};`
      + `--storefront-text:${textColor};`
      + `--storefront-bg:${bgColor};`
      + `--storefront-button-radius:${btnRadius};`
      + `--storefront-btn-text:${btnTextColor};`
      + `}body{background:${bgColor}}</style>\n`;

    const fonts = [tc.heading_font, tc.body_font].filter(Boolean);
    if (fonts.length > 0) {
      const families = fonts.map(f => f.replace(/ /g, "+")).join("&family=");
      inlineThemeCss += `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${families}&display=swap" media="print" onload="this.media='all'" />\n`;
      inlineThemeCss += `<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${families}&display=swap" /></noscript>\n`;
      inlineThemeCss += `<style>:root{--storefront-heading-font:'${fonts[0] || "Inter"}';--storefront-body-font:'${fonts[fonts.length > 1 ? 1 : 0] || "Inter"}'}</style>\n`;
    }
  }

  // Theme-aware skeleton
  const storeName = storefrontData?.store?.name || "";
  const logoUrl = storefrontData?.store?.logo_url || "";
  const skeletonBg = bgColor;
  const skeletonMuted = textColor === "#1a1a1a" ? "#e8e8e8" : "rgba(255,255,255,0.12)";

  let skeleton = `<div id="sf-skel" aria-hidden="true" style="position:fixed;inset:0;min-height:100vh;background:${skeletonBg};font-family:'Inter',sans-serif;z-index:2147483000;pointer-events:none;overflow:hidden">`;
  skeleton += `<nav style="height:56px;background:${skeletonBg};border-bottom:1px solid ${skeletonMuted};display:flex;align-items:center;padding:0 16px;gap:12px">`;
  if (logoUrl) {
    skeleton += `<img src="${escapeHtml(logoUrl)}" alt="" style="height:36px;width:36px;border-radius:8px;object-fit:cover" />`;
  } else {
    skeleton += `<div style="height:36px;width:36px;border-radius:8px;background:${skeletonMuted}"></div>`;
  }
  skeleton += `<div style="font-weight:600;font-size:16px;color:${textColor}">${escapeHtml(storeName)}</div>`;
  skeleton += `<div style="flex:1"></div>`;
  skeleton += `<div style="width:28px;height:28px;border-radius:50%;background:${skeletonMuted}"></div>`;
  skeleton += `</nav>`;
  skeleton += `<div style="padding:12px 16px"><div style="height:40px;border-radius:9999px;background:${skeletonMuted}"></div></div>`;
  const cats = storefrontData?.categories;
  if (cats && cats.length > 0) {
    skeleton += `<div style="padding:0 16px 8px;display:flex;gap:16px;overflow:hidden">`;
    for (let i = 0; i < Math.min(cats.length, 5); i++) {
      const c = cats[i];
      if (c.image_url) {
        skeleton += `<div style="flex-shrink:0;text-align:center"><img src="${escapeHtml(c.image_url)}" alt="" style="width:64px;height:64px;border-radius:50%;object-fit:cover" /><div style="font-size:11px;margin-top:4px;color:${textColor}">${escapeHtml(c.name || "")}</div></div>`;
      } else {
        skeleton += `<div style="flex-shrink:0"><div style="width:64px;height:64px;border-radius:50%;background:${skeletonMuted}"></div><div style="height:10px;width:50px;margin:4px auto 0;border-radius:4px;background:${skeletonMuted}"></div></div>`;
      }
    }
    skeleton += `</div>`;
  }
  skeleton += `<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;padding:16px">`;
  for (let i = 0; i < 4; i++) {
    skeleton += `<div style="border-radius:12px;overflow:hidden;background:${skeletonBg};border:1px solid ${skeletonMuted}">`;
    skeleton += `<div style="width:100%;aspect-ratio:4/5;background:${skeletonMuted}"></div>`;
    skeleton += `<div style="padding:8px"><div style="height:10px;width:60%;border-radius:4px;background:${skeletonMuted};margin-bottom:6px"></div><div style="height:10px;width:40%;border-radius:4px;background:${skeletonMuted}"></div></div>`;
    skeleton += `</div>`;
  }
  skeleton += `</div></div>`;
  skeleton += `<script>(function(){var removed=false;function kill(){if(removed)return;removed=true;var s=document.getElementById('sf-skel');if(s){s.style.opacity='0';s.style.visibility='hidden';s.style.display='none';if(s.remove)s.remove();}}function whenReady(){kill();requestAnimationFrame(kill);setTimeout(kill,120);setTimeout(kill,600);}if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',whenReady,{once:true});}else{whenReady();}window.addEventListener('load',kill,{once:true});var root=document.getElementById('root');if(root){if(root.childElementCount>0){kill();}else{var mo=new MutationObserver(function(){if(root.childElementCount>0){mo.disconnect();kill();}});mo.observe(root,{childList:true});setTimeout(function(){mo.disconnect();kill();},1500);}}</script>`;

  let lcpPreload = "";
  if (storefrontData?.store?.logo_url) {
    lcpPreload += `<link rel="preload" as="image" href="${escapeHtml(storefrontData.store.logo_url)}" />`;
  }

  const cssMatch = html.match(/href="(\/assets\/[^"]+\.css)"/);
  let cssPreload = "";
  if (cssMatch) {
    cssPreload = `<link rel="preload" href="${cssMatch[1]}" as="style" />\n`;
  }

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

  let injectedHtml = html.replace("<head>", `<head>${injection}${inlineThemeCss}${lcpPreload}${cssPreload}${modulePreloads}`);
  injectedHtml = injectedHtml.replace('<div id="root">', `${skeleton}<div id="root">`);

  return { html: injectedHtml, dataSource };
}

/* ============== FAST SHELL INJECT (NON-BLOCKING — critical path) ============== */

/**
 * Lightweight injection for COLD LOAD — zero DB dependency.
 * Only injects: slug, preconnects, CSS preload, modulepreloads, generic skeleton.
 * No storefront data, no theme config, no categories.
 * Client-side React handles all data fetching via Prefetch Bridge.
 *
 * Execution time: <5ms (string operations only, no JSON serialization).
 */
function injectFastShell(html, slug) {
  const injection = `<script>window.__STORE_SLUG__="${escapeHtml(slug)}";</script>
<link rel="preconnect" href="${SUPABASE_URL}" crossorigin />
<link rel="dns-prefetch" href="${SUPABASE_URL}" />
<link rel="preconnect" href="https://soxuyuupzodkufxbbndq.supabase.co/storage" crossorigin />`;

  // Generic skeleton — no theme data, uses neutral colors
  const skeleton = `<div id="sf-skel" aria-hidden="true" style="position:fixed;inset:0;min-height:100vh;background:#fff;font-family:'Inter',sans-serif;z-index:2147483000;pointer-events:none;overflow:hidden"><nav style="height:56px;background:#fff;border-bottom:1px solid #e8e8e8;display:flex;align-items:center;padding:0 16px;gap:12px"><div style="height:36px;width:36px;border-radius:8px;background:#e8e8e8"></div><div style="height:14px;width:80px;border-radius:4px;background:#e8e8e8"></div><div style="flex:1"></div><div style="width:28px;height:28px;border-radius:50%;background:#e8e8e8"></div></nav><div style="padding:12px 16px"><div style="height:40px;border-radius:9999px;background:#e8e8e8"></div></div><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;padding:16px"><div style="border-radius:12px;overflow:hidden;border:1px solid #e8e8e8"><div style="width:100%;aspect-ratio:4/5;background:#e8e8e8"></div><div style="padding:8px"><div style="height:10px;width:60%;border-radius:4px;background:#e8e8e8;margin-bottom:6px"></div><div style="height:10px;width:40%;border-radius:4px;background:#e8e8e8"></div></div></div><div style="border-radius:12px;overflow:hidden;border:1px solid #e8e8e8"><div style="width:100%;aspect-ratio:4/5;background:#e8e8e8"></div><div style="padding:8px"><div style="height:10px;width:60%;border-radius:4px;background:#e8e8e8;margin-bottom:6px"></div><div style="height:10px;width:40%;border-radius:4px;background:#e8e8e8"></div></div></div><div style="border-radius:12px;overflow:hidden;border:1px solid #e8e8e8"><div style="width:100%;aspect-ratio:4/5;background:#e8e8e8"></div><div style="padding:8px"><div style="height:10px;width:60%;border-radius:4px;background:#e8e8e8;margin-bottom:6px"></div><div style="height:10px;width:40%;border-radius:4px;background:#e8e8e8"></div></div></div><div style="border-radius:12px;overflow:hidden;border:1px solid #e8e8e8"><div style="width:100%;aspect-ratio:4/5;background:#e8e8e8"></div><div style="padding:8px"><div style="height:10px;width:60%;border-radius:4px;background:#e8e8e8;margin-bottom:6px"></div><div style="height:10px;width:40%;border-radius:4px;background:#e8e8e8"></div></div></div></div></div><script>(function(){var removed=false;function kill(){if(removed)return;removed=true;var s=document.getElementById('sf-skel');if(s){s.style.opacity='0';s.style.visibility='hidden';s.style.display='none';if(s.remove)s.remove();}}function whenReady(){kill();requestAnimationFrame(kill);setTimeout(kill,120);setTimeout(kill,600);}if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',whenReady,{once:true});}else{whenReady();}window.addEventListener('load',kill,{once:true});var root=document.getElementById('root');if(root){if(root.childElementCount>0){kill();}else{var mo=new MutationObserver(function(){if(root.childElementCount>0){mo.disconnect();kill();}});mo.observe(root,{childList:true});setTimeout(function(){mo.disconnect();kill();},1500);}}})()</script>`;

  // CSS preload
  const cssMatch = html.match(/href="(\/assets\/[^"]+\.css)"/);
  let cssPreload = "";
  if (cssMatch) {
    cssPreload = `<link rel="preload" href="${cssMatch[1]}" as="style" />\n`;
  }

  // Module preloads (skip dashboard chunks)
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

  let injectedHtml = html.replace("<head>", `<head>${injection}${cssPreload}${modulePreloads}`);
  injectedHtml = injectedHtml.replace('<div id="root">', `${skeleton}<div id="root">`);

  return injectedHtml;
}

/* ============== FETCH AND INJECT SLUG INTO HTML (v4.0 — NON-BLOCKING) ============== */

/**
 * v4.0 CORE CHANGE: Non-blocking cold load.
 *
 * On cache MISS:
 *   1. Fetch SPA shell (fast — usually from Cache API)
 *   2. Return HTML immediately with injectFastShell (slug + generic skeleton)
 *   3. ctx.waitUntil: fetch storefront data → build full HTML → warm edge cache
 *
 * Next request hits the warmed edge cache with full data/theme/skeleton.
 */
async function fetchAndInjectSlug(request, slug, ctx, env, hostname, pathname) {
  // Get the SPA shell — this is the ONLY await before response
  const shellResult = await getSpaShell(request, ctx, env);

  if (!shellResult?.html) {
    const response = await proxyToOrigin(request);
    return { response, dataSource: "none" };
  }

  // NON-BLOCKING: Return fast shell immediately
  const fastHtml = injectFastShell(shellResult.html, slug);

  const newHeaders = new Headers();
  newHeaders.set("Content-Type", "text/html; charset=utf-8");
  // Shorter TTL for fast shell — will be replaced by full HTML soon
  newHeaders.set("Cache-Control", "public, max-age=30, stale-while-revalidate=300");
  newHeaders.set("X-Store-Slug", slug);
  newHeaders.set("X-Data-Source", "fast-shell");
  newHeaders.set("X-Shell-Source", shellResult.source);
  newHeaders.set("X-Cache-Timestamp", new Date().toISOString());
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    newHeaders.set(k, v);
  }

  const response = new Response(fastHtml, { status: 200, headers: newHeaders });

  // BACKGROUND: Fetch data and warm the FULL HTML cache for next request
  ctx.waitUntil(_warmFullHtmlInBackground(request, shellResult, slug, ctx, env, hostname, pathname));

  return { response, dataSource: "fast-shell" };
}

/**
 * Background task: fetch storefront data, build full themed HTML,
 * and store in edge cache. Next visitor gets instant HIT with full data.
 */
async function _warmFullHtmlInBackground(request, shellResult, slug, ctx, env, hostname, pathname) {
  try {
    const prefetchResult = await prefetchStorefrontData(slug, ctx, env);
    if (!prefetchResult.data) return;

    const result = injectIntoHtml(shellResult.html, slug, prefetchResult.data, prefetchResult.source);

    const fullHeaders = new Headers();
    fullHeaders.set("Content-Type", "text/html; charset=utf-8");
    fullHeaders.set("Cache-Control", "public, max-age=1200, stale-while-revalidate=3600");
    fullHeaders.set("X-Store-Slug", slug);
    fullHeaders.set("X-Data-Source", prefetchResult.source);
    fullHeaders.set("X-Shell-Source", shellResult.source);
    fullHeaders.set("X-Cache-Timestamp", new Date().toISOString());
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
      fullHeaders.set(k, v);
    }

    const fullResponse = new Response(result.html, { status: 200, headers: fullHeaders });

    // Store in edge cache — this replaces the fast shell for future requests
    if (hostname && pathname) {
      const earlyKey = getEarlyCacheKey(hostname, pathname);
      await cache.put(earlyKey, fullResponse.clone()).catch(() => {});
    }
  } catch {}
}

/* ============== STORE RESPONSE IN EDGE CACHE ============== */

function storeInEdgeCache(ctx, hostname, pathname, slug, response) {
  const earlyKey = getEarlyCacheKey(hostname, pathname);
  ctx.waitUntil(
    cache.put(earlyKey, response.clone()).catch(() => {})
  );
}

/* ============== CACHED FETCH (HARDENED) ============== */

async function cachedFetch(request, slug = "", ctx, isCustomDomain = false, env = {}) {
  const url = new URL(request.url);
  const hostname = request.headers.get("host") || url.hostname;

  if (request.method !== "GET") {
    if (isCustomDomain && slug) {
      const { response, dataSource } = await fetchAndInjectSlug(request, slug, ctx, env, hostname, url.pathname);
      return addDiagnosticHeaders(response, { slug, cacheStatus: "BYPASS", dataSource });
    }
    return addDiagnosticHeaders(await proxyToOrigin(request), { slug, cacheStatus: "BYPASS", dataSource: "none" });
  }

  if (
    url.pathname.startsWith("/admin") ||
    url.pathname.startsWith("/api") ||
    url.pathname.startsWith("/dashboard") ||
    request.headers.get("cookie")?.includes("auth")
  ) {
    if (isCustomDomain && slug) {
      const { response, dataSource } = await fetchAndInjectSlug(request, slug, ctx, env, hostname, url.pathname);
      return addDiagnosticHeaders(response, { slug, cacheStatus: "BYPASS", dataSource });
    }
    return addDiagnosticHeaders(await proxyToOrigin(request), { slug, cacheStatus: "BYPASS", dataSource: "none" });
  }

  let res;
  let dataSource = "none";
  try {
    if (slug) {
      const result = await fetchAndInjectSlug(request, slug, ctx, env, hostname, url.pathname);
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

  const botIp = request.headers.get("cf-connecting-ip") || "unknown";
  const botRlKey = `bot:${botIp}`;
  if (isRateLimited(botRlKey)) return null;

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
    } catch {}
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
    const sitemapKey = new Request(`https://cache/sitemap-${slug}`);
    const cachedSitemap = await cache.match(sitemapKey);
    if (cachedSitemap) return cachedSitemap;

    try {
      const res = await callEdgeFunction("seo-page", {
        slug,
        type: "sitemap",
      });
      if (res.ok) {
        const body = await res.text();
        const response = new Response(body, {
          status: 200,
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600, s-maxage=86400",
          },
        });
        await cache.put(sitemapKey, response.clone());
        return response;
      }
    } catch {}
    return null;
  }

  if (url.pathname === "/robots.txt") {
    const hostname = url.hostname;
    const sitemapUrl = `https://${hostname}/sitemap.xml`;
    const robots = `User-agent: *\nAllow: /\n\nSitemap: ${sitemapUrl}`;
    return new Response(robots, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=86400",
      },
    });
  }

  return null;
}

/* ============== PREWARM ============== */

async function handlePrewarm(request, url, ctx, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return addCorsHeaders(
      new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
      "prewarm-error"
    );
  }

  const slug = body.slug;
  const domain = body.domain;

  if (!slug) {
    return addCorsHeaders(
      new Response(JSON.stringify({ error: "Missing slug" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
      "prewarm-error"
    );
  }

  const results = {};

  try {
    // 1. Warm SPA shell
    const shellResult = await getSpaShell(request, ctx, env);
    results.spaShell = shellResult?.source || "failed";

    // 2. Warm domain mapping
    if (domain) {
      const cleanDomain = domain.replace(/^www\./, "").toLowerCase().trim();
      const domainKey = new Request(`https://cache/domain-${cleanDomain}`);
      const cacheData = JSON.stringify({ slug });

      const writes = [
        cache.put(domainKey, new Response(cacheData, {
          headers: { "Cache-Control": "public, max-age=300" },
        })).catch(() => {}),
      ];
      if (env?.STORE_KV) {
        writes.push(
          env.STORE_KV.put(`domain:${cleanDomain}`, cacheData, { expirationTtl: KV_DOMAIN_TTL }).catch(() => {})
        );
      }
      await Promise.all(writes);
      results.domainMapping = "warmed";
    }

    // 3. Warm store-id mapping
    const subDomain = `${slug}.${ROOT_DOMAIN}`;
    let storeId = null;
    const dataResult = await prefetchStorefrontData(slug, ctx, env);
    storeId = dataResult.data?.store?.id;
    results.storefrontData = dataResult.source;

    if (storeId) {
      const storeIdStr = storeId;
      const idWrites = [
        cache.put(new Request(`https://cache/store-id:${subDomain}`), new Response(storeIdStr, {
          headers: { "Cache-Control": "public, max-age=600" },
        })).catch(() => {}),
      ];
      if (env?.STORE_KV) {
        idWrites.push(env.STORE_KV.put(`store-id:${subDomain}`, storeIdStr, { expirationTtl: 3600 }).catch(() => {}));
      }
      if (domain) {
        const cleanDomain = domain.replace(/^www\./, "").toLowerCase().trim();
        idWrites.push(
          cache.put(new Request(`https://cache/store-id:${cleanDomain}`), new Response(storeIdStr, {
            headers: { "Cache-Control": "public, max-age=600" },
          })).catch(() => {})
        );
        if (env?.STORE_KV) {
          idWrites.push(env.STORE_KV.put(`store-id:${cleanDomain}`, storeIdStr, { expirationTtl: 3600 }).catch(() => {}));
        }
      }
      await Promise.all(idWrites);
    }
    results.storefrontData = dataResult.source;

    // 5. Warm products cache
    if (storeId) {
      try {
        const products = await _fetchProductsFromDb(storeId, {}, PRODUCTS_DB_TIMEOUT_MS);
        const body = JSON.stringify(products || []);
        const cacheOps = [];

        const subCacheKey = _buildProductsCacheKey(subDomain, {});
        const subKvKey = _buildProductsKvKey(subDomain, {});
        cacheOps.push(
          cache.put(subCacheKey, new Response(body, {
            headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${PRODUCTS_CACHE_TTL}` },
          })).catch(() => {})
        );
        if (env?.STORE_KV) {
          cacheOps.push(env.STORE_KV.put(subKvKey, body, { expirationTtl: PRODUCTS_KV_TTL }).catch(() => {}));
        }

        if (domain) {
          const cleanDomain = domain.replace(/^www\./, "").toLowerCase().trim();
          const domCacheKey = _buildProductsCacheKey(cleanDomain, {});
          const domKvKey = _buildProductsKvKey(cleanDomain, {});
          cacheOps.push(
            cache.put(domCacheKey, new Response(body, {
              headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${PRODUCTS_CACHE_TTL}` },
            })).catch(() => {})
          );
          if (env?.STORE_KV) {
            cacheOps.push(env.STORE_KV.put(domKvKey, body, { expirationTtl: PRODUCTS_KV_TTL }).catch(() => {}));
          }
        }

        await Promise.all(cacheOps);
        results.products = "warmed";
      } catch {
        results.products = "failed";
      }
    }

    // 6. Warm full HTML response (early exit cache)
    if (shellResult?.html && dataResult.data) {
      const injected = injectIntoHtml(shellResult.html, slug, dataResult.data, "prewarm");
      const htmlResponse = new Response(injected.html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=1200, stale-while-revalidate=3600",
          "X-Store-Slug": slug,
          "X-Data-Source": "prewarm",
          "X-Shell-Source": shellResult.source,
          ...SECURITY_HEADERS,
        },
      });

      const subEarlyKey = getEarlyCacheKey(`${slug}.${ROOT_DOMAIN}`, "/");
      await cache.put(subEarlyKey, htmlResponse.clone()).catch(() => {});

      if (domain) {
        const cleanDomain = domain.replace(/^www\./, "").toLowerCase().trim();
        const domEarlyKey = getEarlyCacheKey(cleanDomain, "/");
        await cache.put(domEarlyKey, htmlResponse.clone()).catch(() => {});
      }

      results.fullHtml = "warmed";
    } else {
      results.fullHtml = "skipped";
    }

    return addCorsHeaders(
      new Response(JSON.stringify({ success: true, slug, domain: domain || null, results }), {
        headers: { "Content-Type": "application/json" },
      }),
      "prewarm"
    );
  } catch (err) {
    return addCorsHeaders(
      new Response(JSON.stringify({ success: false, error: err?.message || "Unknown error", results }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
      "prewarm-error"
    );
  }
}

/* ============== MAIN HANDLER ============== */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const hostname = (request.headers.get("host") || url.hostname).toLowerCase().trim();

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

    // ─── CLEANUP MAPS ───
    cleanRateLimitMap();
    cleanRevalMap();

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

    // ─── EARLY EDGE CACHE EXIT ───
    const isCacheableRequest =
      request.method === "GET" &&
      !url.pathname.startsWith("/api") &&
      !url.pathname.startsWith("/rest") &&
      !url.pathname.startsWith("/admin") &&
      !url.pathname.startsWith("/dashboard") &&
      url.pathname !== "/sitemap.xml" &&
      url.pathname !== "/robots.txt" &&
      url.pathname !== "/__health" &&
      !request.headers.get("cookie")?.includes("auth");

    const ua = request.headers.get("User-Agent") || "";
    const isBot = BOT_UA_REGEX.test(ua);

    if (isCacheableRequest && !isBot) {
      const earlyKey = getEarlyCacheKey(hostname, url.pathname);
      const earlyHit = await cache.match(earlyKey);

      if (earlyHit) {
        const cachedSlug = earlyHit.headers.get("X-Store-Slug") || "";
        const cachedDataSource = earlyHit.headers.get("X-Data-Source") || "edge";

        const revalKey = `html:${hostname}:${url.pathname}`;
        if (await shouldRevalidateGlobal(revalKey, env)) {
          ctx.waitUntil((async () => {
            try {
              let revalSlug = cachedSlug;
              if (!revalSlug && !hostname.endsWith(`.${ROOT_DOMAIN}`) && hostname !== ROOT_DOMAIN) {
                revalSlug = await resolveDomain(hostname.replace(/^www\./, "").toLowerCase().trim(), env);
              } else if (!revalSlug && hostname.endsWith(`.${ROOT_DOMAIN}`)) {
                revalSlug = hostname.replace(`.${ROOT_DOMAIN}`, "");
              }
              if (revalSlug) {
                // Background revalidation uses FULL injection (with data)
                const [shellResult, prefetchResult] = await Promise.all([
                  getSpaShell(request, ctx, env),
                  prefetchStorefrontData(revalSlug, ctx, env),
                ]);
                if (shellResult?.html && prefetchResult.data) {
                  const result = injectIntoHtml(shellResult.html, revalSlug, prefetchResult.data, prefetchResult.source);
                  const fullHeaders = new Headers();
                  fullHeaders.set("Content-Type", "text/html; charset=utf-8");
                  fullHeaders.set("Cache-Control", "public, max-age=1200, stale-while-revalidate=3600");
                  fullHeaders.set("X-Store-Slug", revalSlug);
                  fullHeaders.set("X-Data-Source", prefetchResult.source);
                  fullHeaders.set("X-Shell-Source", shellResult.source);
                  fullHeaders.set("X-Cache-Timestamp", new Date().toISOString());
                  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
                    fullHeaders.set(k, v);
                  }
                  const fullResponse = new Response(result.html, { status: 200, headers: fullHeaders });
                  storeInEdgeCache(ctx, hostname, url.pathname, revalSlug, fullResponse);
                }
              }
            } catch {}
          })());
        }

        return addDiagnosticHeaders(earlyHit, {
          slug: cachedSlug,
          cacheStatus: "HIT",
          dataSource: cachedDataSource,
        });
      }
    }

    // ─── /api/products → Products API ───
    if (url.pathname === "/api/products" && request.method === "GET") {
      return handleProductsApi(request, url, ctx, env);
    }

    // ─── /api/purge-products ───
    if (url.pathname === "/api/purge-products" && request.method === "POST") {
      return handlePurgeProducts(request, url, ctx, env);
    }

    // ─── /api/purge-shell ───
    if (url.pathname === "/api/purge-shell" && request.method === "POST") {
      let purgeSlug = url.searchParams.get("slug") || "";
      if (!purgeSlug && hostname.endsWith(`.${ROOT_DOMAIN}`)) {
        purgeSlug = hostname.replace(`.${ROOT_DOMAIN}`, "");
      }
      if (!purgeSlug && hostname !== ROOT_DOMAIN && !hostname.endsWith(`.${ROOT_DOMAIN}`)) {
        purgeSlug = await resolveDomain(hostname.replace(/^www\./, "").toLowerCase().trim(), env) || "";
      }

      const purgeOps = [
        cache.delete(new Request("https://cache/spa-shell")).catch(() => {}),
      ];
      if (env?.STORE_KV) {
        purgeOps.push(env.STORE_KV.delete(SPA_SHELL_KV_KEY).catch(() => {}));
      }
      if (purgeSlug) {
        purgeOps.push(
          cache.delete(new Request(`https://cache/storefront-data/${purgeSlug}`)).catch(() => {})
        );
        if (env?.STORE_KV) {
          purgeOps.push(env.STORE_KV.delete(`storefront:${purgeSlug}`).catch(() => {}));
        }
        const edgeKey = getEarlyCacheKey(hostname, "/");
        purgeOps.push(cache.delete(edgeKey).catch(() => {}));
      }
      await Promise.all(purgeOps);
      return addCorsHeaders(
        new Response(JSON.stringify({ purged: true, key: SPA_SHELL_KV_KEY, slug: purgeSlug || null, storefrontDataPurged: !!purgeSlug }), {
          headers: { "Content-Type": "application/json" },
        }),
        "purge-shell"
      );
    }

    // ─── /api/purge-store ───
    if (url.pathname === "/api/purge-store" && request.method === "POST") {
      const purgeSlug = url.searchParams.get("slug") || "";
      if (!purgeSlug) {
        return addCorsHeaders(
          new Response(JSON.stringify({ error: "Missing slug parameter" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }),
          "purge-store-error"
        );
      }

      const purgeOps = [];
      const subDomain = `${purgeSlug}.${ROOT_DOMAIN}`;

      purgeOps.push(
        cache.delete(new Request(`https://cache/storefront-data/${purgeSlug}`)).catch(() => {})
      );
      if (env?.STORE_KV) {
        purgeOps.push(env.STORE_KV.delete(`storefront:${purgeSlug}`).catch(() => {}));
      }

      purgeOps.push(cache.delete(getEarlyCacheKey(subDomain, "/")).catch(() => {}));

      const subCacheKey = _buildProductsCacheKey(subDomain, {});
      purgeOps.push(cache.delete(subCacheKey).catch(() => {}));
      for (const sort of ["price_asc", "price_desc", "newest"]) {
        purgeOps.push(cache.delete(_buildProductsCacheKey(subDomain, { sort })).catch(() => {}));
      }

      const customDomain = await getCustomDomainForSlug(purgeSlug);
      if (customDomain) {
        const cleanDomain = customDomain.replace(/^www\./, "").toLowerCase().trim();
        purgeOps.push(cache.delete(getEarlyCacheKey(cleanDomain, "/")).catch(() => {}));
        const domCacheKey = _buildProductsCacheKey(cleanDomain, {});
        purgeOps.push(cache.delete(domCacheKey).catch(() => {}));
        for (const sort of ["price_asc", "price_desc", "newest"]) {
          purgeOps.push(cache.delete(_buildProductsCacheKey(cleanDomain, { sort })).catch(() => {}));
        }
      }

      purgeOps.push(cache.delete(new Request(`https://cache/store-id:${subDomain}`)).catch(() => {}));

      await Promise.all(purgeOps);

      return addCorsHeaders(
        new Response(JSON.stringify({
          purged: true,
          slug: purgeSlug,
          customDomain: customDomain || null,
          scope: "store-only",
        }), {
          headers: { "Content-Type": "application/json" },
        }),
        "purge-store"
      );
    }

    if (url.pathname === "/api/prewarm" && request.method === "POST") {
      return handlePrewarm(request, url, ctx, env);
    }

    // CORS preflight
    if (url.pathname.startsWith("/api/") && request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400",
        },
      });
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

      // v4.0: Start SEO/bot checks in parallel, but DON'T start main fetch yet
      const [customDomain, seoResponse, botResponse] = await Promise.all([
        getCustomDomainForSlug(slug),
        handleSeoFiles(url, slug),
        handleBot(request, slug, url, false),
      ]);

      if (customDomain) {
        return Response.redirect(
          `https://${customDomain}${url.pathname}${url.search}`,
          301
        );
      }

      if (seoResponse) return seoResponse;
      if (botResponse) return botResponse;

      // v4.0: Non-blocking — returns fast shell immediately
      const { response: injectedResponse, dataSource } = await fetchAndInjectSlug(
        request, slug, ctx, env, hostname, url.pathname
      );

      const contentType = injectedResponse.headers.get("content-type") || "";
      if (injectedResponse.status === 200 && contentType.includes("text/html")) {
        const slugHeader = injectedResponse.headers.get("X-Store-Slug");
        if (slugHeader === slug) {
          // Don't store fast-shell in edge cache with long TTL —
          // the background task will store the full version
          // (storeInEdgeCache already happens in fetchAndInjectSlug for fast shell with short TTL)
        }
      }

      return addDiagnosticHeaders(injectedResponse, {
        slug,
        cacheStatus: "MISS",
        dataSource,
      });
    }

    // ─── CUSTOM DOMAIN ───

    if (hostname.startsWith("www.")) {
      const apex = hostname.slice(4);
      return Response.redirect(
        `https://${apex}${url.pathname}${url.search}`,
        301
      );
    }

    const clientIP = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for");
    if (isRateLimited(clientIP)) {
      return new Response("Too Many Requests", {
        status: 429,
        headers: { "Retry-After": "60", "Content-Type": "text/plain" },
      });
    }

    const cleanDomain = hostname.replace(/^www\./, "").toLowerCase().trim();

    const slug = await resolveDomain(cleanDomain, env);

    if (slug) {
      const [seoResponse, botResponse] = await Promise.all([
        handleSeoFiles(url, slug),
        handleBot(request, slug, url, true),
      ]);

      if (seoResponse) return seoResponse;
      if (botResponse) return botResponse;

      // v4.0: Non-blocking
      const { response: injectedResponse, dataSource } =
        await fetchAndInjectSlug(request, slug, ctx, env, hostname, url.pathname);

      return addDiagnosticHeaders(injectedResponse, {
        slug,
        cacheStatus: "MISS",
        dataSource,
      });
    }

    // ─── UNKNOWN DOMAIN → 404 ───
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
          ...SECURITY_HEADERS,
        },
      }
    );
  },
};
