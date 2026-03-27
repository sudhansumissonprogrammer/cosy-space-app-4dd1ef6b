/**
 * STORIVO PRODUCTION ROUTER v3.2 — PRE-WARM + CACHE-FIRST
 *
 * Changes from v2.6:
 *   - PARALLEL ORIGIN FETCH: For custom domains, origin HTML fetch starts
 *     IMMEDIATELY alongside domain resolution (saves 300-500ms on cold load).
 *   - KV-backed domain resolution: domain→slug cached in KV for global hits
 *     across all colos (eliminates per-colo cold-start penalty).
 *   - Parallelized SEO/bot handling for custom domains.
 *   - New injectIntoHtml() extracted for reuse with pre-fetched origin HTML.
 *
 * Architecture:
 *   User → Edge Cache (Cache API) → Worker processing → KV → Supabase
 *   On HIT: User → Edge Cache → done (~1-5ms)
 *   On MISS: User → Worker → KV/Origin → cache.put → response
 *
 * Cold load custom domain waterfall (BEFORE v2.7):
 *   resolveDomain [300-500ms] → proxyToOrigin + prefetchData [500-800ms] = ~1.0-1.3s worker time
 *
 * Cold load custom domain waterfall (v2.7):
 *   resolveDomain || proxyToOrigin [parallel, ~500ms] → prefetchData [300ms] = ~0.5-0.8s worker time
 *   (prefetchData also parallelized with origin when slug resolves first)
 *
 * Routes:
 *   - *.storivo.in/*
 *   - storivo.in/*
 *   - custom domains (melleto.shop, mgwinner.in, etc.)
 *
 * KV Binding:
 *   - STORE_KV: Cloudflare KV namespace for global storefront data cache
 */

const WORKER_VERSION = "3.2";
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

/* ============== RATE LIMITING ============== */

const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_MAP_MAX = 10_000; // Hard cap to prevent memory exhaustion

function isRateLimited(ip) {
  if (!ip) return false;
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    // If map is at hard cap, reject new IPs (fail-closed under DDoS)
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
  // Clean every 30s OR when map exceeds 500 entries (whichever comes first)
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

/**
 * Build a simple early-exit cache key based on hostname + path only.
 * Used for the top-of-handler cache check before any slug resolution.
 */
function getEarlyCacheKey(hostname, pathname) {
  // Normalize: lowercase path, strip tracking params for cache consistency
  const cleanPath = pathname.toLowerCase();
  return new Request(`https://edge-html/${hostname.toLowerCase()}${cleanPath}`);
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

/* ============== DOMAIN RESOLUTION (KV + Cache API) ============== */

const KV_DOMAIN_TTL = 3600; // 1 hour in KV (global)

async function resolveDomain(hostname, env) {
  const domain = hostname.replace(/^www\./, "").toLowerCase().trim();

  // 1. Try KV first (global, all colos — eliminates per-colo cold starts)
  if (env?.STORE_KV) {
    try {
      const kvData = await env.STORE_KV.get(`domain:${domain}`, { type: "json" });
      if (kvData) return kvData.slug || null;
    } catch {}
  }

  // 2. Try per-colo Cache API
  const key = new Request(`https://cache/domain-${domain}`);
  const cached = await cache.match(key);
  if (cached) {
    const data = await cached.json();
    // Backfill KV if it was a KV miss but cache hit
    if (env?.STORE_KV && data.slug) {
      env.STORE_KV.put(`domain:${domain}`, JSON.stringify(data), { expirationTtl: KV_DOMAIN_TTL }).catch(() => {});
    }
    return data.slug || null;
  }

  // 3. Fetch from Supabase
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

    // Write to both KV (global) and Cache API (per-colo)
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

/* ============== SPA SHELL CACHE (eliminates origin fetch on cold loads) ============== */
// The origin HTML is the SAME Vite-built SPA for ALL stores.
// Only injected data (__STORE_SLUG__, __STOREFRONT_DATA__) differs.
// By caching the raw shell in KV, cold loads drop from ~800-1500ms to ~5ms.

const SPA_SHELL_KV_KEY = "spa-shell:v1";
const SPA_SHELL_KV_TTL = 60;           // 60 seconds in KV
const SPA_SHELL_CACHE_TTL = 60;        // 60 seconds in Cache API (per-colo)

let inflightShellFetch = null; // Coalesce concurrent shell fetches

/**
 * Get the raw SPA HTML shell. Priority: KV → Cache API → origin fetch.
 * Returns { html: string, source: string } or null on total failure.
 */
async function getSpaShell(request, ctx, env) {
  // 1. KV (global, ~5ms)
  if (env?.STORE_KV) {
    try {
      const kvHtml = await env.STORE_KV.get(SPA_SHELL_KV_KEY);
      if (kvHtml) return { html: kvHtml, source: "kv-shell" };
    } catch {}
  }

  // 2. Cache API (per-colo)
  const shellCacheKey = new Request("https://cache/spa-shell");
  try {
    const cached = await cache.match(shellCacheKey);
    if (cached) {
      const html = await cached.text();
      // Backfill KV
      if (env?.STORE_KV && ctx) {
        ctx.waitUntil(
          env.STORE_KV.put(SPA_SHELL_KV_KEY, html, { expirationTtl: SPA_SHELL_KV_TTL }).catch(() => {})
        );
      }
      return { html, source: "cache-shell" };
    }
  } catch {}

  // 3. Origin fetch (coalesced — only 1 concurrent fetch)
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

  // Cache in both KV (global) and Cache API (per-colo)
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


const KV_STOREFRONT_TTL = 1800; // 30 minutes in KV (shell is tiny ~10KB)
const CACHE_STOREFRONT_TTL = 600; // 10 minutes in Cache API (per-colo)

/* ============== REQUEST COALESCING ============== */
// Prevents cache-miss storm: if 100 users hit an uncached store simultaneously,
// only 1 DB call is made. The other 99 await the same promise.
const inflightRequests = new Map();

/**
 * Returns { data, source } where source is "kv" | "cache-api" | "origin" | "none"
 * Uses get_storefront_shell (no products) — payload ~5-15KB, always fits KV.
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

  // 3. Cache miss — use request coalescing to prevent DB storm
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

/**
 * Internal: fetch shell data from Supabase and write to cache layers.
 */
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

    // Products load via /api/products endpoint — NOT injected into shell HTML

    // Write to both KV (global) and Cache API (per-colo) in background
    // ALSO pre-warm first page of products so frontend gets instant cache hit
    if (data && ctx) {
      const dataStr = JSON.stringify(data);
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
          // Pre-warm products cache (ensures /api/products endpoint is also warm)
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

/**
 * Pre-warm: populate product cache by calling the same DB→Cache+KV pipeline.
 * Uses the internal fetch function directly (not HTTP self-call to avoid loops).
 */
async function _prewarmProducts(storeId, slug, ctx, env) {
  const domain = slug ? `${slug}.${ROOT_DOMAIN}` : "unknown";
  // Pre-warm default listing (no category filter)
  const cacheKey = _buildProductsCacheKey(domain, {});
  const kvKey = _buildProductsKvKey(domain, {});

  // Skip if already cached
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
  } catch {
    // Silent — products will be fetched on first user request
  }
}

/* ============== PRODUCTS API (Cache → KV → DB) ============== */

const PRODUCTS_CACHE_TTL = 60;       // Cache API: 60 seconds
const PRODUCTS_KV_TTL = 300;         // KV: 5 minutes
const PRODUCTS_DB_TIMEOUT_MS = 3000; // Hard timeout: 3 seconds (allows 1 retry)
const PRODUCTS_PAGE_SIZE = 20;
const PRODUCT_COLUMNS = "id,category,cost_price,created_at,currency,description,image_url,is_active,is_best_selling,name,price,sale_price,sku,slug,stock_quantity,store_id,updated_at";

// Coalescing maps — prevent duplicate DB calls under traffic spikes
const inflightProductRequests = new Map();
const inflightDomainResolutions = new Map();

/* ── Domain → store_id resolution (coalesced + KV-cached) ── */

const domainStoreIdCache = new Map(); // In-memory per-isolate cache

async function _resolveStoreId(domain, env) {
  // 1. In-memory (same isolate)
  const memEntry = domainStoreIdCache.get(domain);
  if (memEntry && Date.now() < memEntry.expiresAt) return memEntry.storeId;

  // 2. KV
  const kvKey = `store-id:${domain}`;
  if (env?.STORE_KV) {
    try {
      const kvVal = await env.STORE_KV.get(kvKey);
      if (kvVal) {
        domainStoreIdCache.set(domain, { storeId: kvVal, expiresAt: Date.now() + 300_000 });
        return kvVal;
      }
    } catch {}
  }

  // 3. Coalesced DB lookup — only 1 call per domain on miss
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

    // Cache result (even null, for 60s to prevent repeated lookups)
    if (storeId) {
      domainStoreIdCache.set(domain, { storeId, expiresAt: Date.now() + 300_000 });
      if (env?.STORE_KV) {
        env.STORE_KV.put(kvKey, storeId, { expirationTtl: 1800 }).catch(() => {});
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

/* ── Cache key builders (include domain + all query params) ── */

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

/* ── Cache invalidation endpoint ── */

/**
 * POST /api/purge-products
 * Called by dashboard after product create/update/delete.
 * Clears all product cache entries for the store's domain.
 */
async function handlePurgeProducts(request, url, ctx, env) {
  const domain = (request.headers.get("host") || url.hostname).toLowerCase().trim();

  // Purge default listing cache (most common)
  const defaultCacheKey = _buildProductsCacheKey(domain, {});
  const defaultKvKey = _buildProductsKvKey(domain, {});

  const purgeOps = [
    cache.delete(defaultCacheKey).catch(() => {}),
  ];

  if (env?.STORE_KV) {
    purgeOps.push(env.STORE_KV.delete(defaultKvKey).catch(() => {}));
  }

  // Also purge known sort variants
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

/**
 * GET /api/products?category=X&page=N&sort=Y
 *
 * Domain extracted from Host header (NEVER from client params).
 * store_id resolved internally via domain→store_id mapping (coalesced).
 *
 * Flow: Cache API → KV → domain→store_id (coalesced) → DB (coalesced + 3s timeout + retry)
 * Stale-while-revalidate: returns cached data immediately, refreshes in background.
 * Fallback: if DB fails or times out, returns last known good cached data.
 */
async function handleProductsApi(request, url, ctx, env) {
  // ── SECURITY: domain from Host header only ──
  const domain = (request.headers.get("host") || url.hostname).toLowerCase().trim();

  // Extract optional filters from query params
  const filters = {
    category: url.searchParams.get("category") || "",
    page: url.searchParams.get("page") || "",
    sort: url.searchParams.get("sort") || "",
  };

  const cacheKey = _buildProductsCacheKey(domain, filters);
  const kvKey = _buildProductsKvKey(domain, filters);

  // ── 1. Cache API (per-colo, ~0ms) ──
  try {
    const cached = await cache.match(cacheKey);
    if (cached) {
      // Stale-while-revalidate: return immediately, refresh in background
      ctx.waitUntil(_refreshProductsBackground(domain, filters, cacheKey, kvKey, env));
      return addCorsHeaders(cached, "cache-api");
    }
  } catch {}

  // ── 2. KV (global, ~5ms) ──
  if (env?.STORE_KV) {
    try {
      const kvData = await env.STORE_KV.get(kvKey, { type: "text" });
      if (kvData) {
        const kvResponse = new Response(kvData, {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": `public, max-age=${PRODUCTS_CACHE_TTL}`,
          },
        });
        ctx.waitUntil(
          Promise.all([
            cache.put(cacheKey, kvResponse.clone()),
            _refreshProductsBackground(domain, filters, cacheKey, kvKey, env),
          ])
        );
        return addCorsHeaders(kvResponse, "kv");
      }
    } catch {}
  }

  // ── 3. Resolve domain → store_id (coalesced) ──
  const storeId = await _resolveStoreId(domain, env);
  if (!storeId) {
    return addCorsHeaders(
      new Response("[]", {
        headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60" },
      }),
      "no-store"
    );
  }

  // ── 4. Full cache miss — fetch from DB with request coalescing ──
  const coalesceKey = `${domain}:${filters.category}:${filters.page}:${filters.sort}`;

  if (inflightProductRequests.has(coalesceKey)) {
    try {
      const data = await inflightProductRequests.get(coalesceKey);
      return buildProductResponse(data, cacheKey, kvKey, ctx, env, "origin-coalesced");
    } catch {
      return await _fallbackProducts(domain, cacheKey, kvKey, env);
    }
  }

  const fetchPromise = _fetchProductsWithRetry(storeId, filters);
  inflightProductRequests.set(coalesceKey, fetchPromise);

  try {
    const data = await fetchPromise;
    return buildProductResponse(data, cacheKey, kvKey, ctx, env, "origin");
  } catch {
    return await _fallbackProducts(domain, cacheKey, kvKey, env);
  } finally {
    inflightProductRequests.delete(coalesceKey);
  }
}

/**
 * Fetch with 1 automatic retry. Total budget: 3s first try + 2s retry = 5s max.
 * Retry only on timeout/network errors, NOT on 4xx.
 */
async function _fetchProductsWithRetry(storeId, filters) {
  try {
    return await _fetchProductsFromDb(storeId, filters, PRODUCTS_DB_TIMEOUT_MS);
  } catch (firstErr) {
    // Retry once with shorter timeout
    try {
      return await _fetchProductsFromDb(storeId, filters, 2000);
    } catch {
      throw firstErr; // Throw original error for fallback handling
    }
  }
}

/**
 * Fetch products from Supabase REST API with configurable timeout.
 */
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

/**
 * Build a JSON response and store in Cache + KV in background.
 */
function buildProductResponse(data, cacheKey, kvKey, ctx, env, source) {
  const body = JSON.stringify(data || []);
  const response = new Response(body, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=${PRODUCTS_CACHE_TTL}, stale-while-revalidate=${PRODUCTS_KV_TTL}`,
    },
  });

  ctx.waitUntil(
    Promise.all([
      cache.put(cacheKey, response.clone()).catch(() => {}),
      env?.STORE_KV
        ? env.STORE_KV.put(kvKey, body, { expirationTtl: PRODUCTS_KV_TTL }).catch(() => {})
        : Promise.resolve(),
    ])
  );

  return addCorsHeaders(response, source);
}

/**
 * Background refresh: resolve store_id, fetch from DB, update Cache + KV.
 * Silent — never throws.
 */
async function _refreshProductsBackground(domain, filters, cacheKey, kvKey, env) {
  try {
    const storeId = await _resolveStoreId(domain, env);
    if (!storeId) return;
    const data = await _fetchProductsFromDb(storeId, filters, PRODUCTS_DB_TIMEOUT_MS);
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
  } catch {
    // Silent — stale data continues to serve
  }
}

/**
 * Fallback chain (STRICT ORDER):
 *   1. Stale Cache API (any variant for this domain)
 *   2. Stale KV (exact key)
 *   3. Stale KV (default listing for domain — better than empty)
 *   4. Empty array ONLY as absolute last resort
 *
 * NEVER returns an error. NEVER breaks UI.
 */
async function _fallbackProducts(domain, cacheKey, kvKey, env) {
  // 1. Try stale Cache (exact match)
  try {
    const stale = await cache.match(cacheKey);
    if (stale) return addCorsHeaders(stale, "cache-stale");
  } catch {}

  // 2. Try stale KV (exact match)
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

    // 3. Try stale KV default listing (better to show SOME products than none)
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

  // 4. Try stale Cache default listing
  const defaultCacheKey = _buildProductsCacheKey(domain, {});
  try {
    const defaultStale = await cache.match(defaultCacheKey);
    if (defaultStale) return addCorsHeaders(defaultStale, "cache-default-stale");
  } catch {}

  // 5. Absolute last resort — truly nothing cached
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

/* ============== INJECT DATA INTO HTML ============== */

/**
 * Pure function: takes origin HTML string + slug + storefront data,
 * returns { html, dataSource } with all injections applied.
 * Extracted from fetchAndInjectSlug for reuse with pre-fetched origin HTML.
 */
function injectIntoHtml(html, slug, storefrontData, dataSource) {
  let injection = `<script>window.__STORE_SLUG__="${escapeHtml(slug)}";`;
  if (storefrontData) {
    const jsonStr = JSON.stringify(storefrontData).replace(/<\/script/gi, "<\\/script");
    injection += `window.__STOREFRONT_DATA__=${jsonStr};`;
  }
  injection += `</script>
<link rel="preconnect" href="${SUPABASE_URL}" crossorigin />
<link rel="dns-prefetch" href="${SUPABASE_URL}" />`;

  // Track preconnected origins to avoid duplicates
  const preconnectedOrigins = new Set();
  try { preconnectedOrigins.add(new URL(SUPABASE_URL).origin); } catch {}

  let lcpPreload = "";
  if (storefrontData) {
    const store = storefrontData.store;
    if (store) {
      // Preload logo for fast navbar render
      if (store.logo_url) {
        lcpPreload += `<link rel="preload" as="image" href="${escapeHtml(store.logo_url)}" />`;
      }
    }
  }

  // CSS preload — discover Vite's generated CSS bundle for parallel fetch
  const cssMatch = html.match(/href="(\/assets\/[^"]+\.css)"/);
  let cssPreload = "";
  if (cssMatch) {
    cssPreload = `<link rel="preload" href="${cssMatch[1]}" as="style" />\n`;
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

  // ── HYBRID RENDERING: Inject first 2 product cards into skeleton HTML ──
  let hybridHtml = html;
  const initialProducts = storefrontData?._initialProducts;
  if (Array.isArray(initialProducts) && initialProducts.length > 0) {
    const currency = storefrontData?.store?.currency || "₹";
    let cardsHtml = "";
    for (let ci = 0; ci < Math.min(2, initialProducts.length); ci++) {
      const pr = initialProducts[ci];
      let imgUrl = pr.image_url;
      if (imgUrl && imgUrl.includes(",")) imgUrl = imgUrl.split(",")[0].trim();
      let optImg = "";
      if (imgUrl) {
        optImg = imgUrl;
        if (imgUrl.includes("supabase.co/storage")) {
          optImg = imgUrl.replace("/storage/v1/object/", "/storage/v1/render/image/");
          optImg += (optImg.includes("?") ? "&" : "?") + "width=400&quality=75";
        } else if (imgUrl.includes("cdn.shopify.com") || imgUrl.includes("cdn/shop/")) {
          try {
            const u = new URL(optImg);
            u.searchParams.set("width", "400");
            u.searchParams.set("format", "webp");
            optImg = u.toString();
          } catch {}
        }
      }
      const displayPrice = pr.sale_price || pr.price;
      const safeName = escapeHtml(pr.name || "");
      cardsHtml += `<div class="sf-skel-card" style="background:#fff;border:1px solid #eee">`;
      if (optImg) {
        cardsHtml += `<img src="${escapeHtml(optImg)}" alt="${safeName}" style="width:100%;aspect-ratio:4/5;object-fit:cover;display:block" loading="eager" fetchpriority="${ci === 0 ? "high" : "auto"}" width="400" height="500">`;
      } else {
        cardsHtml += `<div class="sf-skel-card-img" style="background:#f5f5f5"></div>`;
      }
      cardsHtml += `<div style="padding:8px 10px"><div style="font-size:11px;font-weight:700;color:#333;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${safeName}</div>`;
      cardsHtml += `<div style="font-size:13px;font-weight:800;color:#111;margin-top:4px">${escapeHtml(currency)}${Math.round(displayPrice)}</div></div></div>`;
    }

    // Inject hybrid cards by replacing first 2 skeleton cards in the grid
    // The skeleton grid has 4 cards — replace the first 2 with real product data
    const skelCardRegex = /<div class="sf-skel-card">[\s\S]*?<\/div><\/div><\/div>/;
    // Simpler: inject cards + a script that replaces skeleton cards on DOM ready
    const hybridScript = `<script>(function(){var g=document.querySelector('.sf-skel-grid');if(!g)return;var cards=g.querySelectorAll('.sf-skel-card');for(var i=0;i<Math.min(2,cards.length);i++)cards[i].remove();g.insertAdjacentHTML('afterbegin','${cardsHtml.replace(/'/g, "\\'")}');})()</script>`;
    injection += hybridScript;
  }

  // ── KEY: Inject data BEFORE <head> content so it's available before inline scripts
  const injectedHtml = hybridHtml.replace("<head>", `<head>${injection}${lcpPreload}${cssPreload}${modulePreloads}`);

  return { html: injectedHtml, dataSource };
}

/* ============== FETCH AND INJECT SLUG INTO HTML ============== */

/**
 * v3.1: Uses cached SPA shell instead of fetching origin every time.
 * Returns { response, dataSource }
 */
async function fetchAndInjectSlug(request, slug, ctx, env) {
  // Parallel: get cached SPA shell + storefront data
  const [shellResult, prefetchResult] = await Promise.all([
    getSpaShell(request, ctx, env),
    prefetchStorefrontData(slug, ctx, env),
  ]);

  if (!shellResult?.html) {
    // Total shell failure — fall back to direct origin proxy
    const response = await proxyToOrigin(request);
    return { response, dataSource: "none" };
  }

  const storefrontData = prefetchResult.data;
  const dataSource = prefetchResult.source;

  const result = injectIntoHtml(shellResult.html, slug, storefrontData, dataSource);

  const newHeaders = new Headers();
  newHeaders.set("Content-Type", "text/html; charset=utf-8");
  newHeaders.set("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
  newHeaders.set("X-Store-Slug", slug);
  newHeaders.set("X-Data-Source", dataSource);
  newHeaders.set("X-Shell-Source", shellResult.source);
  newHeaders.set("X-Cache-Timestamp", new Date().toISOString());
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    newHeaders.set(k, v);
  }

  return {
    response: new Response(result.html, { status: 200, headers: newHeaders }),
    dataSource,
  };
}

/* ============== STORE RESPONSE IN EDGE CACHE ============== */

/**
 * Write the fully-formed HTML response to Cache API under the early-exit key.
 * On next request, the main handler returns this instantly before any processing.
 */
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

  // Rate limit bot requests per IP to prevent UA-spoofing abuse
  const botIp = request.headers.get("cf-connecting-ip") || "unknown";
  const botRlKey = `bot:${botIp}`;
  if (isRateLimited(botRlKey)) return null; // silently fall through to cached HTML

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

/* ============== PRE-WARM ALL CACHES ============== */

/**
 * POST /api/prewarm
 * Body: { slug: "store-slug", domain?: "custom-domain.com" }
 * OR query params: ?slug=store-slug&domain=custom-domain.com
 *
 * Warms: domain→slug KV, store_id KV, SPA shell, storefront data, products, full HTML.
 * Called automatically on: store creation, custom domain connect, deployment.
 * Result: first real user gets instant cache HIT — NEVER hits DB.
 */
async function handlePrewarm(request, url, ctx, env) {
  let slug, domain;

  try {
    if (request.headers.get("content-type")?.includes("application/json")) {
      const body = await request.json();
      slug = body.slug;
      domain = body.domain;
    }
  } catch {}

  slug = slug || url.searchParams.get("slug");
  domain = domain || url.searchParams.get("domain");

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
    // 1. Warm domain→slug mapping in KV
    if (domain && env?.STORE_KV) {
      const cleanDomain = domain.replace(/^www\./, "").toLowerCase().trim();
      await env.STORE_KV.put(
        `domain:${cleanDomain}`,
        JSON.stringify({ slug }),
        { expirationTtl: KV_DOMAIN_TTL }
      );
      results.domainMapping = "warmed";
    }

    // 2. Warm store_id mapping
    const subDomain = `${slug}.${ROOT_DOMAIN}`;
    const storeId = await _resolveStoreId(domain || subDomain, env);
    results.storeId = storeId ? "resolved" : "not-found";

    // 3. Warm SPA shell
    const fakeRequest = new Request(`https://${subDomain}/`, {
      headers: { Host: subDomain },
    });
    const shellResult = await getSpaShell(fakeRequest, ctx, env);
    results.shell = shellResult ? shellResult.source : "failed";

    // 4. Warm storefront data
    const dataResult = await prefetchStorefrontData(slug, ctx, env);
    results.storefrontData = dataResult.source;

    // 5. Warm products cache
    if (storeId) {
      try {
        const products = await _fetchProductsFromDb(storeId, {}, PRODUCTS_DB_TIMEOUT_MS);
        const body = JSON.stringify(products || []);
        const cacheOps = [];

        // Cache for subdomain
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

        // Also cache for custom domain
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
          "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
          "X-Store-Slug": slug,
          "X-Data-Source": "prewarm",
          "X-Shell-Source": shellResult.source,
          ...SECURITY_HEADERS,
        },
      });

      const subEarlyKey = getEarlyCacheKey(subDomain, "/");
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
    // SECURITY: Never trust x-forwarded-host — it can be spoofed to poison cache.
    // In Cloudflare Workers, Host header is set by CF edge and is trustworthy.
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

    // ─── EARLY EDGE CACHE EXIT ───
    // Check Cache API BEFORE any slug resolution, bot detection, or origin fetch.
    // On HIT: return instantly (~1-5ms), zero processing overhead.
    // Skipped for: bots, non-GET, API routes, admin/dashboard, auth cookies.
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

        // Background revalidation: refresh cache without blocking response
        ctx.waitUntil((async () => {
          try {
            // Determine slug for revalidation
            let revalSlug = cachedSlug;
            if (!revalSlug && !hostname.endsWith(`.${ROOT_DOMAIN}`) && hostname !== ROOT_DOMAIN) {
              revalSlug = await resolveDomain(hostname.replace(/^www\./, "").toLowerCase().trim(), env);
            } else if (!revalSlug && hostname.endsWith(`.${ROOT_DOMAIN}`)) {
              revalSlug = hostname.replace(`.${ROOT_DOMAIN}`, "");
            }
            if (revalSlug) {
              const result = await fetchAndInjectSlug(request, revalSlug, ctx, env);
              if (result.response.ok) {
                storeInEdgeCache(ctx, hostname, url.pathname, revalSlug, result.response);
              }
            }
          } catch {}
        })());

        return addDiagnosticHeaders(earlyHit, {
          slug: cachedSlug,
          cacheStatus: "HIT",
          dataSource: cachedDataSource,
        });
      }
    }

    // ─── /api/products → Products API (Cache → KV → DB) ───
    if (url.pathname === "/api/products" && request.method === "GET") {
      return handleProductsApi(request, url, ctx, env);
    }

    // ─── /api/purge-products → Cache invalidation ───
    if (url.pathname === "/api/purge-products" && request.method === "POST") {
      return handlePurgeProducts(request, url, ctx, env);
    }

    // ─── /api/purge-shell → Force SPA shell refresh (call after publish) ───
    if (url.pathname === "/api/purge-shell" && request.method === "POST") {
      const purgeOps = [
        cache.delete(new Request("https://cache/spa-shell")).catch(() => {}),
      ];
      if (env?.STORE_KV) {
        purgeOps.push(env.STORE_KV.delete(SPA_SHELL_KV_KEY).catch(() => {}));
      }
      await Promise.all(purgeOps);
      return addCorsHeaders(
        new Response(JSON.stringify({ purged: true, key: SPA_SHELL_KV_KEY }), {
          headers: { "Content-Type": "application/json" },
        }),
        "purge-shell"
      );
    }

    // ─── /api/prewarm → Pre-warm all caches for a store (call on store create, domain connect, deploy) ───
    if (url.pathname === "/api/prewarm" && request.method === "POST") {
      return handlePrewarm(request, url, ctx, env);
    }

    // CORS preflight for /api/*
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

      // Start the main fetch IMMEDIATELY — don't wait for custom domain check.
      // Custom domain redirect + SEO + bot all run in parallel with the main fetch.
      const mainFetchPromise = fetchAndInjectSlug(request, slug, ctx, env);

      // Parallelize: custom domain check + SEO files + bot detection
      const [customDomain, seoResponse, botResponse] = await Promise.all([
        getCustomDomainForSlug(slug),
        handleSeoFiles(url, slug),
        handleBot(request, slug, url, false),
      ]);

      // 301 redirect to custom domain if one exists
      if (customDomain) {
        // Discard the main fetch (it ran in background, won't be used)
        mainFetchPromise.catch(() => {});
        return Response.redirect(
          `https://${customDomain}${url.pathname}${url.search}`,
          301
        );
      }

      if (seoResponse) {
        mainFetchPromise.catch(() => {});
        return seoResponse;
      }
      if (botResponse) {
        mainFetchPromise.catch(() => {});
        return botResponse;
      }

      // Main fetch already started — just await it
      const { response: injectedResponse, dataSource } = await mainFetchPromise;

      // Cache for early exit on next request
      const contentType = injectedResponse.headers.get("content-type") || "";
      if (injectedResponse.status === 200 && contentType.includes("text/html")) {
        const slugHeader = injectedResponse.headers.get("X-Store-Slug");
        if (slugHeader === slug) {
          storeInEdgeCache(ctx, hostname, url.pathname, slug, injectedResponse);
        }
      }

      return addDiagnosticHeaders(injectedResponse, {
        slug,
        cacheStatus: "MISS",
        dataSource,
      });
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

    // ─── v3.1: SPA SHELL CACHING — ELIMINATES ORIGIN FETCH ───
    // The SPA shell is cached in KV (~5ms read) instead of fetching from origin (~800ms).
    // Domain resolution also uses KV. Total cold load: ~300ms worker time.
    const cleanDomain = hostname.replace(/^www\./, "").toLowerCase().trim();

    const slug = await resolveDomain(cleanDomain, env);

    if (slug) {
      // Check SEO/bot in parallel (these are fast — usually return null)
      const [seoResponse, botResponse] = await Promise.all([
        handleSeoFiles(url, slug),
        handleBot(request, slug, url, true),
      ]);

      if (seoResponse) return seoResponse;
      if (botResponse) return botResponse;

      // fetchAndInjectSlug now uses cached SPA shell (KV ~5ms) + storefront data in parallel
      const { response: injectedResponse, dataSource } =
        await fetchAndInjectSlug(request, slug, ctx, env);

      // Cache the fully-formed response for early exit on next request
      const contentType = injectedResponse.headers.get("content-type") || "";
      if (injectedResponse.status === 200 && contentType.includes("text/html")) {
        const slugHeader = injectedResponse.headers.get("X-Store-Slug");
        if (slugHeader === slug) {
          storeInEdgeCache(ctx, hostname, url.pathname, slug, injectedResponse);
        }
      }

      return addDiagnosticHeaders(injectedResponse, {
        slug,
        cacheStatus: "MISS",
        dataSource,
      });
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
          ...SECURITY_HEADERS,
        },
      }
    );
  },
};
