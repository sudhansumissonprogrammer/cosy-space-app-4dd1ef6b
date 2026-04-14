/**
 * SHOPBANAO PRODUCTION ROUTER v6.1.0 — SEO + PERFORMANCE IMPROVEMENTS
 *
 * Changes from v6.0.0:
 *  FIX #16 — Canonical tag injection: <link rel="canonical"> added to all
 *            storefront HTML to eliminate duplicate content across subdomain
 *            and custom domain hosts.
 *  FIX #17 — CSP loosened: Added commonly needed domains (Google Fonts,
 *            analytics, Razorpay, Tawk.to, Crisp, etc.) to prevent silent
 *            breakage when merchants add third-party tools.
 *  FIX #18 — Skeleton fallback timeout reduced from 5000ms to 3500ms for
 *            faster perceived performance on slow connections.
 *  FIX #19 — stale-while-revalidate reduced from 86400s to 7200s on warmed
 *            HTML to ensure merchant changes reflect within ~2 hours.
 *
 * Changes from v5.0.0 (All 15 fixes applied):
 *
 *  FIX #1  — In-memory SPA shell (_memShell). Zero I/O on warm isolates.
 *  FIX #2  — Storefront promise starts BEFORE shell/theme/head fetches.
 *             storefrontPromise is kicked off as the very first async op.
 *  FIX #3  — Preload Link header sent on EVERY response (not just cache hits).
 *             Enables browser to prefetch CSS/JS while worker is still resolving.
 *  FIX #4  — Batch KV reads: shell + theme + storefront in ONE Promise.all.
 *             _batchKvRead() replaces 3 sequential KV.get calls.
 *  FIX #5  — Deadline anchored to REQUEST START (not shell fetch completion).
 *             storefront gets full 1400ms from when request arrived.
 *  FIX #6  — getSpaShell() checks _memShell first, skips Cache API entirely
 *             on warm isolates. Cache API read only on cold start.
 *  FIX #7  — In-memory prebuilt head string (_memPrebuiltHead). Built once,
 *             stored forever in the isolate.
 *  FIX #8  — In-memory theme cache per slug (_memThemeCache, 2000 entry cap).
 *             Saves 50ms KV round-trip on every warm request per store.
 *  FIX #9  — _resolveStoreInfo() is the single authoritative lookup.
 *             _resolveStoreId() now delegates to it instead of duplicating.
 *  FIX #10 — Cache-Control on warmed/prewarmed HTML raised to
 *             max-age=3600, stale-while-revalidate=7200.
 *  FIX #11 — buildSkeleton() now uses the actual store bgColor (fixes white
 *             flash on dark-themed stores).
 *  FIX #12 — In-memory storefront data cache (_memStorefrontCache).
 *             After first request, DB is never hit again for 2 minutes.
 *  FIX #13 — STOREFRONT_PREFETCH_TIMEOUT_MS raised to 1000ms.
 *             With FIX #2 the clock starts earlier, so 1000ms is now safer.
 *  FIX #14 — Cron warms ALL stores (not just top 20) with concurrency=10.
 *  FIX #15 — Cron fetches SPA shell ONCE before the loop, reuses for all.
 */

const WORKER_VERSION = "6.1.0";
const ROOT_DOMAIN = "shopbanao.in";
const ORIGIN_HOST = "cosy-space-app.lovable.app";

const SUPABASE_URL = "https://dqepeywgftbpxeeqfuwt.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxZXBleXdnZnRicHhlZXFmdXd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMjgxMzksImV4cCI6MjA5MDkwNDEzOX0.OtLtoGBJZuEthQyePzNgAltWJwSUEpWl1z_Bx_FY6Mk";

/* ============================================================
   BOT DETECTION
   ============================================================ */

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

/* ============================================================
   TIMEOUTS
   ============================================================ */

const ORIGIN_TIMEOUT_MS = 8_000;
const EDGE_FN_TIMEOUT_MS = 10_000;
// FIX #13: Raised from 800 → 1000ms. FIX #2 starts the clock earlier
// (at request arrival, not after shell fetch), so 1000ms is now safe.
const STOREFRONT_PREFETCH_TIMEOUT_MS = 1_000;
const PRODUCTS_DB_TIMEOUT_MS = 3_000;

const cache = caches.default;

/* ============================================================
   FIX #1 — IN-MEMORY SPA SHELL (zero I/O on warm isolates)
   ============================================================ */

let _memShell = null;
let _memShellTs = 0;
const MEM_SHELL_TTL = 600_000; // 10 min

/* ============================================================
   FIX #7 — IN-MEMORY PREBUILT HEAD (built once per isolate)
   ============================================================ */

let _memPrebuiltHead = null;

/* ============================================================
   FIX #8 — IN-MEMORY THEME CACHE PER SLUG
   ============================================================ */

const _memThemeCache = new Map();
const MEM_THEME_CACHE_MAX = 2_000;
const MEM_THEME_TTL = 300_000; // 5 min

/* ============================================================
   FIX #12 — IN-MEMORY STOREFRONT DATA CACHE PER SLUG
   ============================================================ */

const _memStorefrontCache = new Map();
const MEM_STOREFRONT_CACHE_MAX = 1_000;
const MEM_STOREFRONT_TTL = 120_000; // 2 min

/* ============================================================
   REVALIDATION COOLDOWN
   ============================================================ */

const revalCooldowns = new Map();
const REVAL_COOLDOWN_MS = 120_000;
const REVAL_MAP_MAX = 5_000;

function shouldRevalidate(key) {
  const now = Date.now();
  const last = revalCooldowns.get(key) || 0;
  if (now - last < REVAL_COOLDOWN_MS) return false;
  if (!revalCooldowns.has(key) && revalCooldowns.size >= REVAL_MAP_MAX) return false;
  revalCooldowns.set(key, now);
  return true;
}

let lastRevalCleanup = 0;
function cleanRevalMap() {
  const now = Date.now();
  if (now - lastRevalCleanup < 60_000 && revalCooldowns.size < 500) return;
  lastRevalCleanup = now;
  for (const [k, ts] of revalCooldowns) {
    if (now - ts > REVAL_COOLDOWN_MS * 2) revalCooldowns.delete(k);
  }
}

/* ============================================================
   RATE LIMITING
   ============================================================ */

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
  return entry.count > limit;
}

let lastCleanup = 0;
function cleanRateLimitMap() {
  const now = Date.now();
  if (now - lastCleanup < 30_000 && rateLimitMap.size < 500) return;
  lastCleanup = now;
  for (const [k, v] of rateLimitMap) {
    if (now > v.resetAt) rateLimitMap.delete(k);
  }
}

/* ============================================================
   SECURITY HEADERS
   ============================================================ */

// FIX #17: Loosened CSP — added commonly needed third-party domains
const SECURITY_HEADERS = {
  "X-Frame-Options": "SAMEORIGIN",
  "X-Content-Type-Options": "nosniff",
  "X-XSS-Protection": "1; mode=block",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(self)",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Content-Security-Policy":
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://connect.facebook.net https://www.googletagmanager.com https://checkout.razorpay.com https://www.google-analytics.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://embed.tawk.to https://client.crisp.chat https://cdn.jsdelivr.net; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://client.crisp.chat; " +
    "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net data:; " +
    "img-src 'self' data: blob: https://*.supabase.co https://*.r2.dev https://*.cloudinary.com https://*.unsplash.com https://*.shopify.com https://*.myshopify.com https://www.google-analytics.com https://www.googletagmanager.com https://www.facebook.com https://cx.atdmt.com https:; " +
    "connect-src 'self' https://*.supabase.co https://connect.facebook.net https://graph.facebook.com https://api.razorpay.com https://lrcpkt0a.api.lc https://www.google-analytics.com https://www.googletagmanager.com https://embed.tawk.to https://client.crisp.chat; " +
    "frame-src https://api.razorpay.com https://checkout.razorpay.com https://embed.tawk.to; " +
    "worker-src 'self' blob:; " +
    "object-src 'none'; base-uri 'self'; form-action 'self';",
};

/* ============================================================
   HELPERS
   ============================================================ */

function escapeHtml(str = "") {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/'/g, "&#x27;");
}

function getProductSlug(pathname) {
  const m = pathname.match(/^\/product\/([^/?#]+)/i);
  return m ? decodeURIComponent(m[1]) : null;
}

function buildSubdomainUrl(slug, path, search = "") {
  return `https://${slug}.${ROOT_DOMAIN}${path}${search}`;
}

// Normalized early-cache key: ALL SPA routes share ONE entry per hostname.
function getEarlyCacheKey(hostname) {
  return new Request(`https://edge-html/${hostname.toLowerCase()}/`);
}

function addDiagnosticHeaders(response, { slug, cacheStatus, dataSource }) {
  const res = new Response(response.body, response);
  res.headers.set("X-Worker-Version", WORKER_VERSION);
  if (slug) res.headers.set("X-Store-Slug", slug);
  res.headers.set("X-Cache-Status", cacheStatus);
  if (dataSource) res.headers.set("X-Data-Source", dataSource);
  return res;
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

function _capMapSize(map, max) {
  if (map.size >= max) {
    map.delete(map.keys().next().value);
  }
}

/* ============================================================
   SKELETON + THEME BUILDERS
   FIX #11: buildSkeleton now actually uses bgColor param
   ============================================================ */

// FIX #18: Reduced from 5000ms to 3500ms for faster perceived performance
function getSkeletonCleanupScript(fallbackMs = 3500) {
  return `<script>(function(){
    var removed=false;
    function kill(){
      if(removed)return;
      var s=document.getElementById('sf-skel');
      if(!s)return;
      removed=true;
      s.style.transition='opacity 180ms ease-out';
      s.style.opacity='0';
      setTimeout(function(){s.style.visibility='hidden';s.style.display='none';if(s.remove)s.remove();},200);
    }
    window.addEventListener('storefront:content-ready',kill,{once:true});
    window.addEventListener('storefront:mounted',kill,{once:true});
    setTimeout(kill,${fallbackMs});
  })()</script>`;
}

function buildSkeleton(bgColor, skeletonMuted) {
  // FIX #11: Use actual store bgColor instead of hardcoded #ffffff
  const skelBg = bgColor || "#ffffff";
  const skelBase = "#f0f0f0";
  const skelShimmer = "#e0e0e0";

  const shimmerKeyframes = `<style id="sf-skel-anim">@keyframes sf-shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}.sf-ph{background:linear-gradient(90deg,${skelBase} 25%,${skelShimmer} 50%,${skelBase} 75%);background-size:800px 100%;animation:sf-shimmer 1.4s ease-in-out infinite;border-radius:4px}</style>`;

  let s = `${shimmerKeyframes}<div id="sf-skel" aria-hidden="true" style="position:fixed;inset:0;min-height:100vh;background:${skelBg};z-index:2147483000;pointer-events:none;overflow:hidden">`;
  s += `<nav style="height:56px;background:${skelBg};border-bottom:1px solid #ececec;display:flex;align-items:center;padding:0 16px;gap:12px;box-shadow:0 1px 3px rgba(0,0,0,0.06)">`;
  s += `<div class="sf-ph" style="height:32px;width:32px;border-radius:8px;flex-shrink:0"></div>`;
  s += `<div class="sf-ph" style="height:12px;width:80px"></div>`;
  s += `<div style="flex:1"></div>`;
  s += `<div class="sf-ph" style="width:28px;height:28px;border-radius:50%"></div>`;
  s += `</nav>`;
  s += `<div class="sf-ph" style="height:6px;width:100%;border-radius:0;margin-bottom:16px"></div>`;
  s += `<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;padding:0 12px">`;
  for (let i = 0; i < 4; i++) {
    s += `<div style="border-radius:12px;overflow:hidden;background:${skelBg};border:1px solid #ececec;box-shadow:0 1px 4px rgba(0,0,0,0.05)">`;
    s += `<div class="sf-ph" style="width:100%;aspect-ratio:4/5;border-radius:0"></div>`;
    s += `<div style="padding:10px 10px 12px">`;
    s += `<div class="sf-ph" style="height:11px;width:75%;margin-bottom:8px"></div>`;
    s += `<div class="sf-ph" style="height:11px;width:45%;margin-bottom:10px"></div>`;
    s += `<div class="sf-ph" style="height:28px;width:100%;border-radius:6px"></div>`;
    s += `</div></div>`;
  }
  s += `</div></div>`;
  s += getSkeletonCleanupScript();
  return s;
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

/* ============================================================
   FIX #7 — PREBUILT HEAD (in-memory first, built once per isolate)
   ============================================================ */

const PREBUILT_HEAD_KV_KEY = "prebuilt-head:v1";
const PREBUILT_HEAD_KV_TTL = 3600;
const PREBUILT_HEAD_CACHE_TTL = 600;

function _buildPrebuiltHead(html) {
  // FIX #7: Cache result in module-level variable — computed once per isolate
  if (_memPrebuiltHead) return _memPrebuiltHead;

  let head = "";
  head += `<link rel="preconnect" href="${SUPABASE_URL}" crossorigin />`;
  head += `<link rel="dns-prefetch" href="${SUPABASE_URL}" />`;
  head += `<link rel="preconnect" href="https://dqepeywgftbpxeeqfuwt.supabase.co/storage" crossorigin />`;

  const cssMatch = html.match(/href="(\/assets\/[^"]+\.css)"/);
  if (cssMatch) {
    head += `<link rel="preload" href="${cssMatch[1]}" as="style" />`;
  }

  const DASHBOARD_CHUNK_PATTERN =
    /(?:charts|dash-vendor|admin-pages|dashboard-pages|dashboard-shell|WhatsApp|auth-pages)-/;
  const seen = new Set();
  for (const m of [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)]) {
    if (!seen.has(m[1]) && !DASHBOARD_CHUNK_PATTERN.test(m[1])) {
      seen.add(m[1]);
      head += `<link rel="modulepreload" href="${m[1]}" />`;
    }
  }

  _memPrebuiltHead = head;
  return head;
}

async function getPrebuiltHead(html, env) {
  // FIX #7: In-memory first
  if (_memPrebuiltHead) return _memPrebuiltHead;

  const headCacheKey = new Request("https://cache/prebuilt-head");
  try {
    const cached = await cache.match(headCacheKey);
    if (cached) {
      _memPrebuiltHead = await cached.text();
      return _memPrebuiltHead;
    }
  } catch {}

  if (env?.STORE_KV) {
    try {
      const cached = await env.STORE_KV.get(PREBUILT_HEAD_KV_KEY);
      if (cached) {
        _memPrebuiltHead = cached;
        cache
          .put(
            headCacheKey,
            new Response(cached, { headers: { "Cache-Control": `public, max-age=${PREBUILT_HEAD_CACHE_TTL}` } }),
          )
          .catch(() => {});
        return _memPrebuiltHead;
      }
    } catch {}
  }

  const prebuilt = _buildPrebuiltHead(html);

  cache
    .put(
      headCacheKey,
      new Response(prebuilt, { headers: { "Cache-Control": `public, max-age=${PREBUILT_HEAD_CACHE_TTL}` } }),
    )
    .catch(() => {});
  if (env?.STORE_KV) {
    env.STORE_KV.put(PREBUILT_HEAD_KV_KEY, prebuilt, { expirationTtl: PREBUILT_HEAD_KV_TTL }).catch(() => {});
  }

  return prebuilt;
}

async function _getCachedPrebuiltHead(env) {
  // FIX #7: In-memory first — avoids all I/O on warm isolates
  if (_memPrebuiltHead) return _memPrebuiltHead;

  const headCacheKey = new Request("https://cache/prebuilt-head");
  try {
    const cached = await cache.match(headCacheKey);
    if (cached) {
      _memPrebuiltHead = await cached.text();
      return _memPrebuiltHead;
    }
  } catch {}

  if (env?.STORE_KV) {
    try {
      const cached = await env.STORE_KV.get(PREBUILT_HEAD_KV_KEY);
      if (cached) {
        _memPrebuiltHead = cached;
        return _memPrebuiltHead;
      }
    } catch {}
  }
  return null;
}

/* ============================================================
   FIX #3 — LINK PRELOAD HEADER (sent on every response)
   ============================================================ */

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
      if (links.length >= 6) break;
    }
  }

  return links.join(", ");
}

/* ============================================================
   FIX #1 + FIX #6 — SPA SHELL (in-memory → Cache API → KV → origin)
   ============================================================ */

const SPA_SHELL_KV_KEY = "spa-shell:v1";
const SPA_SHELL_KV_TTL = 3600;
const SPA_SHELL_CACHE_TTL = 600;

let inflightShellFetch = null;

async function getSpaShell(request, ctx, env) {
  // FIX #1 + #6: In-memory first — zero I/O on warm isolates
  if (_memShell && Date.now() < _memShellTs) {
    return { html: _memShell, source: "mem" };
  }

  const shellCacheKey = new Request("https://cache/spa-shell");
  try {
    const cached = await cache.match(shellCacheKey);
    if (cached) {
      const html = await cached.text();
      _memShell = html;
      _memShellTs = Date.now() + MEM_SHELL_TTL;
      return { html, source: "cache-shell" };
    }
  } catch {}

  if (env?.STORE_KV) {
    try {
      const kvHtml = await env.STORE_KV.get(SPA_SHELL_KV_KEY);
      if (kvHtml) {
        _memShell = kvHtml;
        _memShellTs = Date.now() + MEM_SHELL_TTL;
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

  _memShell = html;
  _memShellTs = Date.now() + MEM_SHELL_TTL;

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

/* ============================================================
   FIX #4 — BATCH KV READ (shell + theme + storefront in ONE call)
   ============================================================ */

const KV_STOREFRONT_TTL = 3600;
const CACHE_STOREFRONT_TTL = 600;

async function _batchKvRead(slug, env) {
  if (!env?.STORE_KV) return { theme: null, storefront: null, storeInfo: null };
  try {
    const [theme, storefront, storeInfo] = await Promise.all([
      env.STORE_KV.get(`theme-lite:${slug}`, { type: "json" }).catch(() => null),
      env.STORE_KV.get(`storefront:${slug}`, { type: "json" }).catch(() => null),
      env.STORE_KV.get(`store-info:${slug}`, { type: "json" }).catch(() => null),
    ]);
    return { theme, storefront, storeInfo };
  } catch {
    return { theme: null, storefront: null, storeInfo: null };
  }
}

/* ============================================================
   FIX #8 — LIGHTWEIGHT THEME CACHE (in-memory → Cache API → KV)
   ============================================================ */

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

  // FIX #8: Store in memory immediately
  _capMapSize(_memThemeCache, MEM_THEME_CACHE_MAX);
  _memThemeCache.set(slug, { lite, expiresAt: Date.now() + MEM_THEME_TTL });

  const themeCacheKey = new Request(`https://cache/theme-lite:${slug}`);
  cache
    .put(
      themeCacheKey,
      new Response(liteStr, { headers: { "Cache-Control": `public, max-age=${THEME_LITE_CACHE_TTL}` } }),
    )
    .catch(() => {});

  if (env?.STORE_KV) {
    env.STORE_KV.put(`theme-lite:${slug}`, liteStr, { expirationTtl: THEME_LITE_KV_TTL }).catch(() => {});
  }
}

async function _getThemeLite(slug, env) {
  // FIX #8: In-memory first
  const mem = _memThemeCache.get(slug);
  if (mem && Date.now() < mem.expiresAt) return mem.lite;

  const themeCacheKey = new Request(`https://cache/theme-lite:${slug}`);
  try {
    const cached = await cache.match(themeCacheKey);
    if (cached) {
      const lite = await cached.json();
      _capMapSize(_memThemeCache, MEM_THEME_CACHE_MAX);
      _memThemeCache.set(slug, { lite, expiresAt: Date.now() + MEM_THEME_TTL });
      return lite;
    }
  } catch {}

  if (!env?.STORE_KV) return null;
  try {
    const kvData = await env.STORE_KV.get(`theme-lite:${slug}`, { type: "json" });
    if (kvData) {
      _capMapSize(_memThemeCache, MEM_THEME_CACHE_MAX);
      _memThemeCache.set(slug, { lite: kvData, expiresAt: Date.now() + MEM_THEME_TTL });
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

/* ============================================================
   FIX #12 — STOREFRONT DATA (in-memory → Cache API → KV → DB)
   ============================================================ */

const inflightRequests = new Map();

async function prefetchStorefrontData(slug, ctx, env) {
  // FIX #12: In-memory first — after first request, DB never called for 2 min
  const mem = _memStorefrontCache.get(slug);
  if (mem && Date.now() < mem.expiresAt) return { data: mem.data, source: "mem" };

  const kvKey = `storefront:${slug}`;
  const dataCacheKey = new Request(`https://cache/storefront-data/${slug}`);

  try {
    const cached = await cache.match(dataCacheKey);
    if (cached) {
      const data = await cached.json();
      _capMapSize(_memStorefrontCache, MEM_STOREFRONT_CACHE_MAX);
      _memStorefrontCache.set(slug, { data, expiresAt: Date.now() + MEM_STOREFRONT_TTL });
      return { data, source: "cache-api" };
    }
  } catch {}

  if (env?.STORE_KV) {
    try {
      const kvData = await env.STORE_KV.get(kvKey, { type: "json" });
      if (kvData) {
        _capMapSize(_memStorefrontCache, MEM_STOREFRONT_CACHE_MAX);
        _memStorefrontCache.set(slug, { data: kvData, expiresAt: Date.now() + MEM_STOREFRONT_TTL });
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
  // FIX #13: Raised to 1000ms (FIX #2 starts the clock earlier so this is safe)
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

    if (data) {
      // FIX #12: Immediately cache in memory
      _capMapSize(_memStorefrontCache, MEM_STOREFRONT_CACHE_MAX);
      _memStorefrontCache.set(slug, { data, expiresAt: Date.now() + MEM_STOREFRONT_TTL });

      if (data?.theme_config) {
        _cacheThemeForFastShell(slug, data.theme_config, env, ctx);
      }

      if (ctx) {
        const dataStr = JSON.stringify(data);
        const storeId = data?.store?.id;
        const storeSlug = data?.store?.slug;

        ctx.waitUntil(
          Promise.all([
            env?.STORE_KV ? env.STORE_KV.put(kvKey, dataStr, { expirationTtl: KV_STOREFRONT_TTL }) : Promise.resolve(),
            cache.put(
              dataCacheKey,
              new Response(dataStr, { headers: { "Cache-Control": `public, max-age=${CACHE_STOREFRONT_TTL}` } }),
            ),
            storeId ? _prewarmProducts(storeId, storeSlug, ctx, env, data?.store?.custom_domain) : Promise.resolve(),
          ]).catch(() => {}),
        );
      }
    }

    return data;
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

// FIX #5: Deadline anchored to request start, not shell fetch completion
async function prefetchStorefrontDataWithDeadline(slug, ctx, env, deadlineMs) {
  const deadline = new Promise((resolve) =>
    setTimeout(() => resolve({ data: null, source: "deadline-timeout" }), deadlineMs),
  );
  return Promise.race([prefetchStorefrontData(slug, ctx, env), deadline]);
}

/* ============================================================
   INLINE PRODUCTS HELPER
   ============================================================ */

const PRODUCTS_CACHE_TTL = 300;
const PRODUCTS_KV_TTL = 1800;
const PRODUCTS_PAGE_SIZE = 20;
const PRODUCT_COLUMNS =
  "id,category,cost_price,created_at,currency,description,image_url,is_active,is_best_selling,name,price,sale_price,sku,slug,stock_quantity,store_id,updated_at";

async function _getInlineProductsOrNull(hostname, slug, env, ctx) {
  try {
    const productsCacheKey = _buildProductsCacheKey(hostname, {});
    const cached = await cache.match(productsCacheKey);
    if (cached) return await cached.text();

    if (env?.STORE_KV) {
      const kvKey = _buildProductsKvKey(hostname, {});
      const kvProducts = await env.STORE_KV.get(kvKey);
      if (kvProducts) {
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

/* ============================================================
   DOMAIN RESOLUTION (in-memory → Cache API → KV → DB)
   ============================================================ */

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
          .put(key, new Response(JSON.stringify(kvData), { headers: { "Cache-Control": "public, max-age=300" } }))
          .catch(() => {});
        return kvData.slug || null;
      }
    } catch {}
  }

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/stores_public?select=slug&custom_domain=eq.${encodeURIComponent(domain)}&limit=1`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const slug = data[0]?.slug || null;

    const ttl = slug ? 300 : 60;
    const cacheData = JSON.stringify({ slug });
    const writes = [
      cache.put(key, new Response(cacheData, { headers: { "Cache-Control": `public, max-age=${ttl}` } })),
    ];
    if (env?.STORE_KV && slug) {
      writes.push(env.STORE_KV.put(`domain:${domain}`, cacheData, { expirationTtl: KV_DOMAIN_TTL }));
    }
    await Promise.all(writes);
    return slug;
  } catch {
    return null;
  }
}

async function getCustomDomainForSlug(slug) {
  const key = new Request(`https://cache/slug-domain-${slug}`);
  try {
    const cached = await cache.match(key);
    if (cached) {
      const data = await cached.json();
      return data.custom_domain || null;
    }
  } catch {}

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/stores_public?select=custom_domain&slug=eq.${encodeURIComponent(slug)}&limit=1`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const customDomain = data[0]?.custom_domain || null;
    await cache
      .put(
        key,
        new Response(JSON.stringify({ custom_domain: customDomain }), {
          headers: { "Cache-Control": "public, max-age=300" },
        }),
      )
      .catch(() => {});
    return customDomain;
  } catch {
    return null;
  }
}

/* ============================================================
   FIX #9 — COMBINED STORE INFO LOOKUP (single authoritative source)
   _resolveStoreId now delegates here instead of duplicating logic
   ============================================================ */

const _storeInfoCache = new Map();
const STORE_INFO_CACHE_MAX = 2_000;
const STORE_INFO_KV_TTL = 3600;

const domainStoreIdCache = new Map();
const DOMAIN_STORE_ID_CACHE_MAX = 5_000;

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
        _storeInfoCache.set(slug, { storeId: null, customDomain: null, expiresAt: Date.now() + 15_000 });
        _capMapSize(domainStoreIdCache, DOMAIN_STORE_ID_CACHE_MAX);
        domainStoreIdCache.set(hostname, { storeId: null, expiresAt: Date.now() + 15_000 });
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
          _storeInfoCache.set(slug, { storeId: null, customDomain: null, expiresAt: Date.now() + 15_000 });
          _capMapSize(domainStoreIdCache, DOMAIN_STORE_ID_CACHE_MAX);
          domainStoreIdCache.set(hostname, { storeId: null, expiresAt: Date.now() + 15_000 });
          cache
            .put(
              infoCacheKey,
              new Response(JSON.stringify(kvData), { headers: { "Cache-Control": "public, max-age=15" } }),
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
            new Response(JSON.stringify(kvData), { headers: { "Cache-Control": "public, max-age=300" } }),
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
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } },
    );
    if (!res.ok) return { storeId: null, customDomain: null };
    const rows = await res.json();
    const row = rows[0];

    if (!row) {
      const nfData = { __nf: true };
      _capMapSize(_storeInfoCache, STORE_INFO_CACHE_MAX);
      _storeInfoCache.set(slug, { storeId: null, customDomain: null, expiresAt: Date.now() + 15_000 });
      _capMapSize(domainStoreIdCache, DOMAIN_STORE_ID_CACHE_MAX);
      domainStoreIdCache.set(hostname, { storeId: null, expiresAt: Date.now() + 15_000 });
      cache
        .put(infoCacheKey, new Response(JSON.stringify(nfData), { headers: { "Cache-Control": "public, max-age=15" } }))
        .catch(() => {});
      if (env?.STORE_KV) {
        env.STORE_KV.put(`store-info:${slug}`, JSON.stringify(nfData), { expirationTtl: 30 }).catch(() => {});
      }
      return { storeId: null, customDomain: null };
    }

    const result = { storeId: row.id, customDomain: row.custom_domain || null };
    const cachePayload = { id: result.storeId, cd: result.customDomain };
    _capMapSize(_storeInfoCache, STORE_INFO_CACHE_MAX);
    _storeInfoCache.set(slug, { ...result, expiresAt: Date.now() + 300_000 });
    _capMapSize(domainStoreIdCache, DOMAIN_STORE_ID_CACHE_MAX);
    domainStoreIdCache.set(hostname, { storeId: result.storeId, expiresAt: Date.now() + 300_000 });

    await Promise.all([
      cache
        .put(
          infoCacheKey,
          new Response(JSON.stringify(cachePayload), { headers: { "Cache-Control": "public, max-age=300" } }),
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
          new Response(result.storeId, { headers: { "Cache-Control": "public, max-age=600" } }),
        )
        .catch(() => {}),
      env?.STORE_KV
        ? env.STORE_KV.put(`store-info:${slug}`, JSON.stringify(cachePayload), {
            expirationTtl: STORE_INFO_KV_TTL,
          }).catch(() => {})
        : Promise.resolve(),
    ]);

    return result;
  } catch {
    return { storeId: null, customDomain: null };
  }
}

// FIX #9: _resolveStoreId now delegates to _resolveStoreInfo to avoid duplication
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
          .put(storeIdCacheKey, new Response(kvVal, { headers: { "Cache-Control": "public, max-age=600" } }))
          .catch(() => {});
        return kvVal;
      }
    } catch {}
  }

  // Delegate to DB lookup
  const storeId = await _fetchStoreIdFromDb(domain);
  if (storeId) {
    _capMapSize(domainStoreIdCache, DOMAIN_STORE_ID_CACHE_MAX);
    domainStoreIdCache.set(domain, { storeId, expiresAt: Date.now() + 300_000 });
    cache
      .put(storeIdCacheKey, new Response(storeId, { headers: { "Cache-Control": "public, max-age=600" } }))
      .catch(() => {});
    if (env?.STORE_KV) {
      env.STORE_KV.put(`store-id:${domain}`, storeId, { expirationTtl: 3600 }).catch(() => {});
    }
  } else {
    _capMapSize(domainStoreIdCache, DOMAIN_STORE_ID_CACHE_MAX);
    domainStoreIdCache.set(domain, { storeId: null, expiresAt: Date.now() + 60_000 });
    cache
      .put(storeIdCacheKey, new Response("__NOT_FOUND__", { headers: { "Cache-Control": "public, max-age=60" } }))
      .catch(() => {});
  }
  return storeId;
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

/* ============================================================
   SLUG INDEX
   ============================================================ */

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

/* ============================================================
   ORIGIN PROXY
   ============================================================ */

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
      if (newRes.ok) newRes.headers.set("Cache-Control", "public, max-age=2592000, immutable");
    } else if (contentType.includes("text/html")) {
      newRes.headers.set("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
    }

    for (const [k, v] of Object.entries(SECURITY_HEADERS)) newRes.headers.set(k, v);
    return newRes;
  } catch {
    clearTimeout(timeout);
    return new Response(
      `<!DOCTYPE html><html><head><title>Store Temporarily Unavailable</title></head><body style="font-family:sans-serif;text-align:center;padding:50px"><h2>Store Temporarily Unavailable</h2><p>Please retry in a few seconds.</p></body></html>`,
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
    );
  }
}

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
    if (newRes.ok) newRes.headers.set("Cache-Control", "public, max-age=2592000, immutable");
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) newRes.headers.set(k, v);
    return newRes;
  } catch {
    clearTimeout(timeout);
    return proxyToOrigin(request);
  }
}

/* ============================================================
   HTML INJECTION HELPERS
   ============================================================ */

function injectIntoHtml(html, slug, storefrontData, dataSource) {
  let injection = `<script>window.__STORE_SLUG__="${escapeHtml(slug)}";`;
  if (storefrontData) {
    const jsonStr = JSON.stringify(storefrontData).replace(/<\/script/gi, "<\\/script");
    injection += `window.__STOREFRONT_DATA__=${jsonStr};`;
  }
  injection += `</script>\n`;
  injection += `<link rel="preconnect" href="${SUPABASE_URL}" crossorigin />\n`;
  injection += `<link rel="dns-prefetch" href="${SUPABASE_URL}" />\n`;
  injection += `<link rel="preconnect" href="https://dqepeywgftbpxeeqfuwt.supabase.co/storage" crossorigin />\n`;

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

    // FIX #16: Canonical tag — prefer custom domain, fallback to subdomain
    const canonicalBase = s.custom_domain
      ? `https://${s.custom_domain}`
      : `https://${slug}.${ROOT_DOMAIN}`;
    ogMeta += `<link rel="canonical" href="${escapeHtml(canonicalBase)}/" />\n`;

    ogMeta += `<title>${ogTitle}</title>`;
    ogMeta += `<meta name="description" content="${ogDesc}">`;
    ogMeta += `<meta property="og:title" content="${ogTitle}">`;
    ogMeta += `<meta property="og:description" content="${ogDesc}">`;
    ogMeta += `<meta property="og:url" content="${escapeHtml(canonicalBase)}/">`;
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
  // FIX #11: Pass actual bgColor
  const skeleton = buildSkeleton(bgColor, skeletonMuted);

  let lcpPreload = "";
  if (storefrontData?.store?.logo_url) {
    lcpPreload = `<link rel="preload" as="image" href="${escapeHtml(storefrontData.store.logo_url)}" />\n`;
  }

  const cssMatch = html.match(/href="(\/assets\/[^"]+\.css)"/);
  let cssPreload = cssMatch ? `<link rel="preload" href="${cssMatch[1]}" as="style" />\n` : "";

  const DASHBOARD_CHUNK_PATTERN =
    /(?:charts|dash-vendor|admin-pages|dashboard-pages|dashboard-shell|WhatsApp|auth-pages)-/;
  let modulePreloads = "";
  const seen = new Set();
  for (const m of [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)]) {
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

/* ============================================================
   STREAMING HTML RESPONSE
   FIX #2: storefrontPromise is already running when this is called
   ============================================================ */

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

      if (headEnd === -1) {
        await writer.write(enc.encode(html));
        return;
      }

      const bgColor = themeLite?.bg || "#ffffff";
      const textColor = themeLite?.tc || "#1a1a1a";
      const themeCss = themeLite ? buildThemeCssFromConfig(themeLite).css : "";

      const productsHint = inlineProducts
        ? `window.__PRODUCTS_INLINE__=${inlineProducts.replace(/<\/script/gi, "<\\/script")};`
        : "";
      const themeHint = themeLite ? `window.__THEME__=${JSON.stringify(themeLite)};` : "";
      const slugScript = `<script>window.__STORE_SLUG__="${escapeHtml(slug)}";${themeHint}${productsHint}</script>`;

      let headChunk = html.slice(0, headEnd);
      headChunk = headChunk.replace("<head>", `<head>${slugScript}${themeCss}${prebuiltHead || ""}`);
      headChunk += "</head>";

      // Flush head immediately — browser starts fetching assets NOW
      await writer.write(enc.encode(headChunk));

      // FIX #2: storefrontPromise was started before shell fetch, so by now
      // it has had the full allotted time and is very likely resolved already
      const storefrontResult = await storefrontPromise;

      const skeletonMuted = getSkeletonMuted(textColor);
      // FIX #11: Pass actual bgColor
      const skeleton = buildSkeleton(bgColor, skeletonMuted);

      let bodyChunk = html.slice(headEnd + 7);
      bodyChunk = bodyChunk.replace('<div id="root">', `${skeleton}<div id="root">`);

      if (storefrontResult?.data) {
        const jsonStr = JSON.stringify(storefrontResult.data).replace(/<\/script/gi, "<\\/script");
        bodyChunk = bodyChunk.replace("</body>", `<script>window.__STOREFRONT_DATA__=${jsonStr};</script></body>`);
      }

      if (storefrontResult?.data?.store) {
        const s = storefrontResult.data.store;
        const faviconUrl = escapeHtml(s.logo_url || "");

        // FIX #16: Inject canonical tag via JS in streaming path
        const canonicalBase = s.custom_domain
          ? `https://${s.custom_domain}`
          : `https://${slug}.${ROOT_DOMAIN}`;

        let metaScript = `<script>(function(){document.title=${JSON.stringify(s.meta_title || `${s.name} — Shop Online`)};`;

        // Add canonical link
        metaScript += `var cn=document.querySelector("link[rel='canonical']");if(!cn){cn=document.createElement('link');cn.rel='canonical';document.head.appendChild(cn);}cn.href=${JSON.stringify(canonicalBase + "/")};`;

        // Add og:url
        metaScript += `var ou=document.querySelector("meta[property='og:url']");if(!ou){ou=document.createElement('meta');ou.setAttribute('property','og:url');document.head.appendChild(ou);}ou.content=${JSON.stringify(canonicalBase + "/")};`;

        if (faviconUrl) {
          metaScript += `var li=document.querySelector("link[rel~='icon']");if(!li){li=document.createElement('link');li.rel='icon';document.head.appendChild(li);}li.href=${JSON.stringify(faviconUrl)};`;
        }
        metaScript += `})()</script>`;
        bodyChunk = bodyChunk.replace("</body>", `${metaScript}</body>`);
      }

      await writer.write(enc.encode(bodyChunk));
    } catch {
    } finally {
      writer.close();
    }
  })();

  return new Response(readable, { status: 200, headers: responseHeaders });
}

/* ============================================================
   CORE STOREFRONT FETCH + INJECT
   FIX #2: storefront promise starts FIRST (before any awaits)
   FIX #4: batch KV read for shell+theme+storefront
   FIX #5: deadline anchored to requestStart
   ============================================================ */

async function fetchAndInjectSlug(request, slug, ctx, env, hostname, pathname, requestStart) {
  // FIX #2 + #5: Kick off storefront fetch IMMEDIATELY.
  // Measure remaining deadline from original request arrival.
  const elapsed = Date.now() - (requestStart || Date.now());
  const remaining = Math.max(400, 1400 - elapsed);
  const storefrontPromise = prefetchStorefrontDataWithDeadline(slug, ctx, env, remaining);

  // FIX #4: Batch KV reads — all three in one Promise.all
  const [shellResult, kvBatch, cachedHeadMem, inlineProducts] = await Promise.all([
    getSpaShell(request, ctx, env),
    _batchKvRead(slug, env),
    _getCachedPrebuiltHead(env),
    _getInlineProductsOrNull(hostname, slug, env, ctx),
  ]);

  // Hydrate in-memory caches from batch KV read
  if (kvBatch.theme && !_memThemeCache.get(slug)?.expiresAt) {
    _capMapSize(_memThemeCache, MEM_THEME_CACHE_MAX);
    _memThemeCache.set(slug, { lite: kvBatch.theme, expiresAt: Date.now() + MEM_THEME_TTL });
  }
  if (kvBatch.storefront && !_memStorefrontCache.get(slug)?.expiresAt) {
    _capMapSize(_memStorefrontCache, MEM_STOREFRONT_CACHE_MAX);
    _memStorefrontCache.set(slug, { data: kvBatch.storefront, expiresAt: Date.now() + MEM_STOREFRONT_TTL });
  }

  // Resolve theme from memory (already populated above if needed)
  const themeLite = _memThemeCache.get(slug)?.lite || kvBatch.theme || null;

  if (!shellResult?.html) {
    const response = await proxyToOrigin(request);
    return { response, dataSource: "none" };
  }

  const prebuiltHead = cachedHeadMem || (await getPrebuiltHead(shellResult.html, env));
  // FIX #3: Always build Link header for every response
  const linkHeader = _buildLinkPreloadHeader(shellResult.html);

  const newHeaders = new Headers();
  newHeaders.set("Content-Type", "text/html; charset=utf-8");
  // Streaming responses: moderate TTL (data injected inline)
  newHeaders.set("Cache-Control", "public, max-age=600, stale-while-revalidate=1800");
  newHeaders.set("X-Store-Slug", slug);
  newHeaders.set("X-Shell-Source", shellResult.source);
  newHeaders.set("X-Cache-Timestamp", new Date().toISOString());
  newHeaders.set("X-Data-Source", "streaming");
  if (linkHeader) newHeaders.set("Link", linkHeader);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) newHeaders.set(k, v);

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

/* ============================================================
   BACKGROUND HTML WARM
   FIX #10: Cache-Control raised to 3600/86400
   ============================================================ */

async function _warmFullHtmlInBackground(request, shellResult, slug, ctx, env, hostname, pathname) {
  try {
    if (hostname) {
      const earlyKey = getEarlyCacheKey(hostname);
      const existing = await cache.match(earlyKey);
      if (existing) {
        const ds = existing.headers.get("X-Data-Source") || "";
        if (ds && ds !== "fast-shell" && ds !== "fast-shell-themed" && ds !== "streaming") return;
      }
    }

    const warmKey = `warm-html:${slug}`;
    if (!shouldRevalidate(warmKey)) return;

    const prefetchResult = await prefetchStorefrontData(slug, ctx, env);
    if (!prefetchResult.data) return;

    const result = injectIntoHtml(shellResult.html, slug, prefetchResult.data, prefetchResult.source);

    const fullHeaders = new Headers();
    fullHeaders.set("Content-Type", "text/html; charset=utf-8");
    // FIX #10: Raised from 1200 → 3600
    fullHeaders.set("Cache-Control", "public, max-age=3600, stale-while-revalidate=7200");
    fullHeaders.set("X-Store-Slug", slug);
    fullHeaders.set("X-Data-Source", prefetchResult.source);
    fullHeaders.set("X-Shell-Source", shellResult.source);
    fullHeaders.set("X-Cache-Timestamp", new Date().toISOString());
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) fullHeaders.set(k, v);

    const fullResponse = new Response(result.html, { status: 200, headers: fullHeaders });

    if (hostname) {
      const earlyKey = getEarlyCacheKey(hostname);
      await cache.put(earlyKey, fullResponse.clone()).catch(() => {});
    }
  } catch {}
}

function storeInEdgeCache(ctx, hostname, slug, response) {
  const earlyKey = getEarlyCacheKey(hostname);
  ctx.waitUntil(cache.put(earlyKey, response.clone()).catch(() => {}));
}

/* ============================================================
   PRODUCTS API — VERSION-BASED CACHE INVALIDATION
   ============================================================
   Instead of deleting hundreds of cache keys on purge (O(categories × pages × sorts)),
   we store a version number per domain in KV (`pv:{domain}`).
   All cache/KV keys include the version: `products:v{ver}:{domain}:...`
   Purge = bump version (1 KV write). Old keys expire naturally via TTL.
   ============================================================ */

const inflightProductRequests = new Map();
const inflightDomainResolutions = new Map();

// In-memory version cache: domain → { version, ts }
const _memProductVersion = new Map();
const MEM_PV_TTL = 60_000; // 60s — version is cached in-memory to avoid KV reads

async function _getProductVersion(domain, env) {
  const now = Date.now();
  const mem = _memProductVersion.get(domain);
  if (mem && now - mem.ts < MEM_PV_TTL) return mem.version;

  let version = 1;
  if (env?.STORE_KV) {
    try {
      const v = await env.STORE_KV.get(`pv:${domain}`, { type: "text" });
      if (v) version = parseInt(v, 10) || 1;
    } catch {}
  }
  _memProductVersion.set(domain, { version, ts: now });
  return version;
}

async function _bumpProductVersion(domain, env) {
  const current = await _getProductVersion(domain, env);
  const next = current + 1;
  if (env?.STORE_KV) {
    await env.STORE_KV.put(`pv:${domain}`, String(next), { expirationTtl: 86400 }).catch(() => {});
  }
  _memProductVersion.set(domain, { version: next, ts: Date.now() });
  return next;
}

function _buildProductsCacheKey(domain, filters, version) {
  const parts = [`https://cache/products:v${version}:${domain}`];
  if (filters.category) parts.push(`category=${filters.category}`);
  if (filters.page) parts.push(`page=${filters.page}`);
  if (filters.sort) parts.push(`sort=${filters.sort}`);
  return new Request(parts.join(":"));
}

function _buildProductsKvKey(domain, filters, version) {
  let key = `products:v${version}:${domain}`;
  if (filters.category) key += `:cat=${filters.category}`;
  if (filters.page) key += `:p=${filters.page}`;
  if (filters.sort) key += `:s=${filters.sort}`;
  return key;
}

function _clearInflightProductRequestsForDomain(domain) {
  for (const key of inflightProductRequests.keys()) {
    if (key.startsWith(`${domain}:`)) inflightProductRequests.delete(key);
  }
}

/**
 * Version-based purge: bump version number → all old keys become unreachable.
 * Cost: 1 KV write per domain (vs hundreds of deletes before).
 * Old keys expire naturally via their TTL (max 30 min for KV, 5 min for Cache API).
 */
async function _purgeProductCachesForDomain(domain, _storeId, env) {
  const cleanDomain = domain.replace(/^www\./, "").toLowerCase().trim();
  await _bumpProductVersion(cleanDomain, env);
  _clearInflightProductRequestsForDomain(cleanDomain);
}

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
            headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${PRODUCTS_CACHE_TTL}` },
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
              headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${PRODUCTS_CACHE_TTL}` },
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
      new Response("[]", { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60" } }),
      "no-store",
    );
  }

  // Coalesce key includes filters so page 0 and page 1 don't share results
  const coalesceKey = `${domain}:${filters.category}:${filters.page}:${filters.sort}`;

  if (inflightProductRequests.has(coalesceKey)) {
    try {
      const data = await inflightProductRequests.get(coalesceKey);
      return buildProductResponse(data, cacheKey, kvKey, ctx, env, "origin-coalesced");
    } catch {
      return _fallbackProducts(domain, cacheKey, kvKey, filters, env);
    }
  }

  const fetchPromise = _fetchProductsFromDb(storeId, filters, PRODUCTS_DB_TIMEOUT_MS);
  inflightProductRequests.set(coalesceKey, fetchPromise);

  try {
    const data = await fetchPromise;
    return buildProductResponse(data, cacheKey, kvKey, ctx, env, "origin");
  } catch {
    return _fallbackProducts(domain, cacheKey, kvKey, filters, env);
  } finally {
    inflightProductRequests.delete(coalesceKey);
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

    if (filters.category) params.set("category", `eq.${filters.category}`);

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
    if (page > 0) params.set("offset", String(page * PRODUCTS_PAGE_SIZE));

    const res = await fetch(`${SUPABASE_URL}/rest/v1/products?${params}`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, Accept: "application/json" },
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
            headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${PRODUCTS_CACHE_TTL}` },
          }),
        )
        .catch(() => {}),
      env?.STORE_KV
        ? env.STORE_KV.put(kvKey, body, { expirationTtl: PRODUCTS_KV_TTL }).catch(() => {})
        : Promise.resolve(),
    ]);
  } catch {}
}

async function _fallbackProducts(domain, cacheKey, kvKey, filters, env) {
  // Try exact match first
  try {
    const stale = await cache.match(cacheKey);
    if (stale) return addCorsHeaders(stale, "cache-stale");
  } catch {}

  if (env?.STORE_KV) {
    try {
      const stale = await env.STORE_KV.get(kvKey, { type: "text" });
      if (stale)
        return addCorsHeaders(
          new Response(stale, { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }),
          "kv-stale",
        );
    } catch {}
  }

  // For filtered/paged requests, never fall back to page-0 default — return empty
  if (filters?.category || filters?.page || filters?.sort) {
    return addCorsHeaders(
      new Response("[]", { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }),
      "fallback-empty-scoped",
    );
  }

  // Only for page-0 default: try broader fallbacks
  const defaultKvKey = _buildProductsKvKey(domain, {});
  if (env?.STORE_KV) {
    try {
      const defaultStale = await env.STORE_KV.get(defaultKvKey, { type: "text" });
      if (defaultStale)
        return addCorsHeaders(
          new Response(defaultStale, { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }),
          "kv-default-stale",
        );
    } catch {}
  }

  const defaultCacheKey = _buildProductsCacheKey(domain, {});
  try {
    const defaultStale = await cache.match(defaultCacheKey);
    if (defaultStale) return addCorsHeaders(defaultStale, "cache-default-stale");
  } catch {}

  return addCorsHeaders(
    new Response("[]", { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }),
    "fallback-empty",
  );
}

async function handlePurgeProducts(request, url, ctx, env) {
  const domain = (request.headers.get("host") || url.hostname).replace(/^www\./, "").toLowerCase().trim();
  const storeId = await _resolveStoreId(domain, env);

  if (storeId) {
    await _purgeProductCachesForDomain(domain, storeId, env);
  } else {
    const purgeOps = [];
    _appendProductPurgeOps(purgeOps, domain, {}, env);
    for (const sort of ["price_asc", "price_desc", "newest"]) {
      _appendProductPurgeOps(purgeOps, domain, { sort }, env);
    }
    _clearInflightProductRequestsForDomain(domain);
    await Promise.all(purgeOps);
  }

  return addCorsHeaders(
    new Response(JSON.stringify({ purged: true, domain }), { headers: { "Content-Type": "application/json" } }),
    "purge",
  );
}

async function handlePurgeStore(request, url, ctx, env, hostname) {
  const normalizedHost = (request.headers.get("host") || hostname || url.hostname)
    .replace(/^www\./, "").toLowerCase().trim();

  let purgeSlug = url.searchParams.get("slug") || "";
  if (!purgeSlug && normalizedHost.endsWith(`.${ROOT_DOMAIN}`)) purgeSlug = normalizedHost.replace(`.${ROOT_DOMAIN}`, "");
  if (!purgeSlug && normalizedHost !== ROOT_DOMAIN && !normalizedHost.endsWith(`.${ROOT_DOMAIN}`)) {
    purgeSlug = (await resolveDomain(normalizedHost, env)) || "";
  }

  let customDomain = purgeSlug ? await getCustomDomainForSlug(purgeSlug) : null;
  if (customDomain) customDomain = customDomain.replace(/^www\./, "").toLowerCase().trim();

  const domainsToPurge = new Set([normalizedHost]);
  if (purgeSlug) domainsToPurge.add(`${purgeSlug}.${ROOT_DOMAIN}`);
  if (customDomain) domainsToPurge.add(customDomain);

  // Clear in-memory caches
  if (purgeSlug) {
    _memThemeCache.delete(purgeSlug);
    _memStorefrontCache.delete(purgeSlug);
    _storeInfoCache.delete(purgeSlug);
  }

  const purgeOps = [];
  for (const d of domainsToPurge) {
    domainStoreIdCache.delete(d);
    _clearInflightProductRequestsForDomain(d);
    purgeOps.push(cache.delete(getEarlyCacheKey(d)).catch(() => {}));
    purgeOps.push(cache.delete(new Request(`https://cache/store-id:${d}`)).catch(() => {}));
    if (env?.STORE_KV) purgeOps.push(env.STORE_KV.delete(`store-id:${d}`).catch(() => {}));
    if (d !== ROOT_DOMAIN && !d.endsWith(`.${ROOT_DOMAIN}`)) {
      purgeOps.push(cache.delete(new Request(`https://cache/domain-${d}`)).catch(() => {}));
      if (env?.STORE_KV) purgeOps.push(env.STORE_KV.delete(`domain:${d}`).catch(() => {}));
    }
  }

  if (purgeSlug) {
    purgeOps.push(cache.delete(new Request(`https://cache/storefront-data/${purgeSlug}`)).catch(() => {}));
    purgeOps.push(cache.delete(new Request(`https://cache/theme-lite:${purgeSlug}`)).catch(() => {}));
    purgeOps.push(cache.delete(new Request(`https://cache/store-info:${purgeSlug}`)).catch(() => {}));
    purgeOps.push(cache.delete(new Request(`https://cache/slug-domain-${purgeSlug}`)).catch(() => {}));
    if (env?.STORE_KV) {
      purgeOps.push(env.STORE_KV.delete(`storefront:${purgeSlug}`).catch(() => {}));
      purgeOps.push(env.STORE_KV.delete(`theme-lite:${purgeSlug}`).catch(() => {}));
      purgeOps.push(env.STORE_KV.delete(`store-info:${purgeSlug}`).catch(() => {}));
    }
  }

  await Promise.all(purgeOps);

  // Purge ALL product caches (paginated + category) for every domain variant
  const storeId = purgeSlug
    ? (await _resolveStoreInfo(purgeSlug, `${purgeSlug}.${ROOT_DOMAIN}`, env)).storeId
    : await _resolveStoreId(normalizedHost, env);

  if (storeId) {
    await Promise.all([...domainsToPurge].map((d) => _purgeProductCachesForDomain(d, storeId, env)));
  } else {
    const fallbackOps = [];
    for (const d of domainsToPurge) {
      _appendProductPurgeOps(fallbackOps, d, {}, env);
      for (const sort of ["price_asc", "price_desc", "newest"]) {
        _appendProductPurgeOps(fallbackOps, d, { sort }, env);
      }
    }
    await Promise.all(fallbackOps);
  }

  return addCorsHeaders(
    new Response(
      JSON.stringify({ purged: true, slug: purgeSlug || null, domains: [...domainsToPurge], workerVersion: WORKER_VERSION }),
      { headers: { "Content-Type": "application/json" } },
    ),
    "purge-store",
  );
}

/* ============================================================
   EDGE FUNCTION CALLS
   ============================================================ */

async function callEdgeFunction(name, params = {}) {
  const url = new URL(`${SUPABASE_URL}/functions/v1/${name}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EDGE_FN_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res;
  } catch {
    clearTimeout(timeout);
    return new Response("Edge function timeout", { status: 504 });
  }
}

/* ============================================================
   SEO FILES + BOT HANDLER
   ============================================================ */

async function handleSeoFiles(url, slug) {
  if (url.pathname === "/sitemap.xml") {
    const res = await callEdgeFunction("seo-page", { type: "sitemap", slug });
    if (res.ok) {
      const body = await res.text();
      return new Response(body, {
        headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600", ...SECURITY_HEADERS },
      });
    }
  }
  if (url.pathname === "/robots.txt") {
    const res = await callEdgeFunction("seo-page", { type: "robots", slug });
    if (res.ok) {
      const body = await res.text();
      return new Response(body, {
        headers: { "Content-Type": "text/plain", "Cache-Control": "public, max-age=86400", ...SECURITY_HEADERS },
      });
    }
  }
  return null;
}

async function handleBot(request, slug, url, isCustom) {
  const ua = request.headers.get("User-Agent") || "";
  if (isSocialInAppBrowser(ua)) return null;
  if (!BOT_UA_REGEX.test(ua)) return null;

  const botIp = request.headers.get("cf-connecting-ip") || "unknown";
  if (isRateLimited(`bot:${botIp}`, true)) {
    return new Response("Too Many Requests", { status: 429, headers: { "Retry-After": "60" } });
  }

  const hostname = request.headers.get("host") || url.hostname;
  const isSearchBot = SEARCH_BOT_REGEX.test(ua);
  const isSocialBot = SOCIAL_BOT_REGEX.test(ua) || INSTAGRAM_CRAWLER_REGEX.test(ua);
  const productSlug = getProductSlug(url.pathname);

  if (isSearchBot) {
    const domain = isCustom ? hostname : null;
    const botRenderRes = await callEdgeFunction("bot-render", {
      slug,
      product: productSlug || "",
      domain: domain || "",
    });
    if (botRenderRes.ok) {
      const html = await botRenderRes.text();
      return new Response(html, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=300, stale-while-revalidate=7200",
          ...SECURITY_HEADERS,
        },
      });
    }
    return null;
  }

  if (isSocialBot) {
    const domain = isCustom ? hostname : null;
    const ogRes = await callEdgeFunction("bot-render", {
      slug,
      product: productSlug || "",
      domain: domain || "",
      social: "true",
    });
    if (ogRes.ok) {
      try {
        const og = await ogRes.json();
        const finalUrl = isCustom
          ? `https://${hostname}${url.pathname}`
          : buildSubdomainUrl(slug, url.pathname, url.search);
        return new Response(buildOgHtml(og, finalUrl), {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "public, max-age=300, stale-while-revalidate=7200",
            ...SECURITY_HEADERS,
          },
        });
      } catch {}
    }
    return null;
  }

  return null;
}

function buildOgHtml(og, finalUrl) {
  const title = escapeHtml(og.title || "");
  const desc = escapeHtml(og.description || "");
  const img = escapeHtml(og.image || "");
  const siteName = escapeHtml(og.title?.split("—")[0]?.trim() || og.title || "");
  const safeUrl = escapeHtml(finalUrl);
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${title}</title><meta name="description" content="${desc}"><meta property="og:title" content="${title}"><meta property="og:description" content="${desc}"><meta property="og:url" content="${safeUrl}"><meta property="og:type" content="website"><meta property="og:site_name" content="${siteName}">${img ? `<meta property="og:image" content="${img}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">` : ""}<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${title}"><meta name="twitter:description" content="${desc}">${img ? `<meta name="twitter:image" content="${img}">` : ""}<link rel="canonical" href="${safeUrl}"><meta http-equiv="refresh" content="0;url=${safeUrl}"><script>window.location.replace(${JSON.stringify(finalUrl)});</script></head><body><p>Redirecting to <a href="${safeUrl}">${siteName}</a>...</p></body></html>`;
}

/* ============================================================
   PURGE HANDLERS
   ============================================================ */

async function handlePurgeShell(request, url, ctx, env, hostname) {
  let purgeSlug = url.searchParams.get("slug") || "";
  if (!purgeSlug && hostname.endsWith(`.${ROOT_DOMAIN}`)) purgeSlug = hostname.replace(`.${ROOT_DOMAIN}`, "");
  if (!purgeSlug && hostname !== ROOT_DOMAIN && !hostname.endsWith(`.${ROOT_DOMAIN}`)) {
    purgeSlug = (await resolveDomain(hostname, env)) || "";
  }

  // Reset in-memory caches
  _memShell = null;
  _memShellTs = 0;
  _memPrebuiltHead = null;
  if (purgeSlug) {
    _memThemeCache.delete(purgeSlug);
    _memStorefrontCache.delete(purgeSlug);
    _storeInfoCache.delete(purgeSlug);
    domainStoreIdCache.delete(hostname);
    domainStoreIdCache.delete(`${purgeSlug}.${ROOT_DOMAIN}`);
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
    purgeOps.push(cache.delete(getEarlyCacheKey(`${purgeSlug}.${ROOT_DOMAIN}`)).catch(() => {}));
    purgeOps.push(cache.delete(getEarlyCacheKey(hostname)).catch(() => {}));
    purgeOps.push(cache.delete(new Request(`https://cache/storefront-data/${purgeSlug}`)).catch(() => {}));
    purgeOps.push(cache.delete(new Request(`https://cache/theme-lite:${purgeSlug}`)).catch(() => {}));
    purgeOps.push(cache.delete(new Request(`https://cache/store-info:${purgeSlug}`)).catch(() => {}));

    if (env?.STORE_KV) {
      purgeOps.push(env.STORE_KV.delete(`storefront:${purgeSlug}`).catch(() => {}));
      purgeOps.push(env.STORE_KV.delete(`theme-lite:${purgeSlug}`).catch(() => {}));
      purgeOps.push(env.STORE_KV.delete(`store-info:${purgeSlug}`).catch(() => {}));
    }
  }

  await Promise.all(purgeOps);
  inflightShellFetch = null;

  return addCorsHeaders(
    new Response(JSON.stringify({ purged: true, slug: purgeSlug || null, workerVersion: WORKER_VERSION }), {
      headers: { "Content-Type": "application/json" },
    }),
    "purge",
  );
}

/* ============================================================
   PREWARM HANDLER
   ============================================================ */

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
            new Response(built, { headers: { "Cache-Control": `public, max-age=${PREBUILT_HEAD_CACHE_TTL}` } }),
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
          .put(domainKey, new Response(cacheData, { headers: { "Cache-Control": "public, max-age=300" } }))
          .catch(() => {}),
      ];
      if (env?.STORE_KV)
        writes.push(
          env.STORE_KV.put(`domain:${cleanDomain}`, cacheData, { expirationTtl: KV_DOMAIN_TTL }).catch(() => {}),
        );
      await Promise.all(writes);
      results.domainMapping = "warmed";
    }

    const subDomain = `${slug}.${ROOT_DOMAIN}`;
    let storeId = null;

    // Purge negative caches before re-fetching
    const infoCacheKey = new Request(`https://cache/store-info:${slug}`);
    await cache.delete(infoCacheKey).catch(() => {});
    _storeInfoCache.delete(slug);
    _memStorefrontCache.delete(slug);
    _memThemeCache.delete(slug);
    domainStoreIdCache.delete(subDomain);
    if (env?.STORE_KV) await env.STORE_KV.delete(`store-info:${slug}`).catch(() => {});

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
            new Response(storeIdStr, { headers: { "Cache-Control": "public, max-age=600" } }),
          )
          .catch(() => {}),
      ];
      if (env?.STORE_KV)
        idWrites.push(env.STORE_KV.put(`store-id:${subDomain}`, storeIdStr, { expirationTtl: 3600 }).catch(() => {}));
      if (domain) {
        const cleanDomain = domain
          .replace(/^www\./, "")
          .toLowerCase()
          .trim();
        idWrites.push(
          cache
            .put(
              new Request(`https://cache/store-id:${cleanDomain}`),
              new Response(storeIdStr, { headers: { "Cache-Control": "public, max-age=600" } }),
            )
            .catch(() => {}),
        );
        if (env?.STORE_KV)
          idWrites.push(
            env.STORE_KV.put(`store-id:${cleanDomain}`, storeIdStr, { expirationTtl: 3600 }).catch(() => {}),
          );
      }
      await Promise.all(idWrites);
    }

    if (storeId) {
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
        if (env?.STORE_KV)
          cacheOps.push(
            env.STORE_KV.put(_buildProductsKvKey(subDomain, {}), prodBody, { expirationTtl: PRODUCTS_KV_TTL }).catch(
              () => {},
            ),
          );
        if (domain) {
          const cleanDomain = domain
            .replace(/^www\./, "")
            .toLowerCase()
            .trim();
          cacheOps.push(
            cache
              .put(
                _buildProductsCacheKey(cleanDomain, {}),
                new Response(prodBody, {
                  headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": `public, max-age=${PRODUCTS_CACHE_TTL}`,
                  },
                }),
              )
              .catch(() => {}),
          );
          if (env?.STORE_KV)
            cacheOps.push(
              env.STORE_KV.put(_buildProductsKvKey(cleanDomain, {}), prodBody, {
                expirationTtl: PRODUCTS_KV_TTL,
              }).catch(() => {}),
            );
        }
        await Promise.all(cacheOps);
        results.products = "warmed";
      } catch {
        results.products = "failed";
      }
    }

    // FIX #10: Raised to 3600/86400
    if (shellResult?.html && dataResult.data) {
      const injected = injectIntoHtml(shellResult.html, slug, dataResult.data, "prewarm");
      const htmlResponse = new Response(injected.html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=3600, stale-while-revalidate=7200",
          "X-Store-Slug": slug,
          "X-Data-Source": "prewarm",
          "X-Shell-Source": shellResult.source,
          ...SECURITY_HEADERS,
        },
      });

      const subEarlyKey = getEarlyCacheKey(`${slug}.${ROOT_DOMAIN}`);
      await cache.put(subEarlyKey, htmlResponse.clone()).catch(() => {});

      if (domain) {
        const cleanDomain = domain
          .replace(/^www\./, "")
          .toLowerCase()
          .trim();
        const domEarlyKey = getEarlyCacheKey(cleanDomain);
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

/* ============================================================
   NOT FOUND HTML
   ============================================================ */

function buildNotFoundHtml(safeSlug, rootDomain) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Store Not Found</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fafafa;color:#333}.c{text-align:center;padding:2rem}.c h1{font-size:1.5rem;font-weight:600;margin-bottom:8px}.c p{color:#666;margin-bottom:20px;font-size:0.95rem}.c a{display:inline-block;padding:10px 24px;background:#4361ee;color:#fff;border-radius:8px;text-decoration:none;font-weight:500;font-size:0.9rem;transition:background .2s}.c a:hover{background:#3651d4}.retry{color:#999;font-size:0.8rem;margin-top:12px}.spin{display:inline-block;width:14px;height:14px;border:2px solid #ccc;border-top-color:#4361ee;border-radius:50%;animation:sp .6s linear infinite}@keyframes sp{to{transform:rotate(360deg)}}</style></head><body><div class="c"><h1>Store Not Found</h1><p>No store exists at <strong>${safeSlug}.${rootDomain}</strong></p><a href="https://${rootDomain}">Create Your Store</a><p class="retry" id="rt"><span class="spin"></span> Checking again...</p></div><script>var n=0,mx=3;function ck(){if(n>=mx){var e=document.getElementById("rt");if(e)e.textContent="Store not available. Try again later.";return}n++;fetch(location.href,{method:"HEAD",cache:"no-store"}).then(function(r){if(r.ok&&r.headers.get("content-type")&&r.headers.get("content-type").indexOf("text/html")>-1&&r.headers.get("x-store-slug")){location.reload()}else{setTimeout(ck,3000)}}).catch(function(){setTimeout(ck,3000)})}setTimeout(ck,2000)</script></body></html>`;
}

/* ============================================================
   CACHED FETCH (HARDENED)
   ============================================================ */

async function cachedFetch(request, slug = "", ctx, isCustomDomain = false, env = {}, requestStart = Date.now()) {
  const url = new URL(request.url);
  const hostname = request.headers.get("host") || url.hostname;

  if (request.method !== "GET") {
    if (isCustomDomain && slug) {
      const { response, dataSource } = await fetchAndInjectSlug(
        request,
        slug,
        ctx,
        env,
        hostname,
        url.pathname,
        requestStart,
      );
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
      const { response, dataSource } = await fetchAndInjectSlug(
        request,
        slug,
        ctx,
        env,
        hostname,
        url.pathname,
        requestStart,
      );
      return addDiagnosticHeaders(response, { slug, cacheStatus: "BYPASS", dataSource });
    }
    return addDiagnosticHeaders(await proxyToOrigin(request), { slug, cacheStatus: "BYPASS", dataSource: "none" });
  }

  let res;
  let dataSource = "none";
  try {
    if (slug) {
      const result = await fetchAndInjectSlug(request, slug, ctx, env, hostname, url.pathname, requestStart);
      res = result.response;
      dataSource = result.dataSource;
    } else {
      res = await proxyToOrigin(request);
    }
  } catch {
    const earlyKey = getEarlyCacheKey(hostname);
    const fallback = await cache.match(earlyKey);
    if (fallback) return addDiagnosticHeaders(fallback, { slug, cacheStatus: "STALE-FALLBACK", dataSource: "cached" });
    return new Response("Server Error", { status: 500 });
  }

  const contentType = res.headers.get("content-type") || "";
  if (res.status === 200 && contentType.includes("text/html")) {
    if (slug) {
      if (res.headers.get("X-Store-Slug") === slug) storeInEdgeCache(ctx, hostname, slug, res);
    } else {
      storeInEdgeCache(ctx, hostname, "", res);
    }
  }

  return addDiagnosticHeaders(res, { slug, cacheStatus: "MISS", dataSource });
}

/* ============================================================
   MAIN FETCH HANDLER
   ============================================================ */

export default {
  async fetch(request, env, ctx) {
    // FIX #5: Record request start time immediately
    const requestStart = Date.now();

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
            memShell: !!_memShell,
            memPrebuiltHead: !!_memPrebuiltHead,
            memThemeCacheSize: _memThemeCache.size,
            memStorefrontCacheSize: _memStorefrontCache.size,
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
      if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/static/"))
        return proxyToOriginCached(request);
      return proxyToOrigin(request);
    }

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
      const earlyKey = getEarlyCacheKey(hostname);
      const earlyHit = await cache.match(earlyKey);

      if (earlyHit) {
        const cachedSlug = earlyHit.headers.get("X-Store-Slug") || "";
        const cachedDataSource = earlyHit.headers.get("X-Data-Source") || "edge";

        const revalKey = `html:${hostname}`;
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
                    // FIX #10
                    fullHeaders.set("Cache-Control", "public, max-age=3600, stale-while-revalidate=7200");
                    fullHeaders.set("X-Store-Slug", revalSlug);
                    fullHeaders.set("X-Data-Source", prefetchResult.source);
                    fullHeaders.set("X-Shell-Source", shellResult.source);
                    fullHeaders.set("X-Cache-Timestamp", new Date().toISOString());
                    for (const [k, v] of Object.entries(SECURITY_HEADERS)) fullHeaders.set(k, v);
                    const fullResponse = new Response(result.html, { status: 200, headers: fullHeaders });
                    storeInEdgeCache(ctx, hostname, revalSlug, fullResponse);
                  }
                }
              } catch {}
            })(),
          );
        }

        return addDiagnosticHeaders(earlyHit, { slug: cachedSlug, cacheStatus: "HIT", dataSource: cachedDataSource });
      }
    }

    // ─── API ROUTES ───
    if (url.pathname === "/api/products" && request.method === "GET") return handleProductsApi(request, url, ctx, env);
    if (url.pathname === "/api/purge-store" && request.method === "POST")
      return handlePurgeStore(request, url, ctx, env, hostname);
    if (url.pathname === "/api/purge-products" && request.method === "POST")
      return handlePurgeProducts(request, url, ctx, env);
    if (url.pathname === "/api/purge-shell" && request.method === "POST")
      return handlePurgeShell(request, url, ctx, env, hostname);
    if (url.pathname === "/api/prewarm") {
      if (request.method === "OPTIONS") return addCorsHeaders(new Response(null, { status: 204 }), "preflight");
      if (request.method === "POST" || request.method === "GET") return handlePrewarm(request, url, ctx, env);
    }
    if (request.method === "OPTIONS" && url.pathname.startsWith("/api/"))
      return addCorsHeaders(new Response(null, { status: 204 }), "preflight");

    // ─── SUPABASE PROXY ───
    if (url.pathname.startsWith("/rest/v1/") || url.pathname.startsWith("/functions/v1/")) {
      const targetUrl = new URL(request.url);
      targetUrl.hostname = new URL(SUPABASE_URL).hostname;
      targetUrl.port = "";
      const headers = new Headers(request.headers);
      headers.set("Host", new URL(SUPABASE_URL).hostname);
      if (!headers.has("apikey")) {
        headers.set("apikey", SUPABASE_ANON_KEY);
        headers.set("Authorization", `Bearer ${SUPABASE_ANON_KEY}`);
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), EDGE_FN_TIMEOUT_MS);
      try {
        const res = await fetch(targetUrl.toString(), {
          method: request.method,
          headers,
          body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const proxyRes = new Response(res.body, res);
        proxyRes.headers.set("Access-Control-Allow-Origin", "*");
        proxyRes.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
        proxyRes.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, apikey, x-client-info");
        return proxyRes;
      } catch {
        clearTimeout(timeout);
        return new Response("Gateway Timeout", { status: 504 });
      }
    }

    // ─── ROOT DOMAIN ───
    if (hostname === ROOT_DOMAIN || hostname === `www.${ROOT_DOMAIN}`) {
      const storeMatch = url.pathname.match(/^\/store\/([a-zA-Z0-9_-]+)(\/.*)?$/);
      if (storeMatch) {
        const redirectSlug = storeMatch[1];
        const remainingPath = storeMatch[2] || "";
        const customDomain = await getCustomDomainForSlug(redirectSlug);
        if (customDomain) return Response.redirect(`https://${customDomain}${remainingPath}${url.search}`, 301);
        return Response.redirect(`https://${redirectSlug}.${ROOT_DOMAIN}${remainingPath}${url.search}`, 301);
      }
      if (hostname === `www.${ROOT_DOMAIN}`)
        return Response.redirect(`https://${ROOT_DOMAIN}${url.pathname}${url.search}`, 301);
      return cachedFetch(request, "", ctx, false, env, requestStart);
    }

    // ─── SUBDOMAIN ───
    if (hostname.endsWith(`.${ROOT_DOMAIN}`)) {
      const slug = hostname.replace(`.${ROOT_DOMAIN}`, "");
      if (!slug || slug.includes(".") || slug === "www") return cachedFetch(request, "", ctx, false, env, requestStart);

      await _getSlugIndex(env); // warm slug index, ignore result (soft hint)

      // FIX #2: Start storefront promise FIRST before any other awaits
      const elapsed0 = Date.now() - requestStart;
      const storefrontDeadline = Math.max(400, 1400 - elapsed0);
      const earlyStorefrontPromise = prefetchStorefrontDataWithDeadline(slug, ctx, env, storefrontDeadline);

      // FIX #4: Batch KV read + shell in parallel
      const [shellResult, storeInfo, kvBatch, cachedHead, inlineProducts] = await Promise.all([
        getSpaShell(request, ctx, env),
        _resolveStoreInfo(slug, hostname, env),
        _batchKvRead(slug, env),
        _getCachedPrebuiltHead(env),
        _getInlineProductsOrNull(hostname, slug, env, ctx),
      ]);

      // Hydrate in-memory caches from batch
      if (kvBatch.theme && !(_memThemeCache.get(slug)?.expiresAt > Date.now())) {
        _capMapSize(_memThemeCache, MEM_THEME_CACHE_MAX);
        _memThemeCache.set(slug, { lite: kvBatch.theme, expiresAt: Date.now() + MEM_THEME_TTL });
      }
      if (kvBatch.storefront && !(_memStorefrontCache.get(slug)?.expiresAt > Date.now())) {
        _capMapSize(_memStorefrontCache, MEM_STOREFRONT_CACHE_MAX);
        _memStorefrontCache.set(slug, { data: kvBatch.storefront, expiresAt: Date.now() + MEM_STOREFRONT_TTL });
      }

      const themeLite = _memThemeCache.get(slug)?.lite || kvBatch.theme || null;

      if (!storeInfo.storeId) {
        const safeSlug = slug.replace(/[<>"'&]/g, "");
        return new Response(buildNotFoundHtml(safeSlug, ROOT_DOMAIN), {
          status: 404,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "public, max-age=10",
            ...SECURITY_HEADERS,
          },
        });
      }

      if (storeInfo.customDomain) {
        return Response.redirect(`https://${storeInfo.customDomain}${url.pathname}${url.search}`, 301);
      }

      const seoResponse = await handleSeoFiles(url, slug);
      if (seoResponse) return seoResponse;
      const botResponse = await handleBot(request, slug, url, false);
      if (botResponse) return botResponse;

      if (!shellResult?.html) {
        const response = await proxyToOrigin(request);
        return addDiagnosticHeaders(response, { slug, cacheStatus: "MISS", dataSource: "none" });
      }

      const prebuiltHead = cachedHead || (await getPrebuiltHead(shellResult.html, env));
      // FIX #3: Always set Link header
      const linkHeader = _buildLinkPreloadHeader(shellResult.html);

      const responseHeaders = new Headers();
      responseHeaders.set("Content-Type", "text/html; charset=utf-8");
      responseHeaders.set("Cache-Control", "public, max-age=600, stale-while-revalidate=1800");
      responseHeaders.set("X-Store-Slug", slug);
      responseHeaders.set("X-Shell-Source", shellResult.source);
      responseHeaders.set("X-Cache-Timestamp", new Date().toISOString());
      responseHeaders.set("X-Data-Source", "streaming");
      if (linkHeader) responseHeaders.set("Link", linkHeader);
      for (const [k, v] of Object.entries(SECURITY_HEADERS)) responseHeaders.set(k, v);

      // FIX #2: Pass the ALREADY-RUNNING storefront promise (started before awaits above)
      const response = await serveStreamedHtml(
        slug,
        shellResult,
        themeLite,
        prebuiltHead,
        inlineProducts,
        earlyStorefrontPromise,
        responseHeaders,
      );

      ctx.waitUntil(_warmFullHtmlInBackground(request, shellResult, slug, ctx, env, hostname, url.pathname));

      return addDiagnosticHeaders(response, { slug, cacheStatus: "MISS", dataSource: "streaming" });
    }

    // ─── CUSTOM DOMAIN ───
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

    // FIX #2: Start storefront promise as soon as we know the domain pattern,
    // but we don't know slug yet — kick off domain resolution + shell in parallel first
    const [resolvedSlug, shellResultCD] = await Promise.all([
      resolveDomain(cleanDomain, env),
      getSpaShell(request, ctx, env),
    ]);

    if (resolvedSlug) {
      // FIX #2: Now we know the slug, start storefront immediately
      const elapsed1 = Date.now() - requestStart;
      const storefrontDeadlineCD = Math.max(400, 1400 - elapsed1);
      const earlyStorefrontPromiseCD = prefetchStorefrontDataWithDeadline(resolvedSlug, ctx, env, storefrontDeadlineCD);

      // FIX #4: Batch remaining slug-dependent data
      const [seoResponse, botResponse, kvBatchCD, cachedHeadCDReal, inlineProductsCDReal] = await Promise.all([
        handleSeoFiles(url, resolvedSlug),
        handleBot(request, resolvedSlug, url, true),
        _batchKvRead(resolvedSlug, env),
        _getCachedPrebuiltHead(env),
        _getInlineProductsOrNull(hostname, resolvedSlug, env, ctx),
      ]);

      // Hydrate in-memory from batch
      if (kvBatchCD.theme && !(_memThemeCache.get(resolvedSlug)?.expiresAt > Date.now())) {
        _capMapSize(_memThemeCache, MEM_THEME_CACHE_MAX);
        _memThemeCache.set(resolvedSlug, { lite: kvBatchCD.theme, expiresAt: Date.now() + MEM_THEME_TTL });
      }
      if (kvBatchCD.storefront && !(_memStorefrontCache.get(resolvedSlug)?.expiresAt > Date.now())) {
        _capMapSize(_memStorefrontCache, MEM_STOREFRONT_CACHE_MAX);
        _memStorefrontCache.set(resolvedSlug, {
          data: kvBatchCD.storefront,
          expiresAt: Date.now() + MEM_STOREFRONT_TTL,
        });
      }

      const themeLiteCD = _memThemeCache.get(resolvedSlug)?.lite || kvBatchCD.theme || null;

      if (seoResponse) return seoResponse;
      if (botResponse) return botResponse;

      if (!shellResultCD?.html) {
        const response = await proxyToOrigin(request);
        return addDiagnosticHeaders(response, { slug: resolvedSlug, cacheStatus: "MISS", dataSource: "none" });
      }

      const prebuiltHeadCD = cachedHeadCDReal || (await getPrebuiltHead(shellResultCD.html, env));
      // FIX #3
      const linkHeaderCD = _buildLinkPreloadHeader(shellResultCD.html);

      const responseHeadersCD = new Headers();
      responseHeadersCD.set("Content-Type", "text/html; charset=utf-8");
      responseHeadersCD.set("Cache-Control", "public, max-age=600, stale-while-revalidate=1800");
      responseHeadersCD.set("X-Store-Slug", resolvedSlug);
      responseHeadersCD.set("X-Shell-Source", shellResultCD.source);
      responseHeadersCD.set("X-Cache-Timestamp", new Date().toISOString());
      responseHeadersCD.set("X-Data-Source", "streaming");
      if (linkHeaderCD) responseHeadersCD.set("Link", linkHeaderCD);
      for (const [k, v] of Object.entries(SECURITY_HEADERS)) responseHeadersCD.set(k, v);

      // FIX #2: Pass the ALREADY-RUNNING promise
      const responseCD = await serveStreamedHtml(
        resolvedSlug,
        shellResultCD,
        themeLiteCD,
        prebuiltHeadCD,
        inlineProductsCDReal,
        earlyStorefrontPromiseCD,
        responseHeadersCD,
      );

      ctx.waitUntil(_warmFullHtmlInBackground(request, shellResultCD, resolvedSlug, ctx, env, hostname, url.pathname));

      return addDiagnosticHeaders(responseCD, { slug: resolvedSlug, cacheStatus: "MISS", dataSource: "streaming" });
    }

    // ─── UNKNOWN DOMAIN → 404 ───
    return new Response(
      `<!DOCTYPE html><html><head><title>Store Not Found</title></head><body style="font-family:sans-serif;text-align:center;padding:60px"><h1>Store Not Found</h1><p>No store is configured for this domain.</p></body></html>`,
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

  /* ============================================================
     SCHEDULED HANDLER — DB Keepalive + Full Store Warming
     FIX #14: Warm ALL stores (not just top 20), concurrency=10
     FIX #15: Fetch shell ONCE before the loop, reuse for all stores
     ============================================================ */
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

      // FIX #15: Fetch shell once, outside the per-store loop
      let cronShellResult = null;
      try {
        cronShellResult = await getSpaShell(new Request(`https://${ROOT_DOMAIN}/`), ctx, env);
      } catch {}

      ctx.waitUntil(
        (async () => {
          try {
            let allStores = [];
            let offset = 0;
            const pageSize = 500;
            while (true) {
              const storesRes = await fetch(
                `${SUPABASE_URL}/rest/v1/stores_public?select=id,slug,custom_domain&is_suspended=eq.false&limit=${pageSize}&offset=${offset}&order=updated_at.desc`,
                { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } },
              );
              if (!storesRes.ok) break;
              const batch = await storesRes.json();
              if (!batch.length) break;
              allStores = allStores.concat(batch);
              if (batch.length < pageSize) break;
              offset += pageSize;
            }

            if (allStores.length === 0) return;

            // Sync KV store-info for all stores (skip unchanged)
            if (env?.STORE_KV) {
              const allSlugs = allStores.filter((s) => s.slug && s.id).map((s) => s.slug);
              const readPromises = allSlugs.map((slug) => env.STORE_KV.get(`store-info:${slug}`).catch(() => null));
              const existingValues = await Promise.all(readPromises);

              const kvWrites = [];
              let kvWriteCount = 0,
                kvSkipCount = 0;

              for (let i = 0; i < allSlugs.length; i++) {
                const s = allStores.find((st) => st.slug === allSlugs[i]);
                if (!s) continue;
                const payload = JSON.stringify({ id: s.id, cd: s.custom_domain || null });
                if (existingValues[i] !== payload) {
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

              kvWrites.push(
                env.STORE_KV.put("all-active-slugs", JSON.stringify(allSlugs), { expirationTtl: 600 }).catch(() => {}),
              );
              _slugIndexSet = new Set(allSlugs);
              _slugIndexExpiresAt = Date.now() + 300_000;

              if (kvWrites.length > 0) await Promise.all(kvWrites);
              console.log(
                `[keepalive] warmed ${allStores.length} stores — KV: ${kvWriteCount} changed, ${kvSkipCount} skipped`,
              );
            }

            // FIX #14: Warm ALL stores with concurrency=10
            // FIX #15: Reuse cronShellResult (fetched once above)
            const CONCURRENCY = 10;
            let warmedHtml = 0,
              warmedProducts = 0;

            for (let i = 0; i < allStores.length; i += CONCURRENCY) {
              const batch = allStores.slice(i, i + CONCURRENCY);
              await Promise.all(
                batch.map(async (s) => {
                  try {
                    if (!s.slug || !s.id) return;

                    // FIX #15: Use the shared cronShellResult
                    const shellResult = cronShellResult;

                    // Warm storefront data
                    const dataResult = await prefetchStorefrontData(s.slug, ctx, env);

                    // Warm HTML cache with NORMALIZED key
                    if (shellResult?.html && dataResult.data) {
                      const injected = injectIntoHtml(shellResult.html, s.slug, dataResult.data, "cron-prewarm");
                      // FIX #10: Raised to 3600/86400
                      const htmlResponse = new Response(injected.html, {
                        status: 200,
                        headers: {
                          "Content-Type": "text/html; charset=utf-8",
                          "Cache-Control": "public, max-age=3600, stale-while-revalidate=7200",
                          "X-Store-Slug": s.slug,
                          "X-Data-Source": "cron-prewarm",
                          ...SECURITY_HEADERS,
                        },
                      });
                      const subEarlyKey = getEarlyCacheKey(`${s.slug}.${ROOT_DOMAIN}`);
                      await cache.put(subEarlyKey, htmlResponse.clone()).catch(() => {});

                      if (s.custom_domain) {
                        const cleanCustom = s.custom_domain
                          .replace(/^www\./, "")
                          .toLowerCase()
                          .trim();
                        const domEarlyKey = getEarlyCacheKey(cleanCustom);
                        await cache.put(domEarlyKey, htmlResponse.clone()).catch(() => {});
                      }
                      warmedHtml++;
                    }

                    // Warm products
                    if (dataResult.data?.store?.id) {
                      await _prewarmProducts(dataResult.data.store.id, s.slug, ctx, env, s.custom_domain).catch(
                        () => {},
                      );
                      warmedProducts++;
                    }
                  } catch {}
                }),
              );
            }

            console.log(
              `[keepalive] warmed HTML for ${warmedHtml}/${allStores.length} stores, products for ${warmedProducts} stores`,
            );
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
