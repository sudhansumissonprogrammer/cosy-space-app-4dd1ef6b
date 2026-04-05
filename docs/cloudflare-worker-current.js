/**
 * STORIVO PRODUCTION ROUTER v4.9.0 — FULL PARALLEL + STREAMING
 *
 * Changes from v4.8.1:
 *   1. Full parallel critical path: shell + storeInfo + theme + prebuiltHead + products all concurrent
 *   2. _getInlineProductsOrNull: products fetched in parallel on critical path (Cache → KV)
 *   3. _getCachedPrebuiltHead: cache-only lookup (no build) for streaming head phase
 *   4. prefetchStorefrontDataWithDeadline: races DB fetch vs 1.2s deadline — fast fail on cold
 *   5. serveStreamedHtml: flushes <head> immediately → browser loads assets while body builds
 *   6. _buildLinkPreloadHeader: Link rel=preload on every HTML response
 *   7. Subdomain handler: full Promise.all → stream head → fetch storefront → stream body
 *   8. Custom domain handler: same parallel + streaming pattern
 *   9. fetchAndInjectSlug: injects full storefront data when available within deadline
 *  10. STOREFRONT_PREFETCH_TIMEOUT_MS reduced 2500 → 1200ms
 *  11. Eliminates client-side Supabase data fetch when storefront is warm in KV (~700ms saved)
 */

const WORKER_VERSION = "4.9.0";
const ROOT_DOMAIN = "storivo.in";
const ORIGIN_HOST = "dear-console.lovable.app";

const SUPABASE_URL = "https://dqepeywgftbpxeeqfuwt.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxZXBleXdnZnRicHhlZXFmdXd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMjgxMzksImV4cCI6MjA5MDkwNDEzOX0.OtLtoGBJZuEthQyePzNgAltWJwSUEpWl1z_Bx_FY6Mk";

/* ============== BOT DETECTION ============== */

const SEARCH_BOT_REGEX =
  /Googlebot|Bingbot|DuckDuckBot|YandexBot|Baiduspider|Applebot|Sogou|Exabot|ia_archiver|AhrefsBot|MJ12bot|SemrushBot|PetalBot/i;

const SOCIAL_BOT_REGEX =
  /facebookexternalhit|Facebot|WhatsApp|Twitterbot|TelegramBot|LinkedInBot|Slackbot|Discordbot|Pinterest|Snapchat/i;

const INSTAGRAM_CRAWLER_REGEX = /Instagram(?!.*Mozilla\/5\.0.*AppleWebKit)/i;

const BOT_UA_REGEX =
  /bot|crawler|spider|facebookexternalhit|Facebot|WhatsApp|Twitterbot|TelegramBot|LinkedInBot|Slackbot|Discordbot|Pinterest|Googlebot|Bingbot|YandexBot|Snapchat|Applebot|DuckDuckBot|Baiduspider|Sogou|Exabot|ia_archiver|AhrefsBot|MJ12bot|SemrushBot|PetalBot|curl|wget|HeadlessChrome/i;

function isSocialInAppBrowser(ua) {
  return /Instagram|Snapchat/i.test(ua) && /Mozilla\/5\.0.*AppleWebKit/i.test(ua);
}

const ORIGIN_TIMEOUT_MS = 8_000;
const EDGE_FN_TIMEOUT_MS = 10_000;
// v4.9: Reduced from 2500 → 1200ms. If warm in KV it's <50ms anyway.
// On cold DB fetch we fail fast and return fast-shell; background warm populates KV.
const STOREFRONT_PREFETCH_TIMEOUT_MS = 1_200;

const cache = caches.default;

/* ============== REVALIDATION COOLDOWN ============== */

const revalCooldowns = new Map();
const REVAL_COOLDOWN_MS = 120_000;
const REVAL_MAP_MAX = 5_000;

function shouldRevalidate(key) {
  const now = Date.now();
  const lastReval = revalCooldowns.get(key) || 0;
  if (now - lastReval < REVAL_COOLDOWN_MS) return false;
  if (!revalCooldowns.has(key) && revalCooldowns.size >= REVAL_MAP_MAX) return false;
  revalCooldowns.set(key, now);
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
const RATE_LIMIT_MAX_HTML = 300;
const RATE_LIMIT_MAX_API = 60;
const RATE_LIMIT_MAP_MAX = 10_000;

function isRateLimited(ip, isApi = false) {
  if (!ip) return false;
  const limit = isApi ? RATE_LIMIT_MAX_API : RATE_LIMIT_MAX_HTML;
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    if (!entry && rateLimitMap.size >= RATE_LIMIT_MAP_MAX) return true;
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count++;
  if (entry.count > limit) return true;
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
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(self)",
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
  ["fbclid", "gclid", "utm_source", "utm_medium", "utm_campaign"].forEach((p) => url.searchParams.delete(p));
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
function getSkeletonCleanupScript(fallbackMs = 12000) {
  return `<script>(function(){
    var removed = false;

    function kill(){
      if(removed) return;
      var s = document.getElementById('sf-skel');
      if(!s) return;
      removed = true;
      s.style.transition = 'opacity 180ms ease-out';
      s.style.opacity = '0';
      setTimeout(function(){
        s.style.visibility = 'hidden';
        s.style.display = 'none';
        if(s.remove) s.remove();
      }, 200);
    }

    // ✅ ONLY remove when storefront fully ready
    window.addEventListener('storefront:mounted', kill, { once: true });

    // ⛑️ fallback (if something breaks)
    setTimeout(kill, ${fallbackMs});

  })()</script>`;
}

/* ============== SHARED SKELETON & THEME BUILDERS ============== */
function buildSkeleton(bgColor, skeletonMuted) {
  // v4.9.1: Always use white skeleton regardless of theme color.
  // White-theme stores were showing blank because bgColor=#ffffff matched
  // the page background, making the skeleton invisible.
  // Product card placeholders use a shimmer animation so users see
  // "something loading" even on first paint.

  const skelBg = "#ffffff";
  const skelBase = "#f0f0f0"; // card background
  const skelShimmer = "#e0e0e0"; // shimmer highlight

  const shimmerKeyframes = `
    <style id="sf-skel-anim">
      @keyframes sf-shimmer {
        0%   { background-position: -400px 0; }
        100% { background-position:  400px 0; }
      }
      .sf-ph {
        background: linear-gradient(90deg, ${skelBase} 25%, ${skelShimmer} 50%, ${skelBase} 75%);
        background-size: 800px 100%;
        animation: sf-shimmer 1.4s ease-in-out infinite;
        border-radius: 4px;
      }
    </style>`;

  let skeleton = `${shimmerKeyframes}<div id="sf-skel" aria-hidden="true" style="position:fixed;inset:0;min-height:100vh;background:${skelBg};z-index:2147483000;pointer-events:none;overflow:hidden">`;

  // Nav bar placeholder
  skeleton += `<nav style="height:56px;background:#fff;border-bottom:1px solid #ececec;display:flex;align-items:center;padding:0 16px;gap:12px;box-shadow:0 1px 3px rgba(0,0,0,0.06)">`;
  skeleton += `<div class="sf-ph" style="height:32px;width:32px;border-radius:8px;flex-shrink:0"></div>`;
  skeleton += `<div class="sf-ph" style="height:12px;width:80px"></div>`;
  skeleton += `<div style="flex:1"></div>`;
  skeleton += `<div class="sf-ph" style="width:28px;height:28px;border-radius:50%"></div>`;
  skeleton += `</nav>`;

  // Optional banner strip
  skeleton += `<div class="sf-ph" style="height:6px;width:100%;border-radius:0;margin-bottom:16px"></div>`;

  // Product grid — 2 columns, 4 cards
  skeleton += `<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;padding:0 12px">`;
  for (let i = 0; i < 4; i++) {
    skeleton += `<div style="border-radius:12px;overflow:hidden;background:#fff;border:1px solid #ececec;box-shadow:0 1px 4px rgba(0,0,0,0.05)">`;
    // Image area
    skeleton += `<div class="sf-ph" style="width:100%;aspect-ratio:4/5;border-radius:0"></div>`;
    // Text lines
    skeleton += `<div style="padding:10px 10px 12px">`;
    skeleton += `<div class="sf-ph" style="height:11px;width:75%;margin-bottom:8px"></div>`;
    skeleton += `<div class="sf-ph" style="height:11px;width:45%;margin-bottom:10px"></div>`;
    skeleton += `<div class="sf-ph" style="height:28px;width:100%;border-radius:6px"></div>`; // "Add to cart" button
    skeleton += `</div>`;
    skeleton += `</div>`;
  }
  skeleton += `</div></div>`;
  skeleton += getSkeletonCleanupScript();
  return skeleton;
}

function buildThemeCssFromConfig(tc) {
  const primaryColor = tc.primary_color || tc.pc || "#004643";
  const bgColor = tc.background_color || tc.bg || "#ffffff";
  const textColor = tc.text_color || tc.tc || "#1a1a1a";
  const accentColor = tc.accent_color || tc.ac || primaryColor;
  const buttonStyle = tc.button_style || tc.bs || "rounded";
  const headingFont = tc.heading_font || tc.hf || "";
  const bodyFont = tc.body_font || tc.bf || "";

  const r = parseInt(primaryColor.slice(1, 3), 16);
  const g = parseInt(primaryColor.slice(3, 5), 16);
  const b = parseInt(primaryColor.slice(5, 7), 16);
  const lighten = (c) => Math.min(255, Math.round(c + (255 - c) * 0.35));
  const primaryLight = `#${lighten(r).toString(16).padStart(2, "0")}${lighten(g).toString(16).padStart(2, "0")}${lighten(b).toString(16).padStart(2, "0")}`;
  const btnTextColor = (r * 299 + g * 587 + b * 114) / 1000 > 160 ? "#1a1a1a" : "#ffffff";
  const btnRadius = buttonStyle === "pill" ? "9999px" : buttonStyle === "square" ? "0px" : "0.5rem";

  let css =
    `<style id="edge-theme">:root{` +
    `--storefront-primary:${primaryColor};` +
    `--storefront-primary-light:${primaryLight};` +
    `--storefront-accent:${accentColor};` +
    `--storefront-text:${textColor};` +
    `--storefront-bg:${bgColor};` +
    `--storefront-button-radius:${btnRadius};` +
    `--storefront-btn-text:${btnTextColor};` +
    `}body{background:${bgColor}}</style>\n`;

  const fonts = [headingFont, bodyFont].filter(Boolean);
  if (fonts.length > 0) {
    const families = fonts.map((f) => f.replace(/ /g, "+")).join("&family=");
    css += `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${families}&display=swap&subset=latin" media="print" onload="this.media='all'" />\n`;
    css += `<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${families}&display=swap&subset=latin" /></noscript>\n`;
    css += `<style>:root{--storefront-heading-font:'${fonts[0] || "Inter"}';--storefront-body-font:'${fonts[fonts.length > 1 ? 1 : 0] || "Inter"}'}</style>\n`;
  }

  return { css, bgColor, textColor, primaryColor, btnTextColor, btnRadius, primaryLight };
}

function getSkeletonMuted(textColor) {
  return textColor === "#1a1a1a" ? "#e8e8e8" : "rgba(255,255,255,0.12)";
}

/* ============== v4.9: NEW HELPERS ============== */

/**
 * v4.9: Fetch inline products from Cache API then KV — used in parallel on critical path.
 * Repopulates Cache API from KV in background if needed.
 */
async function _getInlineProductsOrNull(hostname, slug, env, ctx) {
  try {
    const productsCacheKey = _buildProductsCacheKey(hostname, {});
    const cached = await cache.match(productsCacheKey);
    if (cached) return await cached.text();

    if (env?.STORE_KV) {
      const kvKey = _buildProductsKvKey(hostname, {});
      const kvProducts = await env.STORE_KV.get(kvKey);
      if (kvProducts) {
        // Repopulate Cache API in background for next request
        ctx.waitUntil(
          cache
            .put(
              productsCacheKey,
              new Response(kvProducts, {
                headers: {
                  "Content-Type": "application/json",
                  "Cache-Control": `public, max-age=${PRODUCTS_CACHE_TTL}`,
                },
              }),
            )
            .catch(() => {}),
        );
        return kvProducts;
      }
    }
  } catch {}
  return null;
}

/**
 * v4.9: Cache-only prebuilt head lookup (no build fallback).
 * Used in parallel phase so we don't block on shell-dependent head building.
 */
async function _getCachedPrebuiltHead(env) {
  const headCacheKey = new Request("https://cache/prebuilt-head");
  try {
    const cached = await cache.match(headCacheKey);
    if (cached) return await cached.text();
  } catch {}

  if (env?.STORE_KV) {
    try {
      const cached = await env.STORE_KV.get(PREBUILT_HEAD_KV_KEY);
      if (cached) {
        cache
          .put(
            headCacheKey,
            new Response(cached, {
              headers: { "Cache-Control": `public, max-age=${PREBUILT_HEAD_CACHE_TTL}` },
            }),
          )
          .catch(() => {});
        return cached;
      }
    } catch {}
  }
  return null;
}

/**
 * v4.9: Race storefront fetch against a wall-clock deadline.
 * On KV hit this resolves in <50ms. On cold DB fetch we fail fast at deadlineMs
 * and return fast-shell; background warm will populate KV for next request.
 */
async function prefetchStorefrontDataWithDeadline(slug, ctx, env, deadlineMs = 1200) {
  const deadline = new Promise((resolve) =>
    setTimeout(() => resolve({ data: null, source: "deadline-timeout" }), deadlineMs),
  );
  return Promise.race([prefetchStorefrontData(slug, ctx, env), deadline]);
}

/**
 * v4.9: Build Link rel=preload header value from shell HTML.
 * Sent on every HTML response so browser starts fetching assets before parsing body.
 */
function _buildLinkPreloadHeader(html) {
  if (!html) return "";
  const DASH_CHUNK = /(?:charts|dash-vendor|admin-pages|dashboard-pages|dashboard-shell|WhatsApp|auth-pages)-/;
  const links = [];

  const cssMatch = html.match(/href="(\/assets\/[^"]+\.css)"/);
  if (cssMatch) links.push(`<${cssMatch[1]}>; rel=preload; as=style`);

  const seen = new Set();
  for (const m of [...html.matchAll(/src="(\/assets\/[^"]+\.js)"/g)]) {
    if (!seen.has(m[1]) && !DASH_CHUNK.test(m[1])) {
      seen.add(m[1]);
      links.push(`<${m[1]}>; rel=modulepreload`);
      if (links.length >= 6) break; // cap to avoid oversized header
    }
  }

  return links.join(", ");
}

/**
 * v4.9: Stream HTML response — sends <head> immediately so browser can start
 * loading assets, then resolves storefront data promise and writes body.
 *
 * Flow:
 *   1. Build head string (slug script + theme css + prebuilt head) → flush to browser
 *   2. Await storefrontPromise (already racing, resolves from KV in ~50ms or times out at 1.2s)
 *   3. Build body (skeleton + root + storefront data script) → flush
 */
async function serveStreamedHtml(
  slug,
  shellResult,
  themeLite,
  prebuiltHead,
  inlineProducts,
  storefrontPromise,
  responseHeaders,
) {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const enc = new TextEncoder();

  (async () => {
    try {
      const html = shellResult.html;
      const headEnd = html.indexOf("</head>");

      // Graceful fallback: if shell is malformed, write full html at once
      if (headEnd === -1) {
        await writer.write(enc.encode(html));
        return;
      }

      const bgColor = themeLite?.bg || "#ffffff";
      const textColor = themeLite?.tc || "#1a1a1a";
      const themeCss = themeLite ? buildThemeCssFromConfig(themeLite).css : "";

      // Build head injection (slug + theme hint + products hint + theme css + preload)
      const productsHint = inlineProducts
        ? `window.__PRODUCTS_INLINE__=${inlineProducts.replace(/<\/script/gi, "<\\/script")};`
        : "";
      const themeHint = themeLite ? `window.__THEME__=${JSON.stringify(themeLite)};` : "";
      const slugScript = `<script>window.__STORE_SLUG__="${escapeHtml(slug)}";${themeHint}${productsHint}</script>`;

      // Assemble head chunk: everything from start of html up to and including </head>
      let headChunk = html.slice(0, headEnd);
      headChunk = headChunk.replace("<head>", `<head>${slugScript}${themeCss}${prebuiltHead || ""}`);
      headChunk += "</head>";

      // ---- FLUSH HEAD — browser starts fetching assets NOW ----
      await writer.write(enc.encode(headChunk));

      // Await storefront data (racing, resolves from KV fast or times out)
      const storefrontResult = await storefrontPromise;

      // Build body chunk: everything after </head>
      const skeletonMuted = getSkeletonMuted(textColor);
      const skeleton = buildSkeleton(bgColor, skeletonMuted);

      let bodyChunk = html.slice(headEnd + 7); // skip "</head>"
      bodyChunk = bodyChunk.replace('<div id="root">', `${skeleton}<div id="root">`);

      // Inject storefront data before </body> so SPA hydrates without a round-trip
      if (storefrontResult?.data) {
        const jsonStr = JSON.stringify(storefrontResult.data).replace(/<\/script/gi, "<\\/script");
        const dataScript = `<script>window.__STOREFRONT_DATA__=${jsonStr};</script>`;
        bodyChunk = bodyChunk.replace("</body>", `${dataScript}</body>`);
      }

      // Also inject OG meta / favicon as late-head via JS if we have storefront data
      // (bots are handled separately, this helps client-side title/favicon)
      if (storefrontResult?.data?.store) {
        const s = storefrontResult.data.store;
        const ogTitle = escapeHtml(s.meta_title || `${s.name} — Shop Online`);
        const faviconUrl = escapeHtml(s.logo_url || "");
        let metaScript = `<script>(function(){document.title=${JSON.stringify(s.meta_title || `${s.name} — Shop Online`)};`;
        if (faviconUrl) {
          metaScript += `var li=document.querySelector("link[rel~='icon']");if(!li){li=document.createElement('link');li.rel='icon';document.head.appendChild(li);}li.href=${JSON.stringify(faviconUrl)};`;
        }
        metaScript += `})()</script>`;
        bodyChunk = bodyChunk.replace("</body>", `${metaScript}</body>`);
      }

      // ---- FLUSH BODY ----
      await writer.write(enc.encode(bodyChunk));
    } catch {
    } finally {
      writer.close();
    }
  })();

  return new Response(readable, { status: 200, headers: responseHeaders });
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
  const domain = hostname
    .replace(/^www\./, "")
    .toLowerCase()
    .trim();

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
        cache
          .put(
            key,
            new Response(JSON.stringify(kvData), {
              headers: { "Cache-Control": "public, max-age=300" },
            }),
          )
          .catch(() => {});
        return kvData.slug || null;
      }
    } catch {}
  }

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/stores_public?select=slug&custom_domain=eq.${encodeURIComponent(domain)}&limit=1`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      },
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
        }),
      ),
    ];
    if (env?.STORE_KV && slug) {
      writes.push(env.STORE_KV.put(`domain:${domain}`, cacheData, { expirationTtl: KV_DOMAIN_TTL }));
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
      `${SUPABASE_URL}/rest/v1/stores_public?select=custom_domain&slug=eq.${encodeURIComponent(slug)}&limit=1`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      },
    );

    if (!res.ok) return null;
    const data = await res.json();
    const customDomain = data[0]?.custom_domain || null;

    await cache.put(
      key,
      new Response(JSON.stringify({ custom_domain: customDomain }), {
        headers: { "Cache-Control": "public, max-age=300" },
      }),
    );

    return customDomain;
  } catch {
    return null;
  }
}

/* ============== COMBINED STORE INFO LOOKUP ============== */

const _storeInfoCache = new Map();
const STORE_INFO_CACHE_MAX = 2_000;
const STORE_INFO_KV_TTL = 3600;

/* ============== SLUG INDEX ============== */

let _slugIndexSet = null;
let _slugIndexExpiresAt = 0;

async function _getSlugIndex(env) {
  if (_slugIndexSet && Date.now() < _slugIndexExpiresAt) return _slugIndexSet;
  if (!env?.STORE_KV) return null;
  try {
    const arr = await env.STORE_KV.get("all-active-slugs", { type: "json" });
    if (Array.isArray(arr)) {
      _slugIndexSet = new Set(arr);
      _slugIndexExpiresAt = Date.now() + 300_000;
      return _slugIndexSet;
    }
  } catch {}
  return null;
}

function _capMapSize(map, max) {
  if (map.size >= max) {
    const firstKey = map.keys().next().value;
    map.delete(firstKey);
  }
}

async function _resolveStoreInfo(slug, hostname, env) {
  const memEntry = _storeInfoCache.get(slug);
  if (memEntry && Date.now() < memEntry.expiresAt) {
    return { storeId: memEntry.storeId, customDomain: memEntry.customDomain };
  }

  const infoCacheKey = new Request(`https://cache/store-info:${slug}`);
  try {
    const cached = await cache.match(infoCacheKey);
    if (cached) {
      const data = await cached.json();
      if (data.__nf) {
        _capMapSize(_storeInfoCache, STORE_INFO_CACHE_MAX);
        _storeInfoCache.set(slug, { storeId: null, customDomain: null, expiresAt: Date.now() + 60_000 });
        _capMapSize(domainStoreIdCache, DOMAIN_STORE_ID_CACHE_MAX);
        domainStoreIdCache.set(hostname, { storeId: null, expiresAt: Date.now() + 60_000 });
        return { storeId: null, customDomain: null };
      }
      const result = { storeId: data.id || null, customDomain: data.cd || null };
      _capMapSize(_storeInfoCache, STORE_INFO_CACHE_MAX);
      _storeInfoCache.set(slug, { ...result, expiresAt: Date.now() + 300_000 });
      if (result.storeId) {
        _capMapSize(domainStoreIdCache, DOMAIN_STORE_ID_CACHE_MAX);
        domainStoreIdCache.set(hostname, { storeId: result.storeId, expiresAt: Date.now() + 300_000 });
      }
      cache
        .put(
          new Request(`https://cache/slug-domain-${slug}`),
          new Response(JSON.stringify({ custom_domain: result.customDomain }), {
            headers: { "Cache-Control": "public, max-age=300" },
          }),
        )
        .catch(() => {});
      return result;
    }
  } catch {}

  if (env?.STORE_KV) {
    try {
      const kvData = await env.STORE_KV.get(`store-info:${slug}`, { type: "json" });
      if (kvData) {
        if (kvData.__nf) {
          _capMapSize(_storeInfoCache, STORE_INFO_CACHE_MAX);
          _storeInfoCache.set(slug, { storeId: null, customDomain: null, expiresAt: Date.now() + 60_000 });
          _capMapSize(domainStoreIdCache, DOMAIN_STORE_ID_CACHE_MAX);
          domainStoreIdCache.set(hostname, { storeId: null, expiresAt: Date.now() + 60_000 });
          cache
            .put(
              infoCacheKey,
              new Response(JSON.stringify(kvData), {
                headers: { "Cache-Control": "public, max-age=60" },
              }),
            )
            .catch(() => {});
          return { storeId: null, customDomain: null };
        }
        const result = { storeId: kvData.id || null, customDomain: kvData.cd || null };
        _capMapSize(_storeInfoCache, STORE_INFO_CACHE_MAX);
        _storeInfoCache.set(slug, { ...result, expiresAt: Date.now() + 300_000 });
        if (result.storeId) {
          _capMapSize(domainStoreIdCache, DOMAIN_STORE_ID_CACHE_MAX);
          domainStoreIdCache.set(hostname, { storeId: result.storeId, expiresAt: Date.now() + 300_000 });
        }
        cache
          .put(
            infoCacheKey,
            new Response(JSON.stringify(kvData), {
              headers: { "Cache-Control": "public, max-age=300" },
            }),
          )
          .catch(() => {});
        cache
          .put(
            new Request(`https://cache/slug-domain-${slug}`),
            new Response(JSON.stringify({ custom_domain: result.customDomain }), {
              headers: { "Cache-Control": "public, max-age=300" },
            }),
          )
          .catch(() => {});
        return result;
      }
    } catch {}
  }

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/stores_public?select=id,custom_domain&slug=eq.${encodeURIComponent(slug)}&limit=1`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      },
    );

    if (!res.ok) return { storeId: null, customDomain: null };
    const rows = await res.json();
    const row = rows[0];

    if (!row) {
      const nfData = { __nf: true };
      _capMapSize(_storeInfoCache, STORE_INFO_CACHE_MAX);
      _storeInfoCache.set(slug, { storeId: null, customDomain: null, expiresAt: Date.now() + 60_000 });
      _capMapSize(domainStoreIdCache, DOMAIN_STORE_ID_CACHE_MAX);
      domainStoreIdCache.set(hostname, { storeId: null, expiresAt: Date.now() + 60_000 });
      cache
        .put(
          infoCacheKey,
          new Response(JSON.stringify(nfData), {
            headers: { "Cache-Control": "public, max-age=60" },
          }),
        )
        .catch(() => {});
      if (env?.STORE_KV) {
        env.STORE_KV.put(`store-info:${slug}`, JSON.stringify(nfData), { expirationTtl: 120 }).catch(() => {});
      }
      return { storeId: null, customDomain: null };
    }

    const result = { storeId: row.id, customDomain: row.custom_domain || null };
    const cachePayload = { id: result.storeId, cd: result.customDomain };
    _capMapSize(_storeInfoCache, STORE_INFO_CACHE_MAX);
    _storeInfoCache.set(slug, { ...result, expiresAt: Date.now() + 300_000 });
    _capMapSize(domainStoreIdCache, DOMAIN_STORE_ID_CACHE_MAX);
    domainStoreIdCache.set(hostname, { storeId: result.storeId, expiresAt: Date.now() + 300_000 });

    const writes = [
      cache
        .put(
          infoCacheKey,
          new Response(JSON.stringify(cachePayload), {
            headers: { "Cache-Control": "public, max-age=300" },
          }),
        )
        .catch(() => {}),
      cache
        .put(
          new Request(`https://cache/slug-domain-${slug}`),
          new Response(JSON.stringify({ custom_domain: result.customDomain }), {
            headers: { "Cache-Control": "public, max-age=300" },
          }),
        )
        .catch(() => {}),
      cache
        .put(
          new Request(`https://cache/store-id:${hostname}`),
          new Response(result.storeId, {
            headers: { "Cache-Control": "public, max-age=600" },
          }),
        )
        .catch(() => {}),
    ];
    if (env?.STORE_KV) {
      writes.push(
        env.STORE_KV.put(`store-info:${slug}`, JSON.stringify(cachePayload), {
          expirationTtl: STORE_INFO_KV_TTL,
        }).catch(() => {}),
      );
    }
    await Promise.all(writes);

    return result;
  } catch {
    return { storeId: null, customDomain: null };
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
        newRes.headers.set("Cache-Control", "public, max-age=2592000, immutable");
      }
    } else if (contentType.includes("text/html")) {
      newRes.headers.set("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
    }

    for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
      newRes.headers.set(k, v);
    }

    return newRes;
  } catch {
    clearTimeout(timeout);
    return new Response(
      `<!DOCTYPE html><html><head><title>Store Temporarily Unavailable</title></head>
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
      },
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
            cache
              .put(
                shellCacheKey,
                new Response(kvHtml, {
                  headers: {
                    "Content-Type": "text/html; charset=utf-8",
                    "Cache-Control": `public, max-age=${SPA_SHELL_CACHE_TTL}`,
                  },
                }),
              )
              .catch(() => {}),
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
    } catch {
      return null;
    }
  }

  const fetchPromise = _fetchSpaShellFromOrigin(request, ctx, env, shellCacheKey);
  inflightShellFetch = fetchPromise;

  try {
    const html = await fetchPromise;
    return html ? { html, source: "origin" } : null;
  } catch {
    return null;
  } finally {
    inflightShellFetch = null;
  }
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
          }),
        ),
      ]).catch(() => {}),
    );
  }

  return html;
}

/* ============== PREBUILT HEAD ============== */

const PREBUILT_HEAD_KV_KEY = "prebuilt-head:v1";
const PREBUILT_HEAD_KV_TTL = 3600;
const PREBUILT_HEAD_CACHE_TTL = 600;

async function getPrebuiltHead(html, env) {
  const headCacheKey = new Request("https://cache/prebuilt-head");
  try {
    const cached = await cache.match(headCacheKey);
    if (cached) return await cached.text();
  } catch {}

  if (env?.STORE_KV) {
    try {
      const cached = await env.STORE_KV.get(PREBUILT_HEAD_KV_KEY);
      if (cached) {
        cache
          .put(
            headCacheKey,
            new Response(cached, {
              headers: { "Cache-Control": `public, max-age=${PREBUILT_HEAD_CACHE_TTL}` },
            }),
          )
          .catch(() => {});
        return cached;
      }
    } catch {}
  }

  const prebuilt = _buildPrebuiltHead(html);

  cache
    .put(
      headCacheKey,
      new Response(prebuilt, {
        headers: { "Cache-Control": `public, max-age=${PREBUILT_HEAD_CACHE_TTL}` },
      }),
    )
    .catch(() => {});
  if (env?.STORE_KV) {
    env.STORE_KV.put(PREBUILT_HEAD_KV_KEY, prebuilt, { expirationTtl: PREBUILT_HEAD_KV_TTL }).catch(() => {});
  }

  return prebuilt;
}

function _buildPrebuiltHead(html) {
  let head = "";

  head += `<link rel="preconnect" href="${SUPABASE_URL}" crossorigin />`;
  head += `<link rel="dns-prefetch" href="${SUPABASE_URL}" />`;
  head += `<link rel="preconnect" href="https://soxuyuupzodkufxbbndq.supabase.co/storage" crossorigin />`;

  const cssMatch = html.match(/href="(\/assets\/[^"]+\.css)"/);
  if (cssMatch) {
    head += `<link rel="preload" href="${cssMatch[1]}" as="style" />`;
  }

  const DASHBOARD_CHUNK_PATTERN =
    /(?:charts|dash-vendor|admin-pages|dashboard-pages|dashboard-shell|WhatsApp|auth-pages)-/;
  const chunkMatches = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)];
  const seen = new Set();
  for (const m of chunkMatches) {
    if (!seen.has(m[1]) && !DASHBOARD_CHUNK_PATTERN.test(m[1])) {
      seen.add(m[1]);
      head += `<link rel="modulepreload" href="${m[1]}" />`;
    }
  }

  return head;
}

/* ============== PROXY TO ORIGIN WITH CF EDGE CACHING ============== */

async function proxyToOriginCached(request) {
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
      cf: { cacheTtl: 2592000, cacheEverything: true },
    });
    clearTimeout(timeout);

    const newRes = new Response(res.body, res);
    if (newRes.ok) {
      newRes.headers.set("Cache-Control", "public, max-age=2592000, immutable");
    }
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
      newRes.headers.set(k, v);
    }
    return newRes;
  } catch {
    clearTimeout(timeout);
    return proxyToOrigin(request);
  }
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
            cache
              .put(
                dataCacheKey,
                new Response(JSON.stringify(kvData), {
                  headers: { "Cache-Control": `public, max-age=${CACHE_STOREFRONT_TTL}` },
                }),
              )
              .catch(() => {}),
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
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_storefront_shell`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({ _slug: slug }),
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();

    if (data && ctx) {
      const dataStr = JSON.stringify(data);
      const storeId = data?.store?.id;
      const storeSlug = data?.store?.slug;

      if (data?.theme_config) {
        _cacheThemeForFastShell(slug, data.theme_config, env, ctx);
      }

      ctx.waitUntil(
        Promise.all([
          env?.STORE_KV ? env.STORE_KV.put(kvKey, dataStr, { expirationTtl: KV_STOREFRONT_TTL }) : Promise.resolve(),
          cache.put(
            dataCacheKey,
            new Response(dataStr, {
              headers: { "Cache-Control": `public, max-age=${CACHE_STOREFRONT_TTL}` },
            }),
          ),
          storeId ? _prewarmProducts(storeId, storeSlug, ctx, env, data?.store?.custom_domain) : Promise.resolve(),
        ]),
      );
    }

    return data;
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

/* ============== LIGHTWEIGHT THEME CACHE ============== */

const THEME_LITE_KV_TTL = 3600;
const THEME_LITE_CACHE_TTL = 600;

function _cacheThemeForFastShell(slug, themeConfig, env, ctx) {
  const lite = {
    pc: themeConfig.primary_color || "#004643",
    bg: themeConfig.background_color || "#ffffff",
    tc: themeConfig.text_color || "#1a1a1a",
    ac: themeConfig.accent_color || "",
    hf: themeConfig.heading_font || "",
    bf: themeConfig.body_font || "",
    bs: themeConfig.button_style || "rounded",
  };
  const liteStr = JSON.stringify(lite);

  const themeCacheKey = new Request(`https://cache/theme-lite:${slug}`);
  cache
    .put(
      themeCacheKey,
      new Response(liteStr, {
        headers: { "Cache-Control": `public, max-age=${THEME_LITE_CACHE_TTL}` },
      }),
    )
    .catch(() => {});

  if (env?.STORE_KV) {
    env.STORE_KV.put(`theme-lite:${slug}`, liteStr, { expirationTtl: THEME_LITE_KV_TTL }).catch(() => {});
  }
}

async function _getThemeLite(slug, env) {
  const themeCacheKey = new Request(`https://cache/theme-lite:${slug}`);
  try {
    const cached = await cache.match(themeCacheKey);
    if (cached) return await cached.json();
  } catch {}

  if (!env?.STORE_KV) return null;
  try {
    const kvData = await env.STORE_KV.get(`theme-lite:${slug}`, { type: "json" });
    if (kvData) {
      cache
        .put(
          themeCacheKey,
          new Response(JSON.stringify(kvData), {
            headers: { "Cache-Control": `public, max-age=${THEME_LITE_CACHE_TTL}` },
          }),
        )
        .catch(() => {});
    }
    return kvData;
  } catch {
    return null;
  }
}

/* ============== PRODUCTS PREWARM ============== */

async function _prewarmProducts(storeId, slug, ctx, env, customDomain) {
  const domain = slug ? `${slug}.${ROOT_DOMAIN}` : "unknown";
  const cacheKey = _buildProductsCacheKey(domain, {});

  try {
    const existing = await cache.match(cacheKey);
    if (existing) return;
  } catch {}

  try {
    const data = await _fetchProductsFromDb(storeId, {}, PRODUCTS_DB_TIMEOUT_MS);
    const body = JSON.stringify(data || []);
    const cacheOps = [
      cache
        .put(
          cacheKey,
          new Response(body, {
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": `public, max-age=${PRODUCTS_CACHE_TTL}`,
            },
          }),
        )
        .catch(() => {}),
      env?.STORE_KV
        ? env.STORE_KV.put(_buildProductsKvKey(domain, {}), body, { expirationTtl: PRODUCTS_KV_TTL }).catch(() => {})
        : Promise.resolve(),
    ];

    if (customDomain) {
      const cleanCustom = customDomain
        .replace(/^www\./, "")
        .toLowerCase()
        .trim();
      cacheOps.push(
        cache
          .put(
            _buildProductsCacheKey(cleanCustom, {}),
            new Response(body, {
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": `public, max-age=${PRODUCTS_CACHE_TTL}`,
              },
            }),
          )
          .catch(() => {}),
      );
      if (env?.STORE_KV) {
        cacheOps.push(
          env.STORE_KV.put(_buildProductsKvKey(cleanCustom, {}), body, { expirationTtl: PRODUCTS_KV_TTL }).catch(
            () => {},
          ),
        );
      }
    }

    await Promise.all(cacheOps);
  } catch {}
}

/* ============== PRODUCTS API ============== */

const PRODUCTS_CACHE_TTL = 300;
const PRODUCTS_KV_TTL = 1800;
const PRODUCTS_DB_TIMEOUT_MS = 3000;
const PRODUCTS_PAGE_SIZE = 20;
const PRODUCT_COLUMNS =
  "id,category,cost_price,created_at,currency,description,image_url,is_active,is_best_selling,name,price,sale_price,sku,slug,stock_quantity,store_id,updated_at";

const inflightProductRequests = new Map();
const inflightDomainResolutions = new Map();

const domainStoreIdCache = new Map();
const DOMAIN_STORE_ID_CACHE_MAX = 5_000;

async function _resolveStoreId(domain, env) {
  const memEntry = domainStoreIdCache.get(domain);
  if (memEntry && Date.now() < memEntry.expiresAt) return memEntry.storeId;

  const storeIdCacheKey = new Request(`https://cache/store-id:${domain}`);
  try {
    const cached = await cache.match(storeIdCacheKey);
    if (cached) {
      const storeId = await cached.text();
      if (storeId === "__NOT_FOUND__") {
        _capMapSize(domainStoreIdCache, DOMAIN_STORE_ID_CACHE_MAX);
        domainStoreIdCache.set(domain, { storeId: null, expiresAt: Date.now() + 60_000 });
        return null;
      }
      _capMapSize(domainStoreIdCache, DOMAIN_STORE_ID_CACHE_MAX);
      domainStoreIdCache.set(domain, { storeId, expiresAt: Date.now() + 300_000 });
      return storeId || null;
    }
  } catch {}

  if (env?.STORE_KV) {
    try {
      const kvVal = await env.STORE_KV.get(`store-id:${domain}`);
      if (kvVal) {
        _capMapSize(domainStoreIdCache, DOMAIN_STORE_ID_CACHE_MAX);
        domainStoreIdCache.set(domain, { storeId: kvVal, expiresAt: Date.now() + 300_000 });
        cache
          .put(
            storeIdCacheKey,
            new Response(kvVal, {
              headers: { "Cache-Control": "public, max-age=600" },
            }),
          )
          .catch(() => {});
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
      _capMapSize(domainStoreIdCache, DOMAIN_STORE_ID_CACHE_MAX);
      domainStoreIdCache.set(domain, { storeId, expiresAt: Date.now() + 300_000 });
      cache
        .put(
          storeIdCacheKey,
          new Response(storeId, {
            headers: { "Cache-Control": "public, max-age=600" },
          }),
        )
        .catch(() => {});
      if (env?.STORE_KV) {
        env.STORE_KV.put(`store-id:${domain}`, storeId, { expirationTtl: 3600 }).catch(() => {});
      }
    } else {
      _capMapSize(domainStoreIdCache, DOMAIN_STORE_ID_CACHE_MAX);
      domainStoreIdCache.set(domain, { storeId: null, expiresAt: Date.now() + 60_000 });
      cache
        .put(
          storeIdCacheKey,
          new Response("__NOT_FOUND__", {
            headers: { "Cache-Control": "public, max-age=60" },
          }),
        )
        .catch(() => {});
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

  const res = await fetch(`${SUPABASE_URL}/rest/v1/stores_public?select=id&${query}&limit=1`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
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

  const purgeOps = [cache.delete(defaultCacheKey).catch(() => {})];

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
    "purge",
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

  try {
    const cached = await cache.match(cacheKey);
    if (cached) {
      const revalKey = `products:${domain}:${filters.category}:${filters.page}:${filters.sort}`;
      if (shouldRevalidate(revalKey)) {
        ctx.waitUntil(_refreshProductsBackground(domain, filters, cacheKey, env));
      }
      return addCorsHeaders(cached, "cache-api");
    }
  } catch {}

  const kvKey = _buildProductsKvKey(domain, filters);
  if (env?.STORE_KV) {
    try {
      const kvData = await env.STORE_KV.get(kvKey, { type: "text" });
      if (kvData) {
        ctx.waitUntil(
          cache
            .put(
              cacheKey,
              new Response(kvData, {
                headers: {
                  "Content-Type": "application/json",
                  "Cache-Control": `public, max-age=${PRODUCTS_CACHE_TTL}`,
                },
              }),
            )
            .catch(() => {}),
        );
        return addCorsHeaders(
          new Response(kvData, {
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": `public, max-age=${PRODUCTS_CACHE_TTL}, stale-while-revalidate=${PRODUCTS_KV_TTL}`,
            },
          }),
          "kv",
        );
      }
    } catch {}
  }

  const storeId = await _resolveStoreId(domain, env);
  if (!storeId) {
    return addCorsHeaders(
      new Response("[]", {
        headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60" },
      }),
      "no-store",
    );
  }

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
    ]),
  );

  return addCorsHeaders(response, source);
}

async function _refreshProductsBackground(domain, filters, cacheKey, env) {
  try {
    const storeId = await _resolveStoreId(domain, env);
    if (!storeId) return;
    const data = await _fetchProductsFromDb(storeId, filters, PRODUCTS_DB_TIMEOUT_MS);
    const body = JSON.stringify(data || []);
    const kvKey = _buildProductsKvKey(domain, filters);

    await Promise.all([
      cache
        .put(
          cacheKey,
          new Response(body, {
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": `public, max-age=${PRODUCTS_CACHE_TTL}`,
            },
          }),
        )
        .catch(() => {}),
      env?.STORE_KV
        ? env.STORE_KV.put(kvKey, body, { expirationTtl: PRODUCTS_KV_TTL }).catch(() => {})
        : Promise.resolve(),
    ]);
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
      if (stale)
        return addCorsHeaders(
          new Response(stale, {
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          }),
          "kv-stale",
        );
    } catch {}

    const defaultKvKey = _buildProductsKvKey(domain, {});
    if (defaultKvKey !== kvKey) {
      try {
        const defaultStale = await env.STORE_KV.get(defaultKvKey, { type: "text" });
        if (defaultStale)
          return addCorsHeaders(
            new Response(defaultStale, {
              headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
            }),
            "kv-default-stale",
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
    "fallback-empty",
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
  let bgColor = "#ffffff";
  let textColor = "#1a1a1a";

  if (storefrontData?.theme_config) {
    const themeResult = buildThemeCssFromConfig(storefrontData.theme_config);
    inlineThemeCss = themeResult.css;
    bgColor = themeResult.bgColor;
    textColor = themeResult.textColor;
  }

  const logoUrl = storefrontData?.store?.logo_url || "";

  let ogMeta = "";
  if (storefrontData?.store) {
    const s = storefrontData.store;
    const ogTitle = escapeHtml(s.meta_title || `${s.name} — Shop Online`);
    const ogDesc = escapeHtml(
      s.meta_description || s.description || `Shop the best products at ${s.name}. Fast delivery & easy returns.`,
    );
    const ogImage = escapeHtml(s.og_image_url || s.banner_url || s.logo_url || "");
    ogMeta += `<title>${ogTitle}</title>`;
    ogMeta += `<meta name="description" content="${ogDesc}">`;
    ogMeta += `<meta property="og:title" content="${ogTitle}">`;
    ogMeta += `<meta property="og:description" content="${ogDesc}">`;
    ogMeta += `<meta name="twitter:title" content="${ogTitle}">`;
    ogMeta += `<meta name="twitter:description" content="${ogDesc}">`;
    if (ogImage) {
      ogMeta += `<meta property="og:image" content="${ogImage}">`;
      ogMeta += `<meta name="twitter:image" content="${ogImage}">`;
    }
    ogMeta += `<meta property="og:site_name" content="${escapeHtml(s.name)}">`;
    if (logoUrl) {
      ogMeta += `<link rel="icon" type="image/png" href="${escapeHtml(logoUrl)}">`;
      ogMeta += `<link rel="apple-touch-icon" href="${escapeHtml(logoUrl)}">`;
    }
  }

  const skeletonMuted = getSkeletonMuted(textColor);
  const skeleton = buildSkeleton(bgColor, skeletonMuted);

  let lcpPreload = "";
  if (storefrontData?.store?.logo_url) {
    lcpPreload += `<link rel="preload" as="image" href="${escapeHtml(storefrontData.store.logo_url)}" />`;
  }

  const cssMatch = html.match(/href="(\/assets\/[^"]+\.css)"/);
  let cssPreload = "";
  if (cssMatch) {
    cssPreload = `<link rel="preload" href="${cssMatch[1]}" as="style" />\n`;
  }

  const DASHBOARD_CHUNK_PATTERN =
    /(?:charts|dash-vendor|admin-pages|dashboard-pages|dashboard-shell|WhatsApp|auth-pages)-/;
  const chunkMatches = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)];
  let modulePreloads = "";
  const seen = new Set();
  for (const m of chunkMatches) {
    if (!seen.has(m[1]) && !DASHBOARD_CHUNK_PATTERN.test(m[1])) {
      seen.add(m[1]);
      modulePreloads += `<link rel="modulepreload" href="${m[1]}" />\n`;
    }
  }

  let injectedHtml = html.replace(
    "<head>",
    `<head>${injection}${ogMeta}${inlineThemeCss}${lcpPreload}${cssPreload}${modulePreloads}`,
  );
  injectedHtml = injectedHtml.replace('<div id="root">', `${skeleton}<div id="root">`);

  return { html: injectedHtml, dataSource };
}

/* ============== FAST SHELL INJECT (fallback when storefront times out) ============== */

function injectFastShell(html, slug, themeLite, prebuiltHead, inlineProducts) {
  const slugScript = `<script>window.__STORE_SLUG__="${escapeHtml(slug)}";`;

  let themeHint = "";
  if (themeLite) {
    themeHint = `window.__THEME__=${JSON.stringify(themeLite)};`;
  }

  let productsHint = "";
  if (inlineProducts) {
    productsHint = `window.__PRODUCTS_INLINE__=${inlineProducts.replace(/<\/script/gi, "<\\/script")};`;
  }

  const injection = slugScript + themeHint + productsHint + `</script>`;

  const bgColor = themeLite?.bg || "#ffffff";
  const textColor = themeLite?.tc || "#1a1a1a";
  const skeletonMuted = getSkeletonMuted(textColor);

  let themeCss = "";
  if (themeLite) {
    const themeResult = buildThemeCssFromConfig(themeLite);
    themeCss = themeResult.css;
  }

  const skeleton = buildSkeleton(bgColor, skeletonMuted);

  let headInjection;
  if (prebuiltHead) {
    headInjection = `${injection}${themeCss}${prebuiltHead}`;
  } else {
    headInjection = `${injection}${themeCss}${_buildPrebuiltHead(html)}`;
  }

  let injectedHtml = html.replace("<head>", `<head>${headInjection}`);
  injectedHtml = injectedHtml.replace('<div id="root">', `${skeleton}<div id="root">`);

  return injectedHtml;
}

/* ============== v4.9: UPDATED fetchAndInjectSlug ============== */

async function fetchAndInjectSlug(request, slug, ctx, env, hostname, pathname) {
  // v4.9: Fetch shell + theme + prebuilt head + products all at once
  const [shellResult, themeLite, cachedHead, inlineProducts] = await Promise.all([
    getSpaShell(request, ctx, env),
    _getThemeLite(slug, env),
    _getCachedPrebuiltHead(env),
    _getInlineProductsOrNull(hostname, slug, env, ctx),
  ]);

  if (!shellResult?.html) {
    const response = await proxyToOrigin(request);
    return { response, dataSource: "none" };
  }

  const prebuiltHead = cachedHead || (await getPrebuiltHead(shellResult.html, env));
  const linkHeader = _buildLinkPreloadHeader(shellResult.html);

  // v4.9: Race storefront data against deadline — inject full data if available
  const storefrontPromise = prefetchStorefrontDataWithDeadline(slug, ctx, env, 1200);

  const newHeaders = new Headers();
  newHeaders.set("Content-Type", "text/html; charset=utf-8");
  newHeaders.set("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
  newHeaders.set("X-Store-Slug", slug);
  newHeaders.set("X-Shell-Source", shellResult.source);
  newHeaders.set("X-Cache-Timestamp", new Date().toISOString());
  newHeaders.set("X-Data-Source", "streaming");
  if (linkHeader) newHeaders.set("Link", linkHeader);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    newHeaders.set(k, v);
  }

  const response = await serveStreamedHtml(
    slug,
    shellResult,
    themeLite,
    prebuiltHead,
    inlineProducts,
    storefrontPromise,
    newHeaders,
  );

  ctx.waitUntil(_warmFullHtmlInBackground(request, shellResult, slug, ctx, env, hostname, pathname));

  return { response, dataSource: "streaming" };
}

async function _warmFullHtmlInBackground(request, shellResult, slug, ctx, env, hostname, pathname) {
  try {
    if (hostname && pathname) {
      const earlyKey = getEarlyCacheKey(hostname, pathname);
      const existing = await cache.match(earlyKey);
      if (existing) {
        const ds = existing.headers.get("X-Data-Source") || "";
        if (ds && ds !== "fast-shell" && ds !== "fast-shell-themed" && ds !== "streaming") {
          return;
        }
      }
    }

    const warmKey = `warm-html:${slug}`;
    if (!shouldRevalidate(warmKey)) return;

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

    if (hostname && pathname) {
      const earlyKey = getEarlyCacheKey(hostname, pathname);
      await cache.put(earlyKey, fullResponse.clone()).catch(() => {});
    }
  } catch {}
}

/* ============== STORE RESPONSE IN EDGE CACHE ============== */

function storeInEdgeCache(ctx, hostname, pathname, slug, response) {
  const earlyKey = getEarlyCacheKey(hostname, pathname);
  ctx.waitUntil(cache.put(earlyKey, response.clone()).catch(() => {}));
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
  const siteName = escapeHtml(og.title?.split("—")[0]?.trim() || og.title || "");
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
${
  img
    ? `<meta property="og:image" content="${img}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">`
    : ""
}
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

  if (isSocialInAppBrowser(ua)) return null;
  if (!BOT_UA_REGEX.test(ua)) return null;

  const botIp = request.headers.get("cf-connecting-ip") || "unknown";
  const botRlKey = `bot:${botIp}`;
  if (isRateLimited(botRlKey, true)) return null;

  const product = getProductSlug(url.pathname);
  const finalUrl = isCustom
    ? `${url.origin}${url.pathname}${url.search}`
    : buildSubdomainUrl(slug, url.pathname, url.search);

  if (SEARCH_BOT_REGEX.test(ua)) {
    try {
      const domainType = isCustom ? "custom" : "sub";
      const botCacheKey = new Request(`https://cache/bot-render/${domainType}/${slug}/${product || "home"}`);
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
            "Cache-Control": "public, max-age=3600, s-maxage=86400",
            "X-Bot-Render": "true",
          },
        });
        await cache.put(botCacheKey, response.clone());
        return response;
      }
    } catch {}
  }

  if (SOCIAL_BOT_REGEX.test(ua) || INSTAGRAM_CRAWLER_REGEX.test(ua)) {
    try {
      const ogCacheKey = new Request(`https://cache/og/${slug}/${product || "home"}`);
      const cached = await cache.match(ogCacheKey);
      if (cached) return cached;

      const domain = isCustom ? url.hostname : null;
      const res = await callEdgeFunction("bot-render", {
        slug,
        ...(product ? { product } : {}),
        ...(domain ? { domain } : {}),
        social: "true",
      });

      if (res && res.ok) {
        const ogData = await res.json();
        const ogHtml = buildOgHtml(ogData, finalUrl);
        const response = new Response(ogHtml, {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "public, max-age=3600, s-maxage=86400",
            "X-OG-Render": "true",
          },
        });
        await cache.put(ogCacheKey, response.clone());
        return response;
      }
    } catch {}
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
      const res = await callEdgeFunction("seo-page", { slug, type: "sitemap" });
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
      "prewarm-error",
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
      "prewarm-error",
    );
  }

  const results = {};

  try {
    const shellResult = await getSpaShell(request, ctx, env);
    results.spaShell = shellResult?.source || "failed";

    if (shellResult?.html) {
      const built = _buildPrebuiltHead(shellResult.html);
      const headCacheKey = new Request("https://cache/prebuilt-head");
      await Promise.all([
        cache
          .put(
            headCacheKey,
            new Response(built, {
              headers: { "Cache-Control": `public, max-age=${PREBUILT_HEAD_CACHE_TTL}` },
            }),
          )
          .catch(() => {}),
        env?.STORE_KV
          ? env.STORE_KV.put(PREBUILT_HEAD_KV_KEY, built, { expirationTtl: PREBUILT_HEAD_KV_TTL }).catch(() => {})
          : Promise.resolve(),
      ]);
      results.prebuiltHead = "warmed";
    }

    if (domain) {
      const cleanDomain = domain
        .replace(/^www\./, "")
        .toLowerCase()
        .trim();
      const domainKey = new Request(`https://cache/domain-${cleanDomain}`);
      const cacheData = JSON.stringify({ slug });

      const writes = [
        cache
          .put(
            domainKey,
            new Response(cacheData, {
              headers: { "Cache-Control": "public, max-age=300" },
            }),
          )
          .catch(() => {}),
      ];
      if (env?.STORE_KV) {
        writes.push(
          env.STORE_KV.put(`domain:${cleanDomain}`, cacheData, { expirationTtl: KV_DOMAIN_TTL }).catch(() => {}),
        );
      }
      await Promise.all(writes);
      results.domainMapping = "warmed";
    }

    const subDomain = `${slug}.${ROOT_DOMAIN}`;
    let storeId = null;
    const dataResult = await prefetchStorefrontData(slug, ctx, env);
    storeId = dataResult.data?.store?.id;
    results.storefrontData = dataResult.source;

    if (dataResult.data?.theme_config) {
      _cacheThemeForFastShell(slug, dataResult.data.theme_config, env, ctx);
      results.themeLite = "warmed";
    }

    if (storeId) {
      const storeIdStr = storeId;
      const idWrites = [
        cache
          .put(
            new Request(`https://cache/store-id:${subDomain}`),
            new Response(storeIdStr, {
              headers: { "Cache-Control": "public, max-age=600" },
            }),
          )
          .catch(() => {}),
      ];
      if (env?.STORE_KV) {
        idWrites.push(env.STORE_KV.put(`store-id:${subDomain}`, storeIdStr, { expirationTtl: 3600 }).catch(() => {}));
      }
      if (domain) {
        const cleanDomain = domain
          .replace(/^www\./, "")
          .toLowerCase()
          .trim();
        idWrites.push(
          cache
            .put(
              new Request(`https://cache/store-id:${cleanDomain}`),
              new Response(storeIdStr, {
                headers: { "Cache-Control": "public, max-age=600" },
              }),
            )
            .catch(() => {}),
        );
        if (env?.STORE_KV) {
          idWrites.push(
            env.STORE_KV.put(`store-id:${cleanDomain}`, storeIdStr, { expirationTtl: 3600 }).catch(() => {}),
          );
        }
      }
      await Promise.all(idWrites);
    }

    if (storeId && dataResult.source !== "origin") {
      try {
        const products = await _fetchProductsFromDb(storeId, {}, PRODUCTS_DB_TIMEOUT_MS);
        const prodBody = JSON.stringify(products || []);
        const cacheOps = [];

        const subCacheKey = _buildProductsCacheKey(subDomain, {});
        cacheOps.push(
          cache
            .put(
              subCacheKey,
              new Response(prodBody, {
                headers: {
                  "Content-Type": "application/json",
                  "Cache-Control": `public, max-age=${PRODUCTS_CACHE_TTL}`,
                },
              }),
            )
            .catch(() => {}),
        );
        if (env?.STORE_KV) {
          cacheOps.push(
            env.STORE_KV.put(_buildProductsKvKey(subDomain, {}), prodBody, { expirationTtl: PRODUCTS_KV_TTL }).catch(
              () => {},
            ),
          );
        }

        if (domain) {
          const cleanDomain = domain
            .replace(/^www\./, "")
            .toLowerCase()
            .trim();
          const domCacheKey = _buildProductsCacheKey(cleanDomain, {});
          cacheOps.push(
            cache
              .put(
                domCacheKey,
                new Response(prodBody, {
                  headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": `public, max-age=${PRODUCTS_CACHE_TTL}`,
                  },
                }),
              )
              .catch(() => {}),
          );
          if (env?.STORE_KV) {
            cacheOps.push(
              env.STORE_KV.put(_buildProductsKvKey(cleanDomain, {}), prodBody, {
                expirationTtl: PRODUCTS_KV_TTL,
              }).catch(() => {}),
            );
          }
        }

        await Promise.all(cacheOps);
        results.products = "warmed";
      } catch {
        results.products = "failed";
      }
    } else if (storeId) {
      results.products = "warmed-via-prefetch";
    }

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
        const cleanDomain = domain
          .replace(/^www\./, "")
          .toLowerCase()
          .trim();
        const domEarlyKey = getEarlyCacheKey(cleanDomain, "/");
        await cache.put(domEarlyKey, htmlResponse.clone()).catch(() => {});
      }

      results.fullHtml = "warmed";
    } else {
      results.fullHtml = "skipped";
    }

    if (env?.STORE_KV) {
      try {
        const currentIndex = await env.STORE_KV.get("all-active-slugs", { type: "json" });
        if (Array.isArray(currentIndex) && !currentIndex.includes(slug)) {
          currentIndex.push(slug);
          await env.STORE_KV.put("all-active-slugs", JSON.stringify(currentIndex), { expirationTtl: 600 }).catch(
            () => {},
          );
          if (_slugIndexSet) _slugIndexSet.add(slug);
        } else if (!currentIndex) {
          await env.STORE_KV.put("all-active-slugs", JSON.stringify([slug]), { expirationTtl: 600 }).catch(() => {});
          _slugIndexSet = new Set([slug]);
          _slugIndexExpiresAt = Date.now() + 300_000;
        }
      } catch {}
    }

    return addCorsHeaders(
      new Response(JSON.stringify({ success: true, slug, domain: domain || null, results }), {
        headers: { "Content-Type": "application/json" },
      }),
      "prewarm",
    );
  } catch (err) {
    return addCorsHeaders(
      new Response(JSON.stringify({ success: false, error: err?.message || "Unknown error", results }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
      "prewarm-error",
    );
  }
}

/* ============== NOT FOUND HTML ============== */

function buildNotFoundHtml(safeSlug, rootDomain) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Store Not Found</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fafafa;color:#333}.c{text-align:center;padding:2rem}.c h1{font-size:1.5rem;font-weight:600;margin-bottom:8px}.c p{color:#666;margin-bottom:20px;font-size:0.95rem}.c a{display:inline-block;padding:10px 24px;background:#4361ee;color:#fff;border-radius:8px;text-decoration:none;font-weight:500;font-size:0.9rem;transition:background .2s}.c a:hover{background:#3651d4}</style></head><body><div class="c"><h1>Store Not Found</h1><p>No store exists at <strong>${safeSlug}.${rootDomain}</strong></p><a href="https://${rootDomain}">Create Your Store</a></div></body></html>`;
}

/* ============== MAIN HANDLER ============== */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const hostname = (request.headers.get("host") || url.hostname).toLowerCase().trim();

    // ─── HEALTH CHECK ───
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
          },
        );
      } catch {
        return new Response(
          JSON.stringify({
            status: "unhealthy",
            origin: "timeout",
            workerVersion: WORKER_VERSION,
            timestamp: new Date().toISOString(),
          }),
          { status: 503, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } },
        );
      }
    }

    // ─── STATIC ASSETS ───
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
      if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/static/")) {
        return proxyToOriginCached(request);
      }
      return proxyToOrigin(request);
    }

    // Cleanup maps after static asset early return
    cleanRateLimitMap();
    cleanRevalMap();

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
        if (shouldRevalidate(revalKey)) {
          ctx.waitUntil(
            (async () => {
              try {
                let revalSlug = cachedSlug;
                if (!revalSlug && !hostname.endsWith(`.${ROOT_DOMAIN}`) && hostname !== ROOT_DOMAIN) {
                  revalSlug = await resolveDomain(
                    hostname
                      .replace(/^www\./, "")
                      .toLowerCase()
                      .trim(),
                    env,
                  );
                } else if (!revalSlug && hostname.endsWith(`.${ROOT_DOMAIN}`)) {
                  revalSlug = hostname.replace(`.${ROOT_DOMAIN}`, "");
                }
                if (revalSlug) {
                  const [shellResult, prefetchResult] = await Promise.all([
                    getSpaShell(request, ctx, env),
                    prefetchStorefrontData(revalSlug, ctx, env),
                  ]);
                  if (shellResult?.html && prefetchResult.data) {
                    const result = injectIntoHtml(
                      shellResult.html,
                      revalSlug,
                      prefetchResult.data,
                      prefetchResult.source,
                    );
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
            })(),
          );
        }

        return addDiagnosticHeaders(earlyHit, {
          slug: cachedSlug,
          cacheStatus: "HIT",
          dataSource: cachedDataSource,
        });
      }
    }

    // ─── /api/products ───
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
        purgeSlug =
          (await resolveDomain(
            hostname
              .replace(/^www\./, "")
              .toLowerCase()
              .trim(),
            env,
          )) || "";
      }

      const purgeOps = [
        cache.delete(new Request("https://cache/spa-shell")).catch(() => {}),
        cache.delete(new Request("https://cache/prebuilt-head")).catch(() => {}),
      ];
      if (env?.STORE_KV) {
        purgeOps.push(env.STORE_KV.delete(SPA_SHELL_KV_KEY).catch(() => {}));
        purgeOps.push(env.STORE_KV.delete(PREBUILT_HEAD_KV_KEY).catch(() => {}));
      }
      if (purgeSlug) {
        purgeOps.push(cache.delete(new Request(`https://cache/storefront-data/${purgeSlug}`)).catch(() => {}));
        purgeOps.push(cache.delete(new Request(`https://cache/theme-lite:${purgeSlug}`)).catch(() => {}));
        if (env?.STORE_KV) {
          purgeOps.push(env.STORE_KV.delete(`storefront:${purgeSlug}`).catch(() => {}));
          purgeOps.push(env.STORE_KV.delete(`theme-lite:${purgeSlug}`).catch(() => {}));
        }
        const edgeKey = getEarlyCacheKey(hostname, "/");
        purgeOps.push(cache.delete(edgeKey).catch(() => {}));
      }
      await Promise.all(purgeOps);
      return addCorsHeaders(
        new Response(
          JSON.stringify({
            purged: true,
            key: SPA_SHELL_KV_KEY,
            slug: purgeSlug || null,
            storefrontDataPurged: !!purgeSlug,
          }),
          {
            headers: { "Content-Type": "application/json" },
          },
        ),
        "purge-shell",
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
          "purge-store-error",
        );
      }

      const purgeOps = [];
      const subDomain = `${purgeSlug}.${ROOT_DOMAIN}`;

      purgeOps.push(cache.delete(new Request(`https://cache/storefront-data/${purgeSlug}`)).catch(() => {}));
      purgeOps.push(cache.delete(new Request(`https://cache/theme-lite:${purgeSlug}`)).catch(() => {}));
      if (env?.STORE_KV) {
        purgeOps.push(env.STORE_KV.delete(`storefront:${purgeSlug}`).catch(() => {}));
        purgeOps.push(env.STORE_KV.delete(`theme-lite:${purgeSlug}`).catch(() => {}));
      }

      purgeOps.push(cache.delete(getEarlyCacheKey(subDomain, "/")).catch(() => {}));

      const subCacheKey = _buildProductsCacheKey(subDomain, {});
      purgeOps.push(cache.delete(subCacheKey).catch(() => {}));
      for (const sort of ["price_asc", "price_desc", "newest"]) {
        purgeOps.push(cache.delete(_buildProductsCacheKey(subDomain, { sort })).catch(() => {}));
      }

      const customDomain = await getCustomDomainForSlug(purgeSlug);
      if (customDomain) {
        const cleanDomain = customDomain
          .replace(/^www\./, "")
          .toLowerCase()
          .trim();
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
        new Response(
          JSON.stringify({
            purged: true,
            slug: purgeSlug,
            customDomain: customDomain || null,
            scope: "store-only",
          }),
          {
            headers: { "Content-Type": "application/json" },
          },
        ),
        "purge-store",
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

    // ─── SUPABASE API PASS-THROUGH ───
    if (url.pathname.startsWith("/api") || url.pathname.startsWith("/rest")) {
      const isStorefrontRpc = request.method === "GET" && url.pathname.includes("/rpc/get_storefront_data");

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
      const storeMatch = url.pathname.match(/^\/store\/([a-zA-Z0-9_-]+)(\/.*)?$/);

      if (storeMatch) {
        const redirectSlug = storeMatch[1];
        const remainingPath = storeMatch[2] || "";
        const customDomain = await getCustomDomainForSlug(redirectSlug);
        if (customDomain) {
          return Response.redirect(`https://${customDomain}${remainingPath}${url.search}`, 301);
        }
        return Response.redirect(`https://${redirectSlug}.${ROOT_DOMAIN}${remainingPath}${url.search}`, 301);
      }

      if (hostname === `www.${ROOT_DOMAIN}`) {
        return Response.redirect(`https://${ROOT_DOMAIN}${url.pathname}${url.search}`, 301);
      }

      return cachedFetch(request, "", ctx, false, env);
    }

    // ─── SUBDOMAIN ───
    if (hostname.endsWith(`.${ROOT_DOMAIN}`)) {
      const slug = hostname.replace(`.${ROOT_DOMAIN}`, "");

      if (!slug || slug.includes(".") || slug === "www") {
        return cachedFetch(request, "", ctx, false, env);
      }

      // Fast path: slug index check (in-memory, no KV round-trip)
      const slugIndex = await _getSlugIndex(env);
      if (slugIndex && !slugIndex.has(slug)) {
        const safeSlug = slug.replace(/[<>"'&]/g, "");
        return new Response(buildNotFoundHtml(safeSlug, ROOT_DOMAIN), {
          status: 404,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "public, max-age=60",
            ...SECURITY_HEADERS,
          },
        });
      }

      // v4.9: FULLY PARALLEL — shell + storeInfo + theme + cachedHead + products all at once
      // (storeInfo and products are fast KV reads; shell is also KV on warm isolate)
      const [shellResult, storeInfo, themeLite, cachedHead, inlineProducts] = await Promise.all([
        getSpaShell(request, ctx, env),
        _resolveStoreInfo(slug, hostname, env),
        _getThemeLite(slug, env),
        _getCachedPrebuiltHead(env),
        _getInlineProductsOrNull(hostname, slug, env, ctx),
      ]);

      // Guard checks (sync after parallel fetch)
      if (!storeInfo.storeId) {
        const safeSlug = slug.replace(/[<>"'&]/g, "");
        return new Response(buildNotFoundHtml(safeSlug, ROOT_DOMAIN), {
          status: 404,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "public, max-age=60",
            ...SECURITY_HEADERS,
          },
        });
      }

      if (storeInfo.customDomain) {
        return Response.redirect(`https://${storeInfo.customDomain}${url.pathname}${url.search}`, 301);
      }

      // SEO and bot (fast regex for normal users)
      const seoResponse = await handleSeoFiles(url, slug);
      if (seoResponse) return seoResponse;
      const botResponse = await handleBot(request, slug, url, false);
      if (botResponse) return botResponse;

      if (!shellResult?.html) {
        const response = await proxyToOrigin(request);
        return addDiagnosticHeaders(response, { slug, cacheStatus: "MISS", dataSource: "none" });
      }

      // Ensure prebuiltHead (build from shell if not in cache; typically warm)
      const prebuiltHead = cachedHead || (await getPrebuiltHead(shellResult.html, env));
      const linkHeader = _buildLinkPreloadHeader(shellResult.html);

      const responseHeaders = new Headers();
      responseHeaders.set("Content-Type", "text/html; charset=utf-8");
      responseHeaders.set("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
      responseHeaders.set("X-Store-Slug", slug);
      responseHeaders.set("X-Shell-Source", shellResult.source);
      responseHeaders.set("X-Cache-Timestamp", new Date().toISOString());
      responseHeaders.set("X-Data-Source", "streaming");
      if (linkHeader) responseHeaders.set("Link", linkHeader);
      for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
        responseHeaders.set(k, v);
      }

      // v4.9: Race storefront data (KV ~50ms, DB max 1.2s) — start BEFORE building response
      // Browser gets <head> with preload hints immediately; body arrives with full store data
      const storefrontPromise = prefetchStorefrontDataWithDeadline(slug, ctx, env, 1200);

      const response = await serveStreamedHtml(
        slug,
        shellResult,
        themeLite,
        prebuiltHead,
        inlineProducts,
        storefrontPromise,
        responseHeaders,
      );

      // Warm full HTML in edge cache in background for subsequent HIT responses
      ctx.waitUntil(_warmFullHtmlInBackground(request, shellResult, slug, ctx, env, hostname, url.pathname));

      return addDiagnosticHeaders(response, { slug, cacheStatus: "MISS", dataSource: "streaming" });
    }

    // ─── CUSTOM DOMAIN ───

    // www redirect
    if (hostname.startsWith("www.")) {
      const apex = hostname.slice(4);
      return Response.redirect(`https://${apex}${url.pathname}${url.search}`, 301);
    }

    const clientIP = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for");
    if (isRateLimited(clientIP, false)) {
      return new Response("Too Many Requests", {
        status: 429,
        headers: { "Retry-After": "60", "Content-Type": "text/plain" },
      });
    }

    const cleanDomain = hostname
      .replace(/^www\./, "")
      .toLowerCase()
      .trim();

    // v4.9: Parallel — resolve domain + shell + theme + cachedHead + products simultaneously
    const [resolvedSlug, shellResultCD, themeLiteCD, cachedHeadCD, inlineProductsCD] = await Promise.all([
      resolveDomain(cleanDomain, env),
      getSpaShell(request, ctx, env),
      // theme and products need slug — resolved after domain lookup, so we fetch them after
      // But we can still start domain resolution and shell in parallel
      Promise.resolve(null), // placeholder for themeLiteCD — resolved below
      Promise.resolve(null), // placeholder for cachedHeadCD — resolved below
      Promise.resolve(null), // placeholder for inlineProductsCD — resolved below
    ]);

    if (resolvedSlug) {
      // v4.9: Now that we have slug, fetch theme + head + products + storefront all in parallel
      const [seoResponse, botResponse, themeLiteCDReal, cachedHeadCDReal, inlineProductsCDReal] = await Promise.all([
        handleSeoFiles(url, resolvedSlug),
        handleBot(request, resolvedSlug, url, true),
        _getThemeLite(resolvedSlug, env),
        _getCachedPrebuiltHead(env),
        _getInlineProductsOrNull(hostname, resolvedSlug, env, ctx),
      ]);

      if (seoResponse) return seoResponse;
      if (botResponse) return botResponse;

      if (!shellResultCD?.html) {
        const response = await proxyToOrigin(request);
        return addDiagnosticHeaders(response, { slug: resolvedSlug, cacheStatus: "MISS", dataSource: "none" });
      }

      const prebuiltHeadCD = cachedHeadCDReal || (await getPrebuiltHead(shellResultCD.html, env));
      const linkHeaderCD = _buildLinkPreloadHeader(shellResultCD.html);

      const responseHeadersCD = new Headers();
      responseHeadersCD.set("Content-Type", "text/html; charset=utf-8");
      responseHeadersCD.set("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
      responseHeadersCD.set("X-Store-Slug", resolvedSlug);
      responseHeadersCD.set("X-Shell-Source", shellResultCD.source);
      responseHeadersCD.set("X-Cache-Timestamp", new Date().toISOString());
      responseHeadersCD.set("X-Data-Source", "streaming");
      if (linkHeaderCD) responseHeadersCD.set("Link", linkHeaderCD);
      for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
        responseHeadersCD.set(k, v);
      }

      // v4.9: Race storefront data before building streaming response
      const storefrontPromiseCD = prefetchStorefrontDataWithDeadline(resolvedSlug, ctx, env, 1200);

      const responseCD = await serveStreamedHtml(
        resolvedSlug,
        shellResultCD,
        themeLiteCDReal,
        prebuiltHeadCD,
        inlineProductsCDReal,
        storefrontPromiseCD,
        responseHeadersCD,
      );

      ctx.waitUntil(_warmFullHtmlInBackground(request, shellResultCD, resolvedSlug, ctx, env, hostname, url.pathname));

      return addDiagnosticHeaders(responseCD, {
        slug: resolvedSlug,
        cacheStatus: "MISS",
        dataSource: "streaming",
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
      },
    );
  },

  /**
   * SCHEDULED HANDLER — DB Keepalive + Store Warming
   * Runs every 5 minutes via Cloudflare Cron Trigger.
   */
  async scheduled(event, env, ctx) {
    const keepaliveStart = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_platform_config_public`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: "{}",
      });
      clearTimeout(timeout);

      const dbPingMs = Date.now() - keepaliveStart;

      // 2. Warm the SPA shell cache
      ctx.waitUntil(
        (async () => {
          try {
            await getSpaShell(new Request(`https://${ROOT_DOMAIN}/`), ctx, env);
          } catch {}
        })(),
      );

      // 3. Warm ALL active store slugs in KV + build slug index
      ctx.waitUntil(
        (async () => {
          try {
            let allStores = [];
            let offset = 0;
            const pageSize = 500;
            while (true) {
              const storesRes = await fetch(
                `${SUPABASE_URL}/rest/v1/stores_public?select=id,slug,custom_domain&is_suspended=eq.false&limit=${pageSize}&offset=${offset}&order=updated_at.desc`,
                {
                  headers: {
                    apikey: SUPABASE_ANON_KEY,
                    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                  },
                },
              );
              if (!storesRes.ok) break;
              const batch = await storesRes.json();
              if (!batch.length) break;
              allStores = allStores.concat(batch);
              if (batch.length < pageSize) break;
              offset += pageSize;
            }

            if (allStores.length === 0) return;

            const kvWrites = [];
            const allSlugs = [];
            let kvWriteCount = 0;
            let kvSkipCount = 0;

            if (env?.STORE_KV) {
              // Phase 1: Batch-read existing KV values
              const readPromises = [];
              for (const s of allStores) {
                if (!s.slug || !s.id) continue;
                allSlugs.push(s.slug);
                readPromises.push(env.STORE_KV.get(`store-info:${s.slug}`).catch(() => null));
              }
              const existingValues = await Promise.all(readPromises);

              // Phase 2: Write only changed entries (smart-write)
              for (let i = 0; i < allSlugs.length; i++) {
                const s = allStores.find((st) => st.slug === allSlugs[i]);
                if (!s) continue;

                const payload = JSON.stringify({ id: s.id, cd: s.custom_domain || null });
                const existing = existingValues[i];

                if (existing !== payload) {
                  kvWrites.push(
                    env.STORE_KV.put(`store-info:${s.slug}`, payload, { expirationTtl: STORE_INFO_KV_TTL }).catch(
                      () => {},
                    ),
                  );
                  const subDomain = `${s.slug}.${ROOT_DOMAIN}`;
                  kvWrites.push(
                    env.STORE_KV.put(`store-id:${subDomain}`, s.id, { expirationTtl: 3600 }).catch(() => {}),
                  );
                  if (s.custom_domain) {
                    const cleanCustom = s.custom_domain
                      .replace(/^www\./, "")
                      .toLowerCase()
                      .trim();
                    kvWrites.push(
                      env.STORE_KV.put(`store-id:${cleanCustom}`, s.id, { expirationTtl: 3600 }).catch(() => {}),
                    );
                    kvWrites.push(
                      env.STORE_KV.put(`domain:${cleanCustom}`, JSON.stringify({ slug: s.slug }), {
                        expirationTtl: KV_DOMAIN_TTL,
                      }).catch(() => {}),
                    );
                  }
                  kvWriteCount++;
                } else {
                  kvSkipCount++;
                }
              }
            } else {
              for (const s of allStores) {
                if (!s.slug || !s.id) continue;
                allSlugs.push(s.slug);
              }
            }

            // Write slug index (always — small payload, critical for fast-path routing)
            if (env?.STORE_KV && allSlugs.length > 0) {
              kvWrites.push(
                env.STORE_KV.put("all-active-slugs", JSON.stringify(allSlugs), { expirationTtl: 600 }).catch(() => {}),
              );
              _slugIndexSet = new Set(allSlugs);
              _slugIndexExpiresAt = Date.now() + 300_000;
            }

            if (kvWrites.length > 0) await Promise.all(kvWrites);
            console.log(
              `[keepalive] warmed ${allStores.length} stores — KV writes: ${kvWriteCount} changed, ${kvSkipCount} skipped`,
            );

            // 4. Pre-warm top 20 stores (shell + storefront + products)
            const top20 = allStores.slice(0, 20);
            const shellWarms = top20.map(async (s) => {
              try {
                const shellResult = await getSpaShell(new Request(`https://${ROOT_DOMAIN}/`), ctx, env);
                if (!shellResult?.html) return;

                const dataResult = await prefetchStorefrontData(s.slug, ctx, env);
                if (!dataResult.data) return;

                const injected = injectIntoHtml(shellResult.html, s.slug, dataResult.data, "cron-prewarm");
                const subEarlyKey = getEarlyCacheKey(`${s.slug}.${ROOT_DOMAIN}`, "/");
                const htmlResponse = new Response(injected.html, {
                  status: 200,
                  headers: {
                    "Content-Type": "text/html; charset=utf-8",
                    "Cache-Control": "public, max-age=1200, stale-while-revalidate=3600",
                    "X-Store-Slug": s.slug,
                    "X-Data-Source": "cron-prewarm",
                    ...SECURITY_HEADERS,
                  },
                });
                await cache.put(subEarlyKey, htmlResponse.clone()).catch(() => {});

                if (s.custom_domain) {
                  const cleanCustom = s.custom_domain
                    .replace(/^www\./, "")
                    .toLowerCase()
                    .trim();
                  const domEarlyKey = getEarlyCacheKey(cleanCustom, "/");
                  await cache.put(domEarlyKey, htmlResponse.clone()).catch(() => {});
                }

                if (dataResult.data?.store?.id) {
                  await _prewarmProducts(dataResult.data.store.id, s.slug, ctx, env, s.custom_domain).catch(() => {});
                }
              } catch {}
            });
            await Promise.all(shellWarms);
            console.log(`[keepalive] pre-warmed ${top20.length} store shells`);

            // 5. Warm products for remaining stores (lightweight — no shell/HTML)
            const remaining = allStores.slice(20);
            if (remaining.length > 0 && env?.STORE_KV) {
              const batchSize = 10;
              for (let i = 0; i < remaining.length; i += batchSize) {
                const batch = remaining.slice(i, i + batchSize);
                await Promise.all(
                  batch.map(async (s) => {
                    try {
                      if (!s.id || !s.slug) return;
                      await _prewarmProducts(s.id, s.slug, ctx, env, s.custom_domain).catch(() => {});
                    } catch {}
                  }),
                );
              }
              console.log(`[keepalive] warmed products for ${remaining.length} additional stores`);
            }
          } catch (err) {
            console.log(`[keepalive] store warm failed: ${err?.message || err}`);
          }
        })(),
      );

      console.log(`[keepalive] DB ping: ${dbPingMs}ms, status: ${res.status}`);
    } catch (err) {
      console.log(`[keepalive] failed: ${err?.message || err}`);
    }
  },
};
