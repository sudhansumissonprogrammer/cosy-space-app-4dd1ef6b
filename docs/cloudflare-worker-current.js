/**
 * SHOPBANAO PRODUCTION ROUTER v8.50.0 — INSTANT TRACKING CACHE REFRESH
 *
 * v8.48.0 — /cf-img handler deleted (was 125 lines of unused image
 *           proxy/resize code). Confirmed zero callers in frontend.
 *           All images go through cdn.shopbanao.in (R2) or Supabase
 *           render API directly. Route now returns 410 Gone as
 *           defense-in-depth for any stale browser/CDN cache.
 *
 * Previous: v8.47.0 — HOMEPAGE SEO HEAD IN STREAM
 *
 * Changes from v8.46.0:
 *  v8.47.0 — Streaming path now awaits storefront shell (KV-cached) and
 *            injects a real <title>/<meta>/<og:*>/canonical block into
 *            <head> BEFORE the body flushes. Crawlers (Google, AnswerLens,
 *            ChatGPT, Perplexity, etc.) now see a fully-formed head on
 *            every storefront, every request — no JS execution needed.
 *            Removed the legacy client-side document.title fallback.
 *  v8.46.0 — Added <meta name="robots" content="...max-image-preview:large,
 *            max-snippet:-1..."> on homepage/category/PDP heads so Google +
 *            AI engines can show full product images & long snippets in
 *            answer boxes. Added OG product price/availability/condition
 *            tags + Twitter price labels on PDPs so WhatsApp/Telegram/FB
 *            shares display "₹12,500 · In stock" under the image.
 *  v8.45.0 — Removed Cloudflare Analytics Engine writes. Supabase page_views
 *            is the single source of truth. Browser beacon is primary writer;
 *            Worker writes as safety net on cold/MISS only. The AE_PAGEVIEWS
 *            binding can be removed from the Cloudflare dashboard.
 *  v8.43.0 — Pageview writes now flush immediately instead of waiting for

 *            100 buffered rows / 60s. Low-traffic Worker isolates were dying
 *            before batch flush, leaving page_views empty and dashboard
 *            Sessions/Conversion at zero.
 *
 * Changes from v8.33.0:
 *  v8.34.0 — PRODUCTS_PAGE_SIZE bumped 50 → 20 to standardize storefront
 *            pagination across Shop, Category, Home, and Best Sellers.
 *            Inline __PRODUCTS_INLINE__ also caps at 20 (derived from same
 *            constant). Client (useInfiniteProducts PAGE_SIZE) updated in
 *            lockstep. Purge active store caches after deploy so old
 *            50-item cached responses don't conflict with new offsets.
 *
 *  v8.19.0 — Three more KV-write cuts (~50% on top of v8.18.0):
 *            (B) Second-hit gate for PDP + Category + filtered Products.
 *                First miss writes Cache API only; KV write only on the 2nd
 *                miss within 5min. Eliminates one-hit-wonder crawler writes.
 *            (C) Default-filter products (home page) still write KV directly.
 *                Non-default filters (page>=2, category drill, custom sort)
 *                go through the second-hit gate.
 *            (E) Bot KV-skip already covers PDP/Category/Products via
 *                ctx.__skipKvWarm (set in early-bot path, v8.1.0).
 *            Purge handlers also clear _secondHitMap implicitly because the
 *                version bump changes the kvKey shape.
 *
 * Changes from v8.9.0:
 *  v8.18.0 — Three-pronged KV write reduction (~50% fewer KV puts):
 *            (A) kvPutDedup default TTL 5min → 60min; static keys
 *                (store-info, store-id, domain, theme-lite, warm-lock,
 *                 prebuilt-head, spa-shell, all-active-slugs) → 24h.
 *            (D) _warmFullHtmlInBackground short-circuits on an in-memory
 *                warm-lock marker before doing KV.get + KV.put.
 *            (F) Static keys' 24h dedup acts as a once-per-isolate write
 *                cache — multiple cron passes and multi-colo fan-outs
 *                collapse to one write per isolate per day.
 *  v8.9.0 — recordPageView() now reads first-party `sb_vid` cookie and stores
 *           it as page_views.visitor_id. Counts unique visitors using a stable
 *           cookie ID instead of CGNAT-shared mobile IPs (15-25% accuracy lift).
 *  v8.7.0 — Storefront HTML now fetches the latest Lovable shell on every
 *           human navigation and sends no-store HTML headers. This prevents
 *           Cloudflare Worker Cache/KV/in-memory/browser HTML from pinning old
 *           Vite JS chunk names after a Lovable Publish → Update.
 *
 * Changes from v8.4.1:
 *  v8.5.0 — Cron full-sync now reads ALL store-id/domain KV keys before
 *           writing and skips unchanged values (was only checking store-info).
 *           All cron writes now route through kvPutDedup (5-min in-isolate
 *           dedup) so multi-colo fan-out collapses identical writes.
 *           all-active-slugs gains read-before-write skip.
 *           Expected: ~80% reduction in cron-driven KV writes (~2,900/day → ~600/day).
 *
 *
 * Changes from v6.1.0:
 *  FIX #20 — TTL increases: Shell KV 3600→86400, Cache 600→3600, Mem 10→30min.
 *            Storefront KV 3600→14400, Mem 2→10min, Cache 600→1200.
 *            Shell only changes on deploy; storefront data changes rarely.
 *  FIX #21 — Instant skeleton fast path: If _memShell is empty (true cold start),
 *            return a minimal themed skeleton HTML immediately instead of blocking
 *            on origin fetch. Warms shell in background via ctx.waitUntil.
 *  FIX #22 — ORIGIN_TIMEOUT_MS reduced from 8000→3500 to fail fast.
 *  FIX #23 — Removed blocking await _getSlugIndex(env) — fire-and-forget.
 *  FIX #24 — stale-while-revalidate reduced from 7200→600 on warmed HTML.
 *  FIX #25 — Cron skeleton fallback: if DB fails for a store, cache a themed
 *            skeleton instead of leaving the store cold.
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
 *             max-age=3600, stale-while-revalidate=600.
 *  FIX #11 — buildSkeleton() now uses the actual store bgColor (fixes white
 *             flash on dark-themed stores).
 *  FIX #12 — In-memory storefront data cache (_memStorefrontCache).
 *             After first request, DB is never hit again for 2 minutes.
 *  FIX #13 — STOREFRONT_PREFETCH_TIMEOUT_MS raised to 1000ms.
 *             With FIX #2 the clock starts earlier, so 1000ms is now safer.
 *  FIX #14 — Cron warms ALL stores (not just top 20) with concurrency=10.
 *  FIX #15 — Cron fetches SPA shell ONCE before the loop, reuses for all.
 */

const WORKER_VERSION = "8.50.0-instant-tracking-refresh";

/* ============================================================
   v8.33.0 — Meta-ban-prevention layer (P0 + P1)
   ------------------------------------------------------------
   P0 (bot-strip): When a known social/Meta/Google crawler UA
   hits ANY HTML page, we strip ALL tracker scripts (Pixel,
   GTM, GA, fbevents, inline fbq()/gtag() init blocks) before
   returning. This is the #1 defense Shopdeck uses — Meta's
   crawler can't link our 100+ stores via a shared Pixel ID
   if the Pixel never loads for their bot.

   P1 (header scrub): On custom-domain responses (host !=
   *.shopbanao.in, *.lovable.app), strip platform-fingerprint
   headers (x-worker-version, x-store-slug, x-shell-source,
   x-data-source, x-cache-*, x-edge-*, etc). Subdomain hosts
   keep them for our own debugging. Kills the "identical
   header shape across 20 stores" cluster signal.

   Both run in finalizeResponse() at the very end of fetch().
   ============================================================ */
const FINGERPRINT_HEADERS = [
  "x-worker-version",
  "x-store-slug",
  "x-shell-source",
  "x-data-source",
  "x-cache-status",
  "x-cache-timestamp",
  "x-edge-cache",
  "x-edge-key",
  "x-edge-mirror",
  "x-edge-cached",
  "x-products-source",
  "x-static-asset-cache",
  "x-seo-cache",
  "x-bot-cache",
  "x-sb-img-cache",
  "x-font-cache",
  "x-image-routing",
  "x-sb-proxy-cache",
];

const BOT_UA_RE =
  /facebookexternalhit|meta-externalagent|facebookbot|twitterbot|linkedinbot|slackbot|whatsapp|telegrambot|discordbot|pinterestbot|bingpreview|googlebot|googleimageproxy|adsbot-google|mediapartners-google|developers\.google\.com\/\+\/web\/snippet|embedly|quora link preview/i;

function _isBotUA(req) {
  try {
    return BOT_UA_RE.test(req.headers.get("user-agent") || "");
  } catch {
    return false;
  }
}

function _isPlatformHost(req) {
  try {
    const h = new URL(req.url).hostname.toLowerCase();
    if (h === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(h)) return true;
    if (h === "shopbanao.in" || h.endsWith(".shopbanao.in")) return true;
    if (h.endsWith(".lovable.app") || h.endsWith(".lovableproject.com")) return true;
    return false;
  } catch {
    return true;
  } // fail-open: keep debug headers
}

async function _stripTrackersForBot(response) {
  try {
    const ct = (response.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("text/html")) return response;
    let html = await response.text();
    // External tracker scripts
    html = html.replace(
      /<script\b[^>]*\b(?:src|href)\s*=\s*["'][^"']*(?:connect\.facebook\.net|fbevents\.js|googletagmanager\.com|google-analytics\.com|gtag\/js|googleadservices\.com)[^"']*["'][^>]*>\s*<\/script>/gi,
      "",
    );
    // Inline scripts containing fbq(), gtag(), or dataLayer init
    html = html.replace(
      /<script\b(?![^>]*\bsrc=)[^>]*>[\s\S]*?(?:fbq\s*\(|gtag\s*\(|dataLayer\s*=|_fbq\s*=)[\s\S]*?<\/script>/gi,
      "",
    );
    // <noscript> tracking pixels
    html = html.replace(
      /<noscript\b[^>]*>[\s\S]*?(?:facebook\.com\/tr|google-analytics\.com|googletagmanager\.com)[\s\S]*?<\/noscript>/gi,
      "",
    );
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    headers.set("x-bot-mode", "stripped"); // will itself be stripped on custom domains below
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch {
    return response;
  }
}

async function finalizeResponse(request, response) {
  try {
    // P0: bot UA → strip trackers from HTML
    if (_isBotUA(request)) {
      response = await _stripTrackersForBot(response);
    }
    // P1: custom domain → strip fingerprint headers
    if (!_isPlatformHost(request)) {
      const h = new Headers(response.headers);
      let mutated = false;
      for (const k of FINGERPRINT_HEADERS) {
        if (h.has(k)) {
          h.delete(k);
          mutated = true;
        }
      }
      // Also strip the bot-mode marker on custom domains
      if (h.has("x-bot-mode")) {
        h.delete("x-bot-mode");
        mutated = true;
      }
      if (mutated) {
        response = new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: h,
        });
      }
    }
  } catch {
    // Fail open — never break a response over fingerprint scrubbing
  }
  return response;
}

/* ============================================================
   v7.7.0 — RACE + DEDUP FIX (on top of v7.6.0)
   Targets: ~25k/day → ~10-15k/day (additional 40-50% reduction)

   Fix 1: warm-lock now SYNC PUT (was ctx.waitUntil deferred). Previously
          2+ isolates could read null then all proceed; the deferred write
          left the lock unset for ~500ms. Now set within ~50ms.
   Fix 2: Pass `inlineProducts` through fetchAndInjectSlug ➜ _warm…().
          Was being fetched 3× per request chain (handler + inject + warm).
          Now 1× per request.
   Fix 3: Removed orphaned storeInEdgeCache() in cachedFetch. The
          streaming response (no inline data) was overwriting the
          full-injected version that _warmFullHtmlInBackground writes.
   Fix 4: PREBUILT_HEAD_CACHE_TTL 60s→300s, KV 300s→1800s. Head only
          changes on store-settings save (which calls /api/purge).
   Fix 5: Supabase /rest/v1/ GET requests cached for 30s when anonymous
          (no user JWT). POST/PATCH/DELETE and authed reads bypass.
   ============================================================

   v7.6.0 — REQUEST HOT-PATH LEAK FIX (kept for history)
   Fix A: Removed 4 redundant _warmFullHtmlInBackground calls in cold paths.
   Fix B: KV-based cross-isolate warm-lock (`warm-lock:{slug}`, 5min TTL).
   Fix C: REVAL_COOLDOWN_MS 120s → 600s.
   Fix D: Removed `storefront`+`storeInfo` from _batchKvRead.
   Fix E: Shell TTLs raised (MEM 5m, KV 30m, Cache 5m).
   Fix F: MEM_PV_TTL 60s → 300s.
   Fix G: Cron `active-slugs-7d` cached in KV for 6h.
   ============================================================ */

/* ============================================================
   v7.3.0 — AGGRESSIVE CACHE + SWR + ETAG (3-5x worker req reduction)

   Optimizations applied:
   #1 HTML cache TTL: streaming 600→1800s, warm HTML SWR window 600→86400s
   #2 Stale-While-Revalidate: warm HTML serves stale up to 24h while revalidating
   #3 Static off-worker: /icons/*, /placeholder.svg, /sw-push.js, /registerSW.js,
      /manifest.webmanifest → direct cf.cacheEverything proxy with 1yr TTL
   #4 /assets/* hash-named chunks → cf.cacheEverything + immutable (already done,
      now also marked X-Static-Bypass for diagnostic)
   #5 ETag + If-None-Match: 304 Not Modified on warm HTML cache hits.
      Repeat visitors get a free 304 instead of full HTML payload.
   #6 Bot short-circuit: aggressive crawler block already at line ~2942.
      Empty/short UA also blocked. Now also serves cached 410 for attack paths.
   #8 KV bundle reads: already batched via _batchKvRead (shell+theme+storefront
      in one Promise.all). No further consolidation needed.
   ============================================================ */

/* ============================================================
   v6.4.0 — PRELOAD-SCANNER PRODUCT IMAGES (saves 2-3s on cold load)

   Problem: Products were inlined as JSON in <script>window.__PRODUCTS_INLINE__>.
   The browser preload scanner CANNOT read URLs from inside <script> tags,
   so image downloads only began after React mounted (~2.5s in).

   Fix: Two-pronged image fast-path:
     1. Inject <link rel="preload" as="image" fetchpriority="high"> tags for
        the first 6 product images directly in <head>. The preload scanner
        reads these at byte 0 and starts downloads immediately (~50ms).
     2. Render real <img> tags for the first 8 products inside the skeleton
        DOM. These act as a hidden "preloader grid" — the browser fetches
        them in parallel with the React JS bundle. By the time React mounts,
        images are already in the HTTP cache, so first paint is instant.

   Result: Hero product images download in parallel with JS instead of
   sequentially after JS executes. Expected gain: 2-3s on cold load.
   ============================================================ */
const ROOT_DOMAIN = "shopbanao.in";
const ORIGIN_HOST = "cosy-space-app.lovable.app";
const HTML_CACHE_SCHEMA_VERSION = "html-v3-publish-fresh-2026-05-04";
const R2_CDN_HOST = "cdn.shopbanao.in";

const SUPABASE_URL = "https://dqepeywgftbpxeeqfuwt.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxZXBleXdnZnRicHhlZXFmdXd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMjgxMzksImV4cCI6MjA5MDkwNDEzOX0.OtLtoGBJZuEthQyePzNgAltWJwSUEpWl1z_Bx_FY6Mk";

/* ============================================================
   BOT DETECTION
   ============================================================ */

const SEARCH_BOT_REGEX = /Googlebot|Bingbot|DuckDuckBot|YandexBot|Baiduspider|Applebot|Sogou|Exabot|ia_archiver/i;

// v6.9.4: Expanded bot block list. These crawlers generate massive request
// volume with zero business value. Blocked at the edge with 403 + 1-day cache
// so Cloudflare returns the cached 403 without hitting the Worker again.
const BLOCKED_BOT_REGEX =
  /AhrefsBot|SemrushBot|MJ12bot|DotBot|PetalBot|BLEXBot|DataForSeoBot|SeznamBot|GPTBot|ClaudeBot|anthropic-ai|CCBot|Bytespider|ZoominfoBot|MegaIndex|serpstatbot|SurdotlyBot|barkrowler|Mail\.RU_Bot|YisouSpider|Amazonbot|PerplexityBot|OAI-SearchBot|DuckAssistBot|Google-Extended|GoogleOther|FriendlyCrawler|ImagesiftBot|Diffbot|magpie-crawler|TurnitinBot|grapeshot|linkfluence|proximic|trendictionbot|TweetmemeBot|Buck|webmeup-crawler|SiteAuditBot|VelenPublicWebCrawler|sentibot|EzoicBot|netEstate|coccocbot|YaK|Neevabot|admantx|cohere-ai|FacebookBot|Bravebot|Timpibot|ChatGPT-User|cohere-training-data-crawler|Meta-ExternalAgent|Meta-ExternalFetcher|ICC-Crawler|Webzio|YouBot|ISSCyberRiskCrawler|Sidetrade|news-please|Scrapy|python-requests|Go-http-client|node-fetch|axios\//i;

// Common attack/probe paths — return 410 Gone with long cache so CF serves cached.
const ATTACK_PATH_REGEX =
  /^\/(wp-admin|wp-login|wp-includes|wp-content|wp-json|xmlrpc\.php|\.env|\.git|\.well-known\/security|\.aws|admin\.php|phpmyadmin|administrator|drupal|joomla|magento|laravel|vendor\/phpunit|fckeditor|HNAP1|cgi-bin|webdav|owa\/|ecp\/|autodiscover|invokefunction|console\/|actuator|hudson|jenkins|solr\/|elasticsearch|server-status|server-info)/i;

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

// FIX #22: Reduced from 8000→3500 to fail fast and serve skeleton instead
const ORIGIN_TIMEOUT_MS = 3_500;
const EDGE_FN_TIMEOUT_MS = 10_000;
// FIX #20: Raised from 1000→1500ms. Only applies to warm path (_memShell exists);
// the instant skeleton path (FIX #21) bypasses serveStreamedHtml entirely.
const STOREFRONT_PREFETCH_TIMEOUT_MS = 1_500;
const PRODUCTS_DB_TIMEOUT_MS = 3_000;

const cache = caches.default;

/* ============================================================
   v8.3.0 — EDGE-CACHE SYNTHESIZED RESPONSES (cache rate fix)
   ============================================================
   Worker-generated Response objects (Response.redirect, new Response with
   status 4xx/410, synthesized 204s) are NOT automatically stored in the
   Cloudflare edge cache, even when they carry Cache-Control headers. The
   only auto-cached responses are those returned via fetch() with
   cf.cacheEverything. As a result, every redirect/error invokes the Worker
   on every request and shows as 0% cache rate in the dashboard.

   We fix this by:
     1) `cacheableResponse(ctx, request, response, ttl)` — clones the
        response, sets a strong Cache-Control + Date header, and stores it
        in caches.default keyed on the request URL + method. Background.
     2) Early `cache.match(request)` at the very top of fetch() — returns
        the prior synthesized response in <1ms with zero pipeline work.

   Net effect: redirects, 410s, 403s, 405s, 404s are served straight from
   the colocated edge cache after the first hit, so CF reports them as
   cache hits and Worker subrequests drop to ~one per TTL window per edge.
   ============================================================ */
function cacheableResponse(ctx, request, response, ttl) {
  try {
    if (!ctx?.waitUntil || !response) return response;
    // Only cache safe methods. POST/HEAD vary too much.
    if (request.method !== "GET") return response;
    const cloned = response.clone();
    // Force a deterministic Cache-Control so cache.match honours TTL.
    const headers = new Headers(cloned.headers);
    if (!headers.has("cache-control")) {
      headers.set("Cache-Control", `public, max-age=${ttl}`);
    }
    headers.set("X-Edge-Cached", "synth");
    const toStore = new Response(cloned.body, {
      status: cloned.status,
      statusText: cloned.statusText,
      headers,
    });
    ctx.waitUntil(cache.put(request, toStore).catch(() => {}));
  } catch {}
  return response;
}

/* ============================================================
   FIX #1 — IN-MEMORY SPA SHELL (zero I/O on warm isolates)
   ============================================================ */

let _memShell = null;
let _memShellTs = 0;
// v6.9.1: Keep shell memory TTL short so new frontend publishes don't stay pinned
// on hot isolates after deploys. Storefront data can stay long-lived; the SPA shell cannot.
const MEM_SHELL_TTL = 300_000; // v7.6.0: 1m → 5m. Shell only changes on deploy.

/* ============================================================
   FIX #7 — IN-MEMORY PREBUILT HEAD (built once per isolate)
   ============================================================ */

let _memPrebuiltHead = null;

/* ============================================================
   FIX #8 — IN-MEMORY THEME CACHE PER SLUG
   ============================================================ */

const _memThemeCache = new Map();
const MEM_THEME_CACHE_MAX = 2_000;
// v6.8.0: Raised from 5min → 30min. Themes change rarely; cache invalidation
// already happens on dashboard save via /api/purge-cache. Reduces Supabase
// roundtrips on theme misses by ~6x per isolate.
const MEM_THEME_TTL = 1_800_000; // 30 min

/* ============================================================
   FIX #12 — IN-MEMORY STOREFRONT DATA CACHE PER SLUG
   ============================================================ */

const _memStorefrontCache = new Map();
// v6.8.0: Doubled from 1k → 2k slots to handle more stores per isolate
const MEM_STOREFRONT_CACHE_MAX = 2_000;
// v6.8.0: Raised from 10min → 30min. SWR pattern means stale data is still
// served instantly while a background refetch updates it. Cuts shell RPC
// calls by ~3x per isolate.
const MEM_STOREFRONT_TTL = 1_800_000; // 30 min

/* ============================================================
   REVALIDATION COOLDOWN
   ============================================================ */

const revalCooldowns = new Map();
const REVAL_COOLDOWN_MS = 600_000; // v7.6.0: 2min → 10min
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
    "script-src 'self' 'unsafe-inline' https://connect.facebook.net https://www.googletagmanager.com https://checkout.razorpay.com https://sdk.cashfree.com https://www.google-analytics.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://embed.tawk.to https://client.crisp.chat https://cdn.jsdelivr.net; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://client.crisp.chat; " +
    "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net data:; " +
    "img-src 'self' data: blob: https://*.supabase.co https://*.r2.dev https://*.cloudinary.com https://*.unsplash.com https://*.shopify.com https://*.myshopify.com https://www.google-analytics.com https://www.googletagmanager.com https://www.facebook.com https://cx.atdmt.com https:; " +
    "connect-src 'self' https://*.supabase.co https://connect.facebook.net https://graph.facebook.com https://api.razorpay.com https://lumberjack.razorpay.com https://api.cashfree.com https://sandbox.cashfree.com https://sdk.cashfree.com https://payments.cashfree.com https://payments-test.cashfree.com https://api.cashfree.com/pg https://sandbox.cashfree.com/pg https://lrcpkt0a.api.lc https://www.google-analytics.com https://www.googletagmanager.com https://embed.tawk.to https://client.crisp.chat; " +
    "frame-src https://api.razorpay.com https://checkout.razorpay.com https://api.cashfree.com https://sandbox.cashfree.com https://sdk.cashfree.com https://payments.cashfree.com https://payments-test.cashfree.com https://api.cashfree.com/pg https://sandbox.cashfree.com/pg https://embed.tawk.to; " +
    "worker-src 'self' blob:; " +
    "object-src 'none'; base-uri 'self'; form-action 'self' https://api.cashfree.com https://sandbox.cashfree.com https://api.cashfree.com/pg https://sandbox.cashfree.com/pg https://payments.cashfree.com https://payments-test.cashfree.com;",
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
  const m = pathname.match(/^\/products?\/([^/?#]+)/i);
  return m ? decodeURIComponent(m[1]) : null;
}

/* v8.16 — Rich bot-route detector. Maps a storefront pathname to a
   { kind, slug? } payload passed to the bot-render edge function.
   Covers product, category, custom page, listing, and static info routes.
   Returns { kind: "home" } for the store root.                       */
function getBotRoute(pathname) {
  if (!pathname || pathname === "/" || pathname === "") return { kind: "home" };
  let m = pathname.match(/^\/products?\/([^/?#]+)\/?$/i);
  if (m) return { kind: "product", slug: decodeURIComponent(m[1]) };
  m = pathname.match(/^\/category\/([^/?#]+)\/?$/i);
  if (m) return { kind: "category", slug: decodeURIComponent(m[1]) };
  m = pathname.match(/^\/page\/([^/?#]+)\/?$/i);
  if (m) return { kind: "page", slug: decodeURIComponent(m[1]) };
  if (/^\/shop\/?$/i.test(pathname)) return { kind: "shop" };
  if (/^\/best-sellers\/?$/i.test(pathname)) return { kind: "best-sellers" };
  if (/^\/categories\/?$/i.test(pathname)) return { kind: "categories" };
  if (/^\/about\/?$/i.test(pathname)) return { kind: "about" };
  if (/^\/contact\/?$/i.test(pathname)) return { kind: "contact" };
  if (/^\/track-order\/?$/i.test(pathname)) return { kind: "track-order" };
  return null; // unknown route — fall back to home/SPA
}

function buildSubdomainUrl(slug, path, search = "") {
  return `https://${slug}.${ROOT_DOMAIN}${path}${search}`;
}

// Normalized early-cache key. v8.9.1: PDP and Category routes get their own
// per-slug bucket so they receive HTML with __PRODUCT_INLINE__ /
// __CATEGORY_INLINE__ instead of the home-page HTML on cache HIT.
function getEarlyCacheKey(hostname, pathname = "/") {
  let bucket = "/";
  if (pathname) {
    const m = pathname.match(/^\/(product|category)\/([a-zA-Z0-9_-]+)\/?$/);
    if (m) bucket = `/${m[1]}/${m[2]}/`;
  }
  return new Request(`https://edge-html/${HTML_CACHE_SCHEMA_VERSION}/${hostname.toLowerCase()}${bucket}`);
}

// v8.25.1: Real-hostname cache key for caches.default mirror.
// CF's cache.put() requires a Request whose URL hostname is in the zone.
// Synthetic hosts like `edge-html/...` are silently rejected → permanent MISS.
// We use the actual hostname + clean pathname (no query, no cookies, no Vary)
// so all anonymous visitors to the same URL share one cache entry.
function _normalizeHtmlPath(pathname) {
  let p = pathname || "/";
  const m = p.match(/^\/(product|category)\/([a-zA-Z0-9_-]+)\/?$/);
  if (m) p = `/${m[1]}/${m[2]}/`;
  return p;
}

function getCfCacheKey(hostname, pathname) {
  return new Request(`https://${hostname.toLowerCase()}${_normalizeHtmlPath(pathname)}`, { method: "GET" });
}

// v8.25.2: Canonical zone-owned cache key keyed by store slug.
// Custom domains (e.g. serdiyajewellers.shop) live outside the Worker zone,
// which makes cache.put() on the real-host key occasionally inconsistent
// across colos. By ALSO mirroring to `https://<slug>.shopbanao.in<path>`
// — which is always inside the Worker's zone — both subdomain and
// custom-domain visitors share one reliable cache entry.
function getCanonicalHtmlCacheKey(slug, pathname) {
  if (!slug) return null;
  return new Request(`https://${slug}.${ROOT_DOMAIN}${_normalizeHtmlPath(pathname)}`, { method: "GET" });
}

/* ============================================================
   v8.27.0 — KV-BACKED HTML CACHE (global, cross-colo HIT-EARLY)
   ------------------------------------------------------------
   caches.default is colo-local: a cache.put() in BOM (Mumbai) does NOT
   serve in DEL (Delhi), so first-time visitors in each colo still hit
   the full pipeline. KV replicates globally within seconds, so once
   any colo warms a URL all 300+ colos can serve it in ~5–15ms.

   Safety:
   - 60s TTL (matches user's no-stale tolerance; dashboard purge already
     wipes via existing purge handlers).
   - Write gated by per-isolate dedup (55s) → at most ~1 write per
     isolate per minute per URL. Combined with multi-isolate spread,
     expect ~1.5x the unique URL count in writes/day (very cheap).
   - Skipped entirely for: authenticated cookies, /checkout, /dashboard,
     /admin, /api, non-200 responses, non-HTML nav, payloads > 800 KB.
   - Read is best-effort (5ms timeout via Promise.race not needed —
     KV global reads avg 2–8ms); MISS falls through to existing
     CF-cache / canonical / warm pipeline. Zero functional regression.
   ============================================================ */
// v8.47.0 KV-WRITE COST CUT: TTL 60s→600s, dedup 55s→540s.
// Was causing ~70% KV-write spike since v8.27.0 — every URL re-wrote
// every minute per isolate. Product/price changes still bust instantly
// via _bumpProductVersion() cache-key bump, so 10-min stale is only for
// non-versioned static edits (manually purgeable from dashboard).
// Expected: ~85% KV write reduction with zero functional regression.
const HTML_KV_TTL_SEC = 600;
const HTML_KV_MAX_BYTES = 800_000; // 800 KB hard cap (KV value limit is 25 MB)
const _htmlKvWriteRecent = new Map(); // key → expiresAt
const HTML_KV_WRITE_DEDUP_MS = 540_000;
const HTML_KV_WRITE_DEDUP_MAX = 5_000;

function getHtmlKvKey(slug, pathname) {
  if (!slug) return null;
  return `html:${slug}${_normalizeHtmlPath(pathname)}`;
}

function _shouldWriteHtmlKv(key) {
  const now = Date.now();
  const exp = _htmlKvWriteRecent.get(key);
  if (exp && now < exp) return false;
  if (_htmlKvWriteRecent.size > HTML_KV_WRITE_DEDUP_MAX) {
    let n = 1000;
    for (const k of _htmlKvWriteRecent.keys()) {
      _htmlKvWriteRecent.delete(k);
      if (--n <= 0) break;
    }
  }
  _htmlKvWriteRecent.set(key, now + HTML_KV_WRITE_DEDUP_MS);
  return true;
}

async function kvHtmlGet(env, slug, pathname) {
  if (!env?.STORE_KV || !slug) return null;
  const key = getHtmlKvKey(slug, pathname);
  if (!key) return null;
  try {
    const { value, metadata } = await env.STORE_KV.getWithMetadata(key, { type: "arrayBuffer" });
    if (!value) return null;
    const headers = new Headers();
    const meta = metadata || {};
    if (meta.h && typeof meta.h === "object") {
      for (const [hk, hv] of Object.entries(meta.h)) {
        if (typeof hv === "string") headers.set(hk, hv);
      }
    }
    if (!headers.has("Content-Type")) headers.set("Content-Type", "text/html; charset=utf-8");
    headers.set("Cache-Control", "public, max-age=600, stale-while-revalidate=86400");
    return new Response(value, { status: meta.s || 200, headers });
  } catch {
    return null;
  }
}

function kvHtmlPut(ctx, env, slug, pathname, response) {
  try {
    if (!env?.STORE_KV || !slug || !response || !ctx?.waitUntil) return;
    if (response.status !== 200) return;
    const key = getHtmlKvKey(slug, pathname);
    if (!key) return;
    if (!_shouldWriteHtmlKv(key)) return;
    const cloned = response.clone();
    ctx.waitUntil(
      (async () => {
        try {
          const buf = await cloned.arrayBuffer();
          if (!buf || buf.byteLength === 0 || buf.byteLength > HTML_KV_MAX_BYTES) return;
          const h = {};
          const ct = cloned.headers.get("Content-Type");
          if (ct) h["Content-Type"] = ct;
          const link = cloned.headers.get("Link");
          if (link) h["Link"] = link;
          await env.STORE_KV.put(key, buf, {
            expirationTtl: HTML_KV_TTL_SEC,
            metadata: { s: cloned.status, h },
          });
        } catch {}
      })(),
    );
  } catch {}
}

// Fast, I/O-free slug resolution for the early request path.
// - Subdomains under ROOT_DOMAIN: derive slug from the hostname.
// - Custom domains: look up cached domain→slug mapping in caches.default
//   ONLY (no KV/DB). Returns null on miss; the canonical-key check is
//   simply skipped and the existing fallbacks handle the request.
async function _earlyResolveSlug(hostname, env = null) {
  if (!hostname) return null;
  const host = hostname
    .replace(/^www\./, "")
    .toLowerCase()
    .trim();
  if (host.endsWith(`.${ROOT_DOMAIN}`)) {
    const sub = host.slice(0, -`.${ROOT_DOMAIN}`.length);
    if (sub && !sub.includes(".")) return sub;
    return null;
  }
  // Cache API first (sub-ms).
  try {
    const cached = await cache.match(new Request(`https://cache/domain-${host}`));
    if (cached) {
      const data = await cached.json();
      if (data?.slug) return data.slug;
    }
  } catch {}
  // v8.26.0: KV fallback (~5ms). Synthetic `https://cache/...` writes are
  // silently rejected by Cloudflare in some colos → Cache API miss is common
  // even when KV has a perfectly good mapping. Without this fallback, custom
  // domains can never resolve their slug in the early path, which means the
  // canonical-slug cache key (v8.25.2) is never tried, and every visit MISSes.
  if (env?.STORE_KV) {
    try {
      const kvData = await env.STORE_KV.get(`domain:${host}`, { type: "json" });
      if (kvData?.slug) return kvData.slug;
    } catch {}
  }
  return null;
}

function isHtmlNavigationPath(pathname) {
  return !pathname.startsWith("/api/") && !pathname.startsWith("/assets/") && !pathname.includes(".");
}

function forcePublicHtmlCacheControl(headers, ttl = 3600) {
  const current = headers.get("Cache-Control") || "";
  if (!current || /no-store|no-cache|private|max-age=0|must-revalidate/i.test(current)) {
    headers.set("Cache-Control", `public, max-age=${ttl}, stale-while-revalidate=86400`);
  }
}

function makePublicHtmlResponse(response, ttl = 3600) {
  const headers = new Headers(response.headers);
  headers.delete("Set-Cookie");
  headers.delete("set-cookie");
  forcePublicHtmlCacheControl(headers, ttl);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function isCheckoutHtmlPath(pathname) {
  return pathname === "/checkout" || pathname.startsWith("/checkout/");
}

const STOREFRONT_HTML_MIRROR_PATHS = ["/", "/checkout", "/cart"];

/* v8.4.0: Mirror the warmed HTML into Cloudflare's automatic Cache API
   keyed on the ACTUAL request URL. The early-key cache (above) is what
   the Worker reads on warm hits; mirroring to the request URL is what
   makes Cloudflare's dashboard report `cf-cache-status: HIT` and counts
   as a real edge cache hit (the early key is invisible to CF metrics).
   Stripping Set-Cookie + forcing public Cache-Control prevents CF's
   default auto-bypass on cookie/auth responses. */
async function mirrorToCfCache(ctx, request, response, slug = null, env = null) {
  try {
    if (!response || request.method !== "GET") return;
    if (/no-store|no-cache|max-age=0/i.test(response.headers.get("Cache-Control") || "")) return;
    // Skip authenticated paths to avoid leaking user-specific HTML
    const cookie = request.headers.get("cookie") || "";
    if (cookie.includes("auth") || cookie.includes("sb-")) return;
    const url = new URL(request.url);
    if (
      url.pathname.startsWith("/api/") ||
      url.pathname.startsWith("/dashboard") ||
      url.pathname.startsWith("/admin") ||
      isCheckoutHtmlPath(url.pathname)
    )
      return;
    const cloned = response.clone();
    const headers = new Headers(cloned.headers);
    headers.delete("Set-Cookie");
    headers.delete("set-cookie");
    // v8.25.0: strip Vary so CF cache doesn't fragment by Accept-Encoding/cookie
    headers.delete("Vary");
    headers.delete("vary");
    // Force a deterministic, public Cache-Control so CF stores it. Lovable origin
    // sends `no-cache, max-age=0`; leaving that intact makes CF cache rate stay 0%.
    forcePublicHtmlCacheControl(headers, 3600);
    headers.set("X-Edge-Mirror", "1");
    // Buffer body once so we can write to multiple cache keys.
    const buf = await cloned.arrayBuffer();
    const makeStored = () =>
      new Response(buf, {
        status: cloned.status,
        statusText: cloned.statusText,
        headers,
      });
    // v8.25.1: store under REAL hostname key.
    const writes = [];
    const cfKey = getCfCacheKey(url.hostname, url.pathname);
    writes.push(cache.put(cfKey, makeStored()));
    // v8.25.2: ALSO store under canonical slug-subdomain key (always inside the
    // Worker zone). Custom-domain visitors fall back to this key when the
    // real-host write was rejected silently by a cross-zone colo.
    if (slug) {
      const canonical = getCanonicalHtmlCacheKey(slug, url.pathname);
      if (canonical) writes.push(cache.put(canonical, makeStored()));
    }
    await Promise.allSettled(writes);
    // v8.27.0: ALSO mirror into KV for global cross-colo HIT-EARLY.
    // KV write is gated by per-isolate 55s dedup so we never thrash KV.
    if (slug && env) {
      kvHtmlPut(ctx, env, slug, url.pathname, new Response(buf, { status: cloned.status, headers }));
    }
  } catch {}
}

function addDiagnosticHeaders(response, { slug, cacheStatus, dataSource }) {
  const res = new Response(response.body, response);
  if (slug) res.headers.set("X-Store-Slug", slug);
  res.headers.set("X-Cache-Status", cacheStatus);
  // v8.26.0: ONLY overwrite cf-cache-status when we know the answer is a HIT
  // (cached/edge/memory/kv/warm). For MISS / cold paths, leave cf-cache-status
  // untouched so Cloudflare's automatic edge cache result is visible. The old
  // code mirrored every internal status (including MISS) to cf-cache-status,
  // which permanently masked real CF edge HITs and made the dashboard cache
  // rate look stuck at 0%.
  if (cacheStatus && /^(hit|cached|memory|kv|edge|warm)/i.test(cacheStatus)) {
    res.headers.set("cf-cache-status", "HIT");
  }
  if (dataSource) res.headers.set("X-Data-Source", dataSource);
  return res;
}

function addCorsHeaders(response, source) {
  const res = new Response(response.body, response);
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type");
  res.headers.set("X-Products-Source", source || "unknown");
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

// v8.10.0 — FAST DISMISS: kill skeleton as soon as React paints the shell
// (storefront:content-ready). Previously we polled for a real <img> to finish
// downloading, which on mobile 4G added 800–1500ms while waiting on the LCP
// product image. OptimizedImage already ships blur-up placeholders, so there's
// no blank-flash risk — images just progressively fade in over their own
// placeholder once decoded.
//
// Order of dismissal triggers (whichever fires first):
//   1. storefront:content-ready event (React shell painted)        — primary
//   2. #root has measurable content (height > 120px)               — safety net
//   3. fallbackMs (12s) hard kill                                  — last resort
function getSkeletonCleanupScript(fallbackMs = 12000) {
  return `<script>(function(){
    var removed=false;
    function kill(){
      if(removed)return;
      var s=document.getElementById('sf-skel');
      if(!s)return;
      removed=true;
      s.style.transition='opacity 120ms linear';
      s.style.opacity='0';
      setTimeout(function(){s.style.visibility='hidden';s.style.display='none';if(s.remove)s.remove();},130);
    }
    function hasShellPainted(){
      var root=document.getElementById('root');
      if(!root)return false;
      if(root.querySelector('[data-storefront-ready]'))return true;
      // v8.17.0 cold-load fix: 400px threshold made us wait extra rAF ticks
      // for product image rows to lay out. 120px = nav + first content row,
      // which is enough to guarantee no blank flash (OptimizedImage already
      // ships blur placeholders so images progressively fade in).
      var totalHeight=0;var kids=root.children;
      for(var i=0;i<kids.length;i++){totalHeight+=kids[i].offsetHeight;}
      return totalHeight>120;
    }
    // Wait until the React shell has actually painted real content before killing
    // the skeleton — prevents the white blank flash between skeleton fade and
    // first product-grid paint.
    function dismissWhenPainted(){
      if(removed)return;
      if(hasShellPainted()){
        requestAnimationFrame(kill);
        return;
      }
      // Poll fast (every animation frame) until paint lands or 2s elapse
      var waited=0;
      function tick(){
        if(removed)return;
        if(hasShellPainted()){requestAnimationFrame(kill);return;}
        waited+=16;
        if(waited>2000){requestAnimationFrame(kill);return;} // give up gating
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }
    // Primary: React fires this once it has mounted & double-rAF'd the shell
    window.addEventListener('storefront:content-ready',dismissWhenPainted,{once:true});
    // Safety net: poll DOM in case the event was missed (e.g. React errored)
    var tries=0;
    function poll(){
      if(removed)return;
      if(hasShellPainted()){requestAnimationFrame(kill);return;}
      tries++;
      if(tries>300)return; // give up polling, rely on fallbackMs
      setTimeout(poll,32);
    }
    if(document.readyState!=='loading')poll();
    else document.addEventListener('DOMContentLoaded',poll,{once:true});
    setTimeout(kill,${fallbackMs});
  })()</script>`;
}

function buildSkeleton(
  bgColor,
  skeletonMuted,
  includeCleanup = true,
  storeName = "",
  textColor = "#1a1a1a",
  primaryColor = "#004643",
) {
  // Custom loader (uiverse "mean-puma-17") — nested rotating rings using
  // the store's brand primary color. Shown ONLY on initial store load;
  // all in-app skeletons (PDP, category, etc.) remain untouched.
  const skelBg = bgColor || "#ffffff";
  const ringColor = primaryColor || "#004643";

  const spinnerCss = `<style id="sf-skel-anim">@keyframes sf-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}#sf-skel .sf-spin-wrap{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:150px;height:150px}#sf-skel .sf-ring{position:absolute;inset:0;border:5px solid transparent;border-radius:50%;border-top-color:${ringColor};animation:sf-spin 5s cubic-bezier(0.17,0.49,0.96,0.79) infinite}#sf-skel .sf-ring>.sf-ring{inset:4.95px}</style>`;

  // v6.3.0: Set __SF_WORKER__ flag BEFORE skeleton so index.html knows Worker
  // already injected its loader — inline fallback is suppressed.
  let s = `<script>window.__SF_WORKER__=true;</script>${spinnerCss}<div id="sf-skel" aria-hidden="true" style="position:fixed;inset:0;min-height:100vh;background:${skelBg};z-index:2147483000;pointer-events:none;overflow:hidden">`;
  s += `<div class="sf-spin-wrap"><div class="sf-ring"><div class="sf-ring"><div class="sf-ring"><div class="sf-ring"><div class="sf-ring"><div class="sf-ring"></div></div></div></div></div></div></div>`;
  s += `</div>`;
  if (includeCleanup) s += getSkeletonCleanupScript();
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
    `}body{background:${bgColor};color:${textColor}}` +
    /* ─── Phase 2 Fix #4: Critical product-card CSS ───
       ~2KB of layout-critical CSS so the first product card grid paints
       immediately on React's first commit, BEFORE the ~80KB index.css
       chunk loads. Saves 600-800ms LCP on cold loads.
       Scoped with [data-sf-crit] so production CSS overrides cleanly. */
    `.sf-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:0 12px;width:100%;box-sizing:border-box}` +
    `@media(min-width:768px){.sf-grid{grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;padding:0 16px}}` +
    `@media(min-width:1280px){.sf-grid{grid-template-columns:repeat(5,minmax(0,1fr))}}` +
    `.sf-card{position:relative;border-radius:12px;overflow:hidden;background:${bgColor};border:1px solid #ececec;display:flex;flex-direction:column;min-height:280px;contain:layout style}` +
    `.sf-card-img{position:relative;width:100%;aspect-ratio:4/5;background:#f5f5f5;overflow:hidden}` +
    `.sf-card-img img{width:100%;height:100%;object-fit:contain;display:block}` +
    `.sf-card-body{padding:8px 10px 10px;display:flex;flex-direction:column;gap:4px;flex:1}` +
    `.sf-card-title{font-size:13px;line-height:1.3;color:${textColor};margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:34px}` +
    `.sf-card-price{font-size:14px;font-weight:600;color:${textColor};margin:2px 0 0}` +
    `.sf-card-price-old{font-size:12px;color:#999;text-decoration:line-through;margin-left:6px;font-weight:400}` +
    `.sf-card-btn{margin-top:auto;height:32px;border-radius:${btnRadius};background:${primaryColor};color:${btnTextColor};border:0;font-size:12px;font-weight:600;cursor:pointer;width:100%}` +
    /* Hero / banner reservations to prevent CLS */
    `.sf-hero{width:100%;aspect-ratio:16/9;background:#f5f5f5;contain:layout}` +
    `@media(min-width:768px){.sf-hero{aspect-ratio:21/9}}` +
    /* Header reservation */
    `.sf-header-stub{height:56px;background:${bgColor};border-bottom:1px solid #ececec;contain:layout}` +
    /* Universal anti-CLS for storefront images */
    `[data-sf-img]{display:block;width:100%;height:auto;aspect-ratio:4/5;object-fit:contain;background:#f5f5f5}` +
    `</style>\n`;

  const fonts = [...new Set([headingFont, bodyFont].filter(Boolean))];
  if (fonts.length > 0) {
    // v8.6 — self-hosted font whitelist. Fonts already shipped under /fonts/
    // emit local @font-face blocks (zero external network) instead of going
    // to Google Fonts CSS. Saves the 144-221ms render-blocking gstatic round-
    // trip + woff2 fetch per font family. Falls through to Google Fonts only
    // for families we don't self-host.
    const SELF_HOSTED = {
      "Alegreya SC": [
        { weight: 400, url: "/fonts/alegreya-sc-400.woff2" },
        { weight: 700, url: "/fonts/alegreya-sc-700.woff2" },
      ],
      Poppins: [
        { weight: 400, url: "/fonts/poppins-400.woff2" },
        { weight: 500, url: "/fonts/poppins-500.woff2" },
        { weight: 600, url: "/fonts/poppins-600.woff2" },
        { weight: 700, url: "/fonts/poppins-700.woff2" },
        { weight: 800, url: "/fonts/poppins-800.woff2" },
      ],
      Inter: [{ weight: 400, url: "/fonts/inter-latin.woff2" }],
      Outfit: [{ weight: 400, url: "/fonts/outfit-latin.woff2" }],
      "Montserrat Alternates": [
        { weight: 400, url: "/fonts/montserrat-alternates-400.woff2" },
        { weight: 500, url: "/fonts/montserrat-alternates-500.woff2" },
        { weight: 600, url: "/fonts/montserrat-alternates-600.woff2" },
        { weight: 700, url: "/fonts/montserrat-alternates-700.woff2" },
      ],
      // Mulish ships as a variable font — single file covers 200–900
      Mulish: [{ weight: 400, url: "/fonts/mulish-latin.woff2" }],
    };
    const localFonts = fonts.filter((f) => SELF_HOSTED[f]);
    const remoteFonts = fonts.filter((f) => !SELF_HOSTED[f]);

    // Emit local @font-face for self-hosted families
    // v8.13 — display:optional (was swap) → eliminates FOUT/CLS. If font isn't
    // ready in ~100ms, browser uses fallback and NEVER swaps. Repeat visitors
    // (font cached) get the real font on first paint.
    if (localFonts.length > 0) {
      // v8.39 — The selected heading font must appear on first paint. Use
      // display:block for the heading family (both regular/bold because many
      // headers render at 400), while body-only families stay optional.
      let faceCss = "<style data-sf-font-local>";
      for (const fam of localFonts) {
        for (const f of SELF_HOSTED[fam]) {
          const display = fam === headingFont ? "block" : "optional";
          faceCss += `@font-face{font-family:'${fam}';font-style:normal;font-weight:${f.weight};font-display:${display};src:url('${f.url}') format('woff2')}`;
        }
      }
      faceCss += "</style>\n";
      css += faceCss;

      // v8.39 — Preload heading regular + bold so the selected font is ready
      // before first paint across headers rendered at either 400 or 700.
      const headFam = headingFont && SELF_HOSTED[headingFont] ? headingFont : localFonts[0];
      if (headFam && SELF_HOSTED[headFam]) {
        const picks = SELF_HOSTED[headFam].filter((f) => f.weight === 400 || f.weight === 700 || f.weight === 600);
        const urls = [...new Set((picks.length ? picks : [SELF_HOSTED[headFam][0]]).map((f) => f.url))];
        for (const url of urls) {
          css += `<link rel="preload" as="font" type="font/woff2" href="${url}" crossorigin fetchpriority="high" data-sf-font="1" />\n`;
        }
      }
    }

    // v8.39 — Google Fonts CSS uses display=block so non-self-hosted selected
    // heading fonts do not flash as fallback on cold visits.
    if (remoteFonts.length > 0) {
      const families = remoteFonts.map((f) => `family=${f.replace(/ /g, "+")}:wght@400;600;700`).join("&");
      const googleFontsHref = `https://fonts.googleapis.com/css2?${families}&display=block`;
      css += `<link rel="preconnect" href="https://fonts.googleapis.com" />\n`;
      css += `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n`;
      css += `<link rel="preload" as="style" href="${googleFontsHref}" fetchpriority="high" data-sf-font="1" />\n`;
      css += `<link id="storefront-google-fonts" rel="stylesheet" href="${googleFontsHref}" media="print" onload="this.media='all';this.dataset.loaded='true'" data-loaded="false" data-sf-font="1" />\n`;
      css += `<noscript><link rel="stylesheet" href="${googleFontsHref}" /></noscript>\n`;
    }

    css += `<style>:root{--storefront-heading-font:'${fonts[0] || "Inter"}';--storefront-body-font:'${fonts[fonts.length > 1 ? 1 : 0] || "Inter"}'}</style>\n`;
  }

  return { css, bgColor, textColor, primaryColor, btnTextColor, btnRadius, primaryLight };
}

function getSkeletonMuted(textColor) {
  return textColor === "#1a1a1a" ? "#e8e8e8" : "rgba(255,255,255,0.12)";
}

/* ============================================================
   FIX #21 — INSTANT SKELETON PAGE (returned on true cold start)
   ============================================================ */

function _buildInstantSkeletonPage(slug, bgColor, themeLite, hostname, inlineProducts) {
  const themeCss = themeLite ? buildThemeCssFromConfig(themeLite).css : "";
  const skeletonMuted = themeLite ? getSkeletonMuted(themeLite.tc || themeLite.text_color || "#1a1a1a") : "#e8e8e8";
  const skeleton = buildSkeleton(
    bgColor,
    skeletonMuted,
    false,
    (themeLite && (themeLite.name || themeLite.store_name)) || slug || "",
    (themeLite && (themeLite.tc || themeLite.text_color)) || "#1a1a1a",
    (themeLite && (themeLite.pc || themeLite.primary_color)) || "#004643",
  );
  const safeSlug = (slug || "").replace(/[<>"'&]/g, "");

  // Build canonical URL
  let canonicalUrl = `https://${safeSlug}.${ROOT_DOMAIN}/`;
  if (hostname && !hostname.endsWith(`.${ROOT_DOMAIN}`)) {
    canonicalUrl = `https://${hostname}/`;
  }

  // v6.5.0 — Inject product image preloads + preloader grid into the cold
  // skeleton so images start downloading at byte 0, in parallel with the
  // background warm fetch. Without this the cold path lost the entire
  // preload-scanner advantage from v6.4.x.
  let productImagePreloads = "";
  let productPreloaderGrid = "";
  if (inlineProducts && typeof inlineProducts === "string") {
    productImagePreloads = _buildProductImagePreloads(inlineProducts, 6);
    productPreloaderGrid = _buildProductPreloaderGrid(inlineProducts, 8);
  }

  // Preconnect to Supabase storage so image TLS/TCP is already warm by the
  // time the preload scanner starts the actual image fetches.
  const preconnects = ""; // v8.32: removed shared-infra preconnect leak

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="canonical" href="${canonicalUrl}" />
<script>window.__STORE_SLUG__="${safeSlug}";</script>
${preconnects}
${productImagePreloads}
${themeCss}
<style>body{margin:0;font-family:'Inter','Segoe UI',sans-serif;-webkit-font-smoothing:antialiased;background:${bgColor}}</style>
</head>
<body>
${skeleton}
${productPreloaderGrid}
<script>
// v6.6.0: No more document.write swap (was causing double/triple skeletons).
// Just hard-reload so the user gets the now-warm cached HTML on next hit.
// This page is only served by the cron warmer fallback now — the main
// request paths (subdomain + custom domain) ship the real React shell.
<script>
// v8.16.0: Reload removed. This page is unused (kept for cron warmer
// fallback only). A setTimeout(location.reload, 1500) here used to
// cause an auto-refresh loop in any WebView that hit it. The real
// HTML shell is served by the main subdomain/custom-domain handlers.
</script>
</body>
</html>`;
}

/* ============================================================
   v6.6.0 — Cold-shell-only Prefetch Promise
   When the cold path has the shell but data isn't ready within the
   deadline, we ship the real shell + a prefetch Promise that React
   awaits (StorefrontLayout.logic.ts already supports
   window.__STOREFRONT_PREFETCH__). React boots ONCE, awaits, renders.
   No document.write. No double skeleton.
   ============================================================ */
function _buildPrefetchPromiseScript(slug) {
  // v8.2.0 Fix #2: Eliminated the browser-side fetch("/?__sf_data=1") call.
  // It was responsible for ~15-20% of Worker requests (one self-call per
  // cold-shell-only render). React's StorefrontLayout.logic.ts already
  // falls back to a direct Supabase RPC (rpcGetStorefrontShell) when
  // __STOREFRONT_PREFETCH__ is absent — same UX, no Worker hop.
  const safeSlug = (slug || "").replace(/[<>"'&]/g, "");
  return `<script>window.__STORE_SLUG__="${safeSlug}";</script>`;
}

const PREBUILT_HEAD_KV_KEY = "prebuilt-head:v1";
// v6.9.1: Derived from the SPA shell, so it must expire on the same short window.
const PREBUILT_HEAD_KV_TTL = 86400; // v8.1.0 cost-cut: 6h → 24h (purge bumps version)
const PREBUILT_HEAD_CACHE_TTL = 300; // v7.7.0 Fix 4: 1m → 5m

function _buildPrebuiltHead(html) {
  // FIX #7: Cache result in module-level variable — computed once per isolate
  if (_memPrebuiltHead) return _memPrebuiltHead;

  let head = "";
  // v8.32: removed shared-infra preconnect leak (was leaking same Supabase project ID across 100 stores)

  const cssMatch = html.match(/href="(\/assets\/[^"]+\.css)"/);
  if (cssMatch) {
    head += `<link rel="preload" href="${cssMatch[1]}" as="style" />`;
  }

  const DASHBOARD_CHUNK_PATTERN =
    /(?:charts|dash-vendor|admin-pages|dashboard-pages|dashboard-shell|WhatsApp|auth-pages)-/;
  const seen = new Set();
  let mpCount = 0;
  for (const m of [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)]) {
    if (!seen.has(m[1]) && !DASHBOARD_CHUNK_PATTERN.test(m[1])) {
      seen.add(m[1]);
      head += `<link rel="modulepreload" href="${m[1]}" />`;
      mpCount++;
    }
  }
  // v8.22.0: Stash the entry chunk path so deep-preload pass can fetch + parse
  // it after this synchronous build completes. We cannot fetch here (no async).
  const entry = [...seen][0];
  if (entry) head += `<!--ENTRY:${entry}-->`;

  _memPrebuiltHead = head;
  return head;
}

/* ============================================================
   v8.22.0 — DEEP MODULEPRELOAD: discover 2nd-tier chunks
   (App.js, storefront-shell.js, supabase, radix, router-query…)
   by fetching the entry chunk once and extracting its dynamic
   imports. Cached in KV for 24h. Removes the 3-deep waterfall
   that adds ~1.5s on mobile cold loads.
   ============================================================ */

let _memDeepChunks = null;
const DEEP_CHUNKS_KV_KEY = "deep-chunks:v2"; // v8.24.1 bust stale empty cache
const DEEP_CHUNKS_TTL = 86400; // 24h
const DEEP_CHUNK_DASH_PATTERN =
  /(?:charts|dash-vendor|admin-pages|dashboard-pages|dashboard-shell|WhatsApp|auth-pages|landing-)/;

async function getDeepChunkPreloads(entryPath, origin, env) {
  if (_memDeepChunks) return _memDeepChunks;
  // KV first
  if (env?.STORE_KV) {
    try {
      const cached = await env.STORE_KV.get(DEEP_CHUNKS_KV_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        // Invalidate if entry hash changed (new deploy)
        if (parsed.entry === entryPath && Array.isArray(parsed.chunks)) {
          _memDeepChunks = parsed.chunks;
          return _memDeepChunks;
        }
      }
    } catch {}
  }
  // Fetch entry JS and extract imports
  try {
    const res = await fetch(`${origin}${entryPath}`, {
      cf: { cacheTtl: 3600, cacheEverything: true },
    });
    if (!res.ok) return [];
    const code = await res.text();
    const found = new Set();
    // v8.24.1: Vite ACTUALLY emits relative paths in the entry chunk
    // (e.g. `import{...}from"./entry-utils-DnXwcs32.js"`), not absolute
    // `/assets/...` strings. Previous regex matched zero chunks → only
    // 1 modulepreload ever shipped → cold load still waterfalled.
    // Now match both forms and normalize to /assets/<file>.
    const RX = /["'`](?:\.\/|\.?\/?assets\/)?([A-Za-z0-9_\-]+-[A-Za-z0-9]{6,})\.js["'`]/g;
    for (const m of code.matchAll(RX)) {
      const p = "/assets/" + m[1] + ".js";
      if (p === entryPath) continue;
      if (DEEP_CHUNK_DASH_PATTERN.test(p)) continue;
      found.add(p);
    }

    // Storefront-critical chunk names — prioritize these first
    const PRIORITY =
      /(?:App-|storefront-shell-|supabase-|radix|router-query-|framework-|entry-utils-|icons-|ErrorBoundary-|logError-)/;
    const arr = [...found]
      .sort((a, b) => {
        const pa = PRIORITY.test(a) ? 0 : 1;
        const pb = PRIORITY.test(b) ? 0 : 1;
        return pa - pb;
      })
      .slice(0, 12); // cap at 12 to avoid head bloat
    _memDeepChunks = arr;
    if (env?.STORE_KV) {
      env.STORE_KV.put(DEEP_CHUNKS_KV_KEY, JSON.stringify({ entry: entryPath, chunks: arr }), {
        expirationTtl: DEEP_CHUNKS_TTL,
      }).catch(() => {});
    }
    return arr;
  } catch {
    return [];
  }
}

function injectDeepPreloads(head, deepChunks) {
  if (!deepChunks || deepChunks.length === 0) return head;
  const extra = deepChunks.map((p) => `<link rel="modulepreload" href="${p}" />`).join("");
  // Insert right after the ENTRY marker so they appear together at the top
  return head.replace(/<!--ENTRY:[^>]+-->/, extra);
}

// v8.22.0: One-shot enricher — extracts entry path from the marker the
// synchronous head-builder left behind, fetches/caches the deep chunk list,
// and splices modulepreloads into the head. Falls back to original head on
// any error so HTML response is never blocked.
async function enrichHeadWithDeepPreloads(head, origin, env) {
  if (!head) return head;
  const marker = head.match(/<!--ENTRY:([^>]+)-->/);
  if (!marker) return head;
  try {
    const deep = await getDeepChunkPreloads(marker[1], origin, env);
    return injectDeepPreloads(head, deep);
  } catch {
    return head.replace(/<!--ENTRY:[^>]+-->/, "");
  }
}

/* v8.24.0: Inject deep modulepreload tags into an already-injected HTML's
   <head>. Used by the cold-cache-api code paths which previously skipped
   the enrichment pass, shipping HTML with only 1 modulepreload tag
   instead of 6-10. Mirrors what the streaming path does via
   getPrebuiltHead + enrichHeadWithDeepPreloads, but operates as a post-
   process step so we don't have to touch injectIntoHtml signature. */
async function injectDeepPreloadsIntoColdHtml(html, origin, env) {
  if (!html || typeof html !== "string") return html;
  try {
    // Find the entry chunk in the existing head (same regex as _buildPrebuiltHead).
    const entryMatch = html.match(/<script[^>]+type="module"[^>]+src="(\/assets\/[A-Za-z0-9_\-]+-[A-Za-z0-9]+\.js)"/);
    if (!entryMatch) return html;
    const entryPath = entryMatch[1];
    const deep = await getDeepChunkPreloads(entryPath, origin, env);
    if (!deep || deep.length === 0) return html;
    const tags = deep.map((p) => `<link rel="modulepreload" href="${p}" />`).join("");
    if (html.includes("</head>")) return html.replace("</head>", `${tags}</head>`);
    return html;
  } catch {
    return html;
  }
}

/* ============================================================
   v8.23.0 — LANDING MODULEPRELOAD
   The root domain (shopbanao.in/) ships LandingApp via a tiny
   entry shim. The 142KB framework chunk + 40KB landing-shell are
   dynamic imports — invisible to the browser preloader, so they
   load serially after the entry. We fetch the entry chunk once,
   extract its `/assets/*.js` references, cache in KV for 24h,
   and inject `<link rel="modulepreload">` for each into the
   landing HTML head. Cuts the 4-step JS waterfall down to 1.
   ============================================================ */

let _memLandingChunks = null;
const LANDING_CHUNKS_KV_KEY = "landing-chunks:v1";
const LANDING_CHUNKS_TTL = 86400; // 24h
// On landing we WANT landing-shell. Only exclude dashboard/admin/storefront chunks.
const LANDING_EXCLUDE_PATTERN =
  /(?:charts|dash-vendor|admin-pages|dashboard-pages|dashboard-shell|WhatsApp|auth-pages|storefront-shell|theme-v)/;
// Priority order: framework first (largest, blocks render), then landing-shell, then utils.
const LANDING_PRIORITY = /(?:framework-|landing-shell-|entry-utils-|landing-utils-|icons-)/;

async function getLandingChunkPreloads(entryPath, origin, env) {
  if (_memLandingChunks && _memLandingChunks.entry === entryPath) {
    return _memLandingChunks.chunks;
  }
  if (env?.STORE_KV) {
    try {
      const cached = await env.STORE_KV.get(LANDING_CHUNKS_KV_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.entry === entryPath && Array.isArray(parsed.chunks)) {
          _memLandingChunks = parsed;
          return parsed.chunks;
        }
      }
    } catch {}
  }
  try {
    const res = await fetch(`${origin}${entryPath}`, {
      cf: { cacheTtl: 3600, cacheEverything: true },
    });
    if (!res.ok) return [];
    const code = await res.text();
    const found = new Set();
    for (const m of code.matchAll(/["'`]\/?(assets\/[A-Za-z0-9_\-]+-[A-Za-z0-9]+\.js)["'`]/g)) {
      const p = "/" + m[1];
      if (p === entryPath) continue;
      if (LANDING_EXCLUDE_PATTERN.test(p)) continue;
      found.add(p);
    }
    const arr = [...found]
      .sort((a, b) => {
        const pa = LANDING_PRIORITY.test(a) ? 0 : 1;
        const pb = LANDING_PRIORITY.test(b) ? 0 : 1;
        return pa - pb;
      })
      .slice(0, 6); // landing only needs ~3-4 chunks; cap at 6 for safety
    _memLandingChunks = { entry: entryPath, chunks: arr };
    if (env?.STORE_KV) {
      env.STORE_KV.put(LANDING_CHUNKS_KV_KEY, JSON.stringify(_memLandingChunks), {
        expirationTtl: LANDING_CHUNKS_TTL,
      }).catch(() => {});
    }
    return arr;
  } catch {
    return [];
  }
}

// Inject modulepreload links right after <head> opening tag (or after <meta charset>).
async function injectLandingModulepreloads(html, origin, env) {
  if (!html || typeof html !== "string") return html;
  const entryMatch = html.match(/<script[^>]+type="module"[^>]+src="(\/assets\/[^"]+\.js)"/);
  if (!entryMatch) return html;
  const entryPath = entryMatch[1];
  const chunks = await getLandingChunkPreloads(entryPath, origin, env);
  if (!chunks || chunks.length === 0) return html;
  const preloadTags = chunks.map((p) => `<link rel="modulepreload" href="${p}" />`).join("");
  // Inject right before </head> to ensure they're parsed early.
  if (html.includes("</head>")) {
    return html.replace("</head>", `${preloadTags}</head>`);
  }
  return html;
}

// Detect landing page paths served from root domain.
function isLandingPath(pathname) {
  return pathname === "/" || pathname === "/theme" || pathname === "/guides" || pathname.startsWith("/guides/");
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
// v8.13.1 cost-cut: 300s → 3600s. Cuts ~12k KV writes/wk. After Lovable
// publishes, /api/purge-shell already exists for instant flush; otherwise
// new visitors see fresh shell within 1h. Vite hashed bundles coexist on
// CDN so old shell references don't 404 mid-window.
const SPA_SHELL_KV_TTL = 3600;
const SPA_SHELL_CACHE_TTL = 60; // v8.7.0: short safety net only; human navigations use fresh origin shell.

function setNoStoreHtmlHeaders(headers) {
  // v8.24.0: was `public, max-age=0, must-revalidate, swr=300` which CF
  // refuses to edge-cache (cf-cache-status stuck at MISS forever).
  // Now: 60s fresh + 1d SWR. Merchants see edits within 60s on repeat
  // visits, AND CF's automatic cache starts serving HIT on warm hits —
  // cutting Worker compute to ~0 for the bulk of anonymous traffic.
  // Purge button still wipes instantly via /api/purge-shell.
  headers.set("Cache-Control", "public, max-age=60, stale-while-revalidate=86400");
  headers.delete("Pragma");
  headers.delete("Expires");
}

let inflightShellFetch = null;

/* ============================================================
   v8.1.0 KV WRITE COALESCING — in-isolate dedup
   Suppresses duplicate KV.put() calls for the same key within a TTL window.
   Together with the in-memory caches above, this collapses bursts of
   redundant writes (e.g. theme-lite/storefront re-cached on every request).
   ============================================================ */
// v8.18.0 KV-write cost-cut:
//  - Default dedup TTL bumped 5min → 60min (12x fewer isolate-level repeat writes).
//  - Static keys (store-info, store-id, domain, all-active-slugs, theme-lite,
//    warm-lock, prebuilt-head, spa-shell) get 24h dedup — they almost never
//    change mid-day; cron's read-before-write handles real changes.
//  - Per-request keys (storefront-data, products, pdp, category) keep 60min.
const _kvWriteRecent = new Map(); // key → expiresAt
const KV_WRITE_DEDUP_TTL_DEFAULT = 60 * 60_000; // 60 min
const KV_WRITE_DEDUP_TTL_STATIC = 24 * 60 * 60_000; // 24 h
const KV_WRITE_DEDUP_MAX = 10_000;
const _STATIC_KV_PREFIXES = [
  "store-info:",
  "store-id:",
  "domain:",
  "theme-lite:",
  "warm-lock:",
  "all-active-slugs",
  "prebuilt-head",
  "spa-shell",
];
function _kvDedupTtlFor(key) {
  for (const p of _STATIC_KV_PREFIXES) if (key === p || key.startsWith(p)) return KV_WRITE_DEDUP_TTL_STATIC;
  return KV_WRITE_DEDUP_TTL_DEFAULT;
}
function _shouldWriteKv(key) {
  const now = Date.now();
  const exp = _kvWriteRecent.get(key);
  if (exp && now < exp) return false;
  if (_kvWriteRecent.size > KV_WRITE_DEDUP_MAX) {
    let n = 1000;
    for (const k of _kvWriteRecent.keys()) {
      _kvWriteRecent.delete(k);
      if (--n <= 0) break;
    }
  }
  _kvWriteRecent.set(key, now + _kvDedupTtlFor(key));
  return true;
}
function kvPutDedup(env, key, value, opts) {
  if (!env?.STORE_KV) return Promise.resolve();
  if (!_shouldWriteKv(key)) return Promise.resolve();
  return env.STORE_KV.put(key, value, opts).catch(() => {});
}

/* v8.31.0 KV DELETE DEDUP — suppresses duplicate KV.delete() bursts for the
   same key within a 30s window. Defends against double-firing purges
   (e.g. legacy clients still calling /api/purge-shell + /api/purge-store on
   both subdomain and custom domain). Even if 4 redundant purges land in the
   same isolate, only the first actually hits KV.
   IMPORTANT: clearing _kvWriteRecent on real purges still happens in the
   handlers — this only blocks the *duplicate* delete RPCs, not the legit one. */
const _kvDeleteRecent = new Map(); // key → expiresAt
const KV_DELETE_DEDUP_TTL = 30_000;
const KV_DELETE_DEDUP_MAX = 5_000;
function _shouldDeleteKv(key) {
  const now = Date.now();
  const exp = _kvDeleteRecent.get(key);
  if (exp && now < exp) return false;
  if (_kvDeleteRecent.size > KV_DELETE_DEDUP_MAX) {
    let n = 500;
    for (const k of _kvDeleteRecent.keys()) {
      _kvDeleteRecent.delete(k);
      if (--n <= 0) break;
    }
  }
  _kvDeleteRecent.set(key, now + KV_DELETE_DEDUP_TTL);
  return true;
}
function kvDeleteDedup(env, key) {
  if (!env?.STORE_KV) return Promise.resolve();
  if (!_shouldDeleteKv(key)) return Promise.resolve();
  return env.STORE_KV.delete(key).catch(() => {});
}

function kvDeleteForce(env, key) {
  if (!env?.STORE_KV) return Promise.resolve();
  _kvDeleteRecent.delete(key);
  return env.STORE_KV.delete(key).catch(() => {});
}


// v8.18.0 Fix D: in-memory warm-lock marker. If this isolate already
// established a warm-lock for `slug` within WARM_LOCK_MEM_TTL_MS, skip
// the KV.get + KV.put round trip entirely. Safe because warm-html below
// has its own per-isolate shouldRevalidate() guard.
const _memWarmLock = new Map(); // slug → expiresAt
const WARM_LOCK_MEM_TTL_MS = 5 * 60_000;
function _memWarmLockHas(slug) {
  const exp = _memWarmLock.get(slug);
  if (exp && Date.now() < exp) return true;
  return false;
}
function _memWarmLockSet(slug) {
  if (_memWarmLock.size > 2000) _memWarmLock.clear();
  _memWarmLock.set(slug, Date.now() + WARM_LOCK_MEM_TTL_MS);
}

// v8.19.0 Fix B — "second-hit" gate. First miss for a key writes only to
// Cache API (free). KV write is suppressed until the SAME key is seen again
// within SECOND_HIT_TTL. Eliminates one-hit-wonder writes (long-tail PDPs,
// crawler-only category combos). Cache API edge-locality means the 2nd
// visitor in that 5-min window still hits cache; only a different colo
// would re-fetch from origin (sub-100ms, no user-visible difference).
const _secondHitMap = new Map(); // key → expiresAt
const SECOND_HIT_TTL_MS = 5 * 60_000;
const SECOND_HIT_MAX = 20_000;
function _shouldWriteOnSecondHit(key) {
  const now = Date.now();
  const exp = _secondHitMap.get(key);
  if (exp && now < exp) {
    // Second hit within window → allow write, clear marker so we don't
    // keep rewriting on every subsequent hit (kvPutDedup handles that).
    _secondHitMap.delete(key);
    return true;
  }
  if (_secondHitMap.size > SECOND_HIT_MAX) {
    let n = 2000;
    for (const k of _secondHitMap.keys()) {
      _secondHitMap.delete(k);
      if (--n <= 0) break;
    }
  }
  _secondHitMap.set(key, now + SECOND_HIT_TTL_MS);
  return false;
}
function kvPutLongTail(env, key, value, opts) {
  if (!env?.STORE_KV) return Promise.resolve();
  if (!_shouldWriteOnSecondHit(key)) return Promise.resolve();
  return kvPutDedup(env, key, value, opts);
}

// v8.19.0 Fix C — Default-filter products go straight to KV (storefront home
// page, high re-hit rate). Non-default filters (page>=2, category drill,
// custom sort) are long-tail → gated by second-hit.
function _isDefaultProductFilter(filters) {
  if (!filters) return true;
  if (filters.category) return false;
  if (filters.sort) return false;
  if (filters.page && Number(filters.page) > 1) return false;
  return true;
}
function kvPutProducts(env, key, value, opts, filters) {
  if (_isDefaultProductFilter(filters)) return kvPutDedup(env, key, value, opts);
  return kvPutLongTail(env, key, value, opts);
}

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
  // v8.6.6: Fetch the deployment shell fresh from origin. Do NOT use
  // `cf.cacheEverything` here: Cloudflare's implicit fetch cache is not
  // addressable by our `/api/purge-shell` handler, so it can keep returning
  // old index.html with stale JS chunk names after a Lovable publish. The
  // explicit Worker Cache + KV writes below still cache the fresh shell and
  // are fully purgeable.
  const shellUrl = new URL(request.url);
  shellUrl.hostname = ORIGIN_HOST;
  const shellHeaders = new Headers(request.headers);
  shellHeaders.set("Host", ORIGIN_HOST);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ORIGIN_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(shellUrl.toString(), {
      method: "GET",
      headers: shellHeaders,
      signal: controller.signal,
      cf: { cacheTtl: 0, cacheEverything: false },
    });
    clearTimeout(timeout);
  } catch {
    clearTimeout(timeout);
    return null;
  }

  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !contentType.includes("text/html")) return null;

  const html = await response.text();
  if (!html || html.length < 200) return null;

  _memShell = html;
  _memShellTs = Date.now() + MEM_SHELL_TTL;

  if (ctx) {
    ctx.waitUntil(
      Promise.all([
        // v8.13.1: dedup-wrapped — collapses multi-isolate write bursts in same colo.
        env?.STORE_KV
          ? kvPutDedup(env, SPA_SHELL_KV_KEY, html, { expirationTtl: SPA_SHELL_KV_TTL })
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

async function getFreshSpaShell(request, ctx, env) {
  const shellCacheKey = new Request("https://cache/spa-shell");
  const html = await _fetchSpaShellFromOrigin(request, ctx, env, shellCacheKey);
  return html ? { html, source: "origin-fresh" } : null;
}

async function getNavigationSpaShell(request, ctx, env) {
  const fresh = await getFreshSpaShell(request, ctx, env);
  if (fresh?.html) return fresh;
  return getSpaShell(request, ctx, env);
}

/* ============================================================
   FIX #4 — BATCH KV READ (shell + theme + storefront in ONE call)
   ============================================================ */

// FIX #20 + Phase 2 #6: Storefront data changes rarely — push TTLs higher.
// Auto-purge on store update keeps freshness; SWR serves stale instantly.
const KV_STOREFRONT_TTL = 86_400; // 24h — purge wipes on every save
const CACHE_STOREFRONT_TTL = 3_600; // Tier-1 #1: 2h → 1h. Purge handles freshness.

// v7.6.0 Fix D: Reduced from 3 KV reads to 1. `storefront` is already fetched
// by earlyStorefrontPromise (prefetchStorefrontDataWithDeadline) and `storeInfo`
// is fetched by _resolveStoreInfo in the same Promise.all — fetching them
// again here was a duplicate KV read on every request.
async function _batchKvRead(slug, env) {
  if (!env?.STORE_KV) return { theme: null };
  try {
    const theme = await env.STORE_KV.get(`theme-lite:${slug}`, { type: "json" }).catch(() => null);
    return { theme };
  } catch {
    return { theme: null };
  }
}

/* ============================================================
   FIX #8 — LIGHTWEIGHT THEME CACHE (in-memory → Cache API → KV)
   ============================================================ */

const THEME_LITE_KV_TTL = 86400; // v8.1.0 cost-cut: 6h → 24h
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

  // v8.1.0: skip KV write for bot traffic + dedup repeat writes within 5min window
  if (!ctx?.__skipKvWarm) {
    kvPutDedup(env, `theme-lite:${slug}`, liteStr, { expirationTtl: THEME_LITE_KV_TTL });
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
        // Tier-1 #5: prefer Brotli on RPC payloads. Workers runtime auto-
        // decompresses br/gzip when reading via res.json()/res.text().
        "Accept-Encoding": "br, gzip",
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

        // v8.1.0: bots skip KV writes; dedup collapses bursts within 5min
        const skipKv = !!ctx?.__skipKvWarm;
        ctx.waitUntil(
          Promise.all([
            skipKv ? Promise.resolve() : kvPutDedup(env, kvKey, dataStr, { expirationTtl: KV_STOREFRONT_TTL }),
            cache.put(
              dataCacheKey,
              new Response(dataStr, { headers: { "Cache-Control": `public, max-age=${CACHE_STOREFRONT_TTL}` } }),
            ),
            !skipKv && storeId
              ? _prewarmProducts(storeId, storeSlug, ctx, env, data?.store?.custom_domain)
              : Promise.resolve(),
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
const PRODUCTS_KV_TTL = 86400; // v8.1.0 cost-cut: 2h → 24h (purge bumps version)
// v8.34.0 (2026-05): standardized to 20 across all storefront surfaces
// (Shop, Category, Home, Best Sellers). MUST match PAGE_SIZE in
// src/hooks/useInfiniteProducts.ts — offsets and inline-hydration depend
// on this constant being identical on client + worker.
const PRODUCTS_PAGE_SIZE = 20;
const PRODUCT_COLUMNS =
  "id,category,cost_price,created_at,currency,description,image_url,is_active,is_best_selling,is_category_pinned,category_pinned_at,name,price,sale_price,sku,slug,stock_quantity,store_id,updated_at";

async function _getInlineProductsOrNull(hostname, slug, env, ctx) {
  try {
    const version = await _getProductVersion(hostname, env);
    const productsCacheKey = _buildProductsCacheKey(hostname, {}, version);
    const cached = await cache.match(productsCacheKey);
    if (cached) return await cached.text();

    if (env?.STORE_KV) {
      const kvKey = _buildProductsKvKey(hostname, {}, version);
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
   EDGE-NATIVE PAGE VIEW TRACKING (v6.6.0 — BATCHED)

   In-memory dedup: same (storeId|ip|path) is recorded at most
   once per 30 minutes per Worker instance. Bots are filtered
   out by UA.

   BATCHING: rows are buffered in memory and flushed as a single
   bulk INSERT when EITHER threshold is hit:
     • buffer reaches PV_BATCH_MAX_SIZE rows, OR
     • PV_BATCH_MAX_AGE_MS has elapsed since the first buffered row
   This converts ~N writes/min into ~1 write/min per Worker
   instance — ~80–95% fewer DB round-trips with no loss of data.
   ============================================================ */

const PV_DEDUP_WINDOW_MS = 30 * 60 * 1000;
const PV_DEDUP_MAX = 5000;
const _pvDedup = new Map(); // key -> expiresAt

// Batching config
// v8.43.0 Fix: Worker isolates on low-traffic stores die before the 100-row /
// 60s age threshold ever triggers, so buffered rows are lost in memory and
// page_views stays empty. Flush every record — the 30-min per-(store,visitor,
// path) dedup above already caps write volume to ~1 INSERT per real session
// page, which is well within Supabase limits.
const PV_BATCH_MAX_SIZE = 1; // flush immediately (was 100, lost rows on cold isolates)
const PV_BATCH_MAX_AGE_MS = 60_000; // unused at size=1, kept for future tuning
const _pvBuffer = []; // pending rows
let _pvBufferOldestAt = 0; // timestamp of first row in current buffer

const PV_BOT_UA_REGEX =
  /bot|crawler|spider|crawling|facebookexternalhit|whatsapp|telegram|slack|discord|linkedin|pinterest|googlebot|bingbot|yandexbot|baiduspider|duckduckbot|applebot|semrush|ahrefs|mj12|petalbot|headlesschrome|phantomjs|puppeteer|playwright|lighthouse|gtmetrix|pagespeed/i;

function _pvIsBot(request) {
  const ua = request.headers.get("user-agent") || "";
  if (!ua) return true;
  return PV_BOT_UA_REGEX.test(ua);
}

function _pvPruneIfNeeded() {
  if (_pvDedup.size < PV_DEDUP_MAX) return;
  const now = Date.now();
  for (const [k, exp] of _pvDedup) {
    if (exp <= now) _pvDedup.delete(k);
    if (_pvDedup.size < PV_DEDUP_MAX * 0.8) break;
  }
}

/** Flush the current buffer as a single bulk INSERT. Returns the fetch promise (or null). */
function _pvFlushBuffer() {
  if (_pvBuffer.length === 0) return null;
  const rows = _pvBuffer.splice(0, _pvBuffer.length); // atomic drain
  _pvBufferOldestAt = 0;

  return fetch(`${SUPABASE_URL}/rest/v1/page_views`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(rows), // PostgREST accepts array → bulk insert
  }).catch(() => {});
}

function _pvReadVisitorId(request) {
  const cookie = request.headers.get("cookie") || "";
  const m = cookie.match(/(?:^|;\s*)sb_vid=([a-f0-9-]{8,64})/i);
  return m ? m[1] : null;
}

// v8.42.0: dual-write re-enabled. Dashboard analytics (Sessions, Conversion)
// read from Supabase page_views; AE-only mode left the table empty so those
// metrics flat-lined. With the 30-min per-(store,visitor,path) dedup + 100-row
// bulk batching above, write volume stays bounded (~one INSERT per minute per
// isolate). AE writes continue in parallel for long-term retention.
const PV_WRITE_SUPABASE = true;

/**
 * v8.30.0 — write a pageview to Cloudflare Analytics Engine.
 * Synchronous in-isolate API (no fetch), zero latency. Silently no-op if the
 * `AE_PAGEVIEWS` binding hasn't been added yet — safe to deploy before the
 * binding exists.
 *
 *   indexes: [store_id]   (partition key)
 *   blobs:   [path, visitor_id, country, device, referrer, host]
 *   doubles: [1]          (unit count; AE sums via sum(_sample_interval))
 */
function writePageViewAE(env, request, storeId, pathname) {
  try {
    const ds = env && env.AE_PAGEVIEWS;
    if (!ds || typeof ds.writeDataPoint !== "function") return;
    const cf = request.cf || {};
    const ua = request.headers.get("user-agent") || "";
    const device = /mobile|android|iphone|ipad/i.test(ua) ? "mobile" : /tablet/i.test(ua) ? "tablet" : "desktop";
    const referrer = (request.headers.get("referer") || "").slice(0, 200);
    const host = new URL(request.url).hostname;
    const visitorId = _pvReadVisitorId(request) || "";
    ds.writeDataPoint({
      indexes: [String(storeId)],
      blobs: [pathname.slice(0, 200), visitorId, String(cf.country || ""), device, referrer, host],
      doubles: [1],
    });
  } catch (_) {
    /* never throw from analytics path */
  }
}

function recordPageView(env, request, storeId, pathname) {
  if (!storeId) return;
  if (_pvIsBot(request)) return;
  // Only track real page navigations — skip API/asset paths
  // v8.28.0: added /~api/ (analytics beacon endpoint), /cf-img, /_*,
  // robots/sitemap/favicon. Without this, /~api/analytics was being
  // recorded as a page_view (~45% of all rows on busy storefronts).
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/~api/") ||
    pathname.startsWith("/cf-img") ||
    pathname.startsWith("/_") ||
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/rest/") ||
    pathname.startsWith("/functions/") ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/favicon.ico" ||
    /\.(js|css|png|jpe?g|webp|svg|ico|woff2?|map|json|xml|txt|avif|gif|ttf|otf)(\?|$)/i.test(pathname)
  ) {
    return;
  }

  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "0";
  const visitorId = _pvReadVisitorId(request);
  // Dedup key prefers visitor_id (cookie-stable across IP changes); falls back
  // to IP for first-time visitors who haven't received the cookie yet.
  const dedupId = visitorId || ip;
  const key = `${storeId}|${dedupId}|${pathname}`;
  const now = Date.now();
  const existing = _pvDedup.get(key);
  if (existing && existing > now) return; // dedup hit
  _pvDedup.set(key, now + PV_DEDUP_WINDOW_MS);
  _pvPruneIfNeeded();

  // v8.45.0: AE writes removed — Supabase page_views is the single source of
  // truth. Browser beacon (usePageviewBeacon) is the primary writer; the
  // Worker writes here too on cold/MISS requests as a safety net.


  // Stage A: also write to Supabase for count verification. Flip
  // PV_WRITE_SUPABASE=false (Stage B) once AE counts are confirmed.
  if (!PV_WRITE_SUPABASE) return null;

  // Append to in-memory buffer
  _pvBuffer.push({
    store_id: storeId,
    path: pathname,
    visitor_ip: ip.slice(0, 64),
    visitor_id: visitorId,
  });
  if (_pvBufferOldestAt === 0) _pvBufferOldestAt = now;

  // Flush triggers: size threshold OR age threshold
  const sizeReached = _pvBuffer.length >= PV_BATCH_MAX_SIZE;
  const ageReached = now - _pvBufferOldestAt >= PV_BATCH_MAX_AGE_MS;
  if (sizeReached || ageReached) {
    return _pvFlushBuffer();
  }
  return null;
}

/** Force-flush any pending rows. Call from cron / scheduled handler. */
function flushPageViewBuffer() {
  return _pvFlushBuffer();
}

/* ============================================================
   v6.4.0 — PRELOAD-SCANNER IMAGE FAST-PATH HELPERS
   ============================================================ */

/** Parse the inline products JSON string and return the first N image URLs. */
function _extractTopProductImages(inlineProductsStr, n) {
  if (!inlineProductsStr) return [];
  try {
    const arr = JSON.parse(inlineProductsStr);
    if (!Array.isArray(arr)) return [];
    const out = [];
    for (let i = 0; i < arr.length && out.length < n; i++) {
      const p = arr[i];
      const url = (p && (p.image_url || (Array.isArray(p.product_images) && p.product_images[0]?.image_url))) || "";
      if (url && typeof url === "string" && url.startsWith("http")) {
        out.push({ url, name: p.name || "" });
      }
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Build `<link rel="preload" as="image">` tags for the first N product images.
 * The preload scanner sees these BEFORE any JS executes — downloads start
 * within ~50ms of HTML arrival instead of ~2500ms after React renders.
 */
/**
 * v8.8.0 (Phase 1 fixes #1, #2, #3):
 *  #1 Rewrite Supabase Storage URLs to the render/image API at width=400&q=72
 *     so the preload URL matches what React eventually paints. No more wasted
 *     800w preload + second render-API fetch.
 *  #2 Cap to first 2 products only (above-fold on mobile). Extra preloads
 *     starve the LCP image of HTTP/2 priority.
 *  #3 Add imagesrcset + imagesizes so the browser picks the right size.
 */
function _toRenderUrl(rawUrl, width, quality) {
  // v8.5 — emit Supabase Render API URLs directly (NOT /cf-img). The Worker
  // proxy was generating one paid event per image; Supabase's render API is
  // free and CDN-cached. Saves ~5-30 Worker events per pageview.
  try {
    const u = new URL(rawUrl);
    if (u.hostname.endsWith(".supabase.co") && u.pathname.includes("/storage/v1/object/")) {
      u.pathname = u.pathname.replace("/storage/v1/object/", "/storage/v1/render/image/");
      u.searchParams.set("width", String(width));
      u.searchParams.set("quality", String(quality));
      u.searchParams.set("resize", "contain");
      return u.toString();
    }
    return rawUrl;
  } catch {
    return rawUrl;
  }
}
function _buildProductImagePreloads(inlineProductsStr, count = 2) {
  const items = _extractTopProductImages(inlineProductsStr, count);
  if (!items.length) return "";
  let out = "";
  for (let i = 0; i < items.length; i++) {
    const raw = items[i].url;
    const main = _toRenderUrl(raw, 400, 72);
    const srcset =
      `${escapeHtml(_toRenderUrl(raw, 200, 72))} 200w, ` +
      `${escapeHtml(_toRenderUrl(raw, 400, 72))} 400w, ` +
      `${escapeHtml(_toRenderUrl(raw, 800, 72))} 800w`;
    const fp = i === 0 ? ` fetchpriority="high"` : "";
    out +=
      `<link rel="preload" as="image" href="${escapeHtml(main)}" ` +
      `imagesrcset="${srcset}" imagesizes="(max-width:640px) 45vw, 25vw"${fp} />\n`;
  }
  return out;
}

/**
 * Build a hidden "preloader grid" of <img> tags for the first N products.
 * The browser parses these and queues the image downloads in parallel with
 * the React bundle download. Images land in the HTTP cache so when React
 * eventually renders the real product cards, the <img> requests are
 * served instantly from cache — no second network round trip.
 *
 * The grid is visually invisible but technically present so the
 * preload-scanner picks up every <img src>.
 */
function _buildProductPreloaderGrid(inlineProductsStr, count = 8) {
  const items = _extractTopProductImages(inlineProductsStr, count);
  if (!items.length) return "";
  let imgs = "";
  for (let i = 0; i < items.length; i++) {
    const u = escapeHtml(items[i].url);
    const eager = i < 4 ? ' loading="eager"' : ' loading="lazy"';
    const fp = i < 2 ? ' fetchpriority="high"' : "";
    imgs += `<img src="${u}" alt=""${eager}${fp} decoding="async" width="1" height="1" />`;
  }
  return `<div aria-hidden="true" style="position:absolute;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;clip:rect(0 0 0 0)">${imgs}</div>`;
}

/* ============================================================
   DOMAIN RESOLUTION (in-memory → Cache API → KV → DB)
   ============================================================ */

const KV_DOMAIN_TTL = 86400; // v8.0.0 cost-cut: 1h → 24h

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
        // v6.8.0: 5min → 1hr. Domain↔slug mapping changes only on custom-domain
        // connect/disconnect; purge endpoints already invalidate explicitly.
        cache
          .put(key, new Response(JSON.stringify(kvData), { headers: { "Cache-Control": "public, max-age=3600" } }))
          .catch(() => {});
        return kvData.slug || null;
      }
    } catch {}
  }

  try {
    // v8.6.0: cf.cacheEverything mirrors Cache API TTL → CF dashboard counts hits.
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/stores_public?select=slug&custom_domain=eq.${encodeURIComponent(domain)}&limit=1`,
      {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        cf: { cacheEverything: true, cacheTtl: 300, cacheTtlByStatus: { "200-299": 300, 404: 60, "500-599": 0 } },
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const slug = data[0]?.slug || null;

    // v6.8.0: 5min hit / 1min miss → 1hr hit / 2min miss
    const ttl = slug ? 3600 : 120;
    const cacheData = JSON.stringify({ slug });
    const writes = [
      cache.put(key, new Response(cacheData, { headers: { "Cache-Control": `public, max-age=${ttl}` } })),
    ];
    if (slug) {
      writes.push(kvPutDedup(env, `domain:${domain}`, cacheData, { expirationTtl: KV_DOMAIN_TTL })); // v8.1.0 dedup
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
    // v8.6.0: cf.cacheEverything for CF dashboard cache-rate visibility.
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/stores_public?select=custom_domain&slug=eq.${encodeURIComponent(slug)}&limit=1`,
      {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        cf: { cacheEverything: true, cacheTtl: 300, cacheTtlByStatus: { "200-299": 300, 404: 60, "500-599": 0 } },
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const customDomain = data[0]?.custom_domain || null;
    await cache
      .put(
        key,
        new Response(JSON.stringify({ custom_domain: customDomain }), {
          headers: { "Cache-Control": "public, max-age=3600" },
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
const STORE_INFO_KV_TTL = 86400; // v8.0.0 cost-cut: 1h → 24h (cron read-before-write skips unchanged)

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
            headers: { "Cache-Control": "public, max-age=3600" },
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
            new Response(JSON.stringify(kvData), { headers: { "Cache-Control": "public, max-age=3600" } }),
          )
          .catch(() => {});
        cache
          .put(
            new Request(`https://cache/slug-domain-${slug}`),
            new Response(JSON.stringify({ custom_domain: result.customDomain }), {
              headers: { "Cache-Control": "public, max-age=3600" },
            }),
          )
          .catch(() => {});
        return result;
      }
    } catch {}
  }

  try {
    // v8.6.0: cf.cacheEverything for CF dashboard cache-rate visibility.
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/stores_public?select=id,custom_domain&slug=eq.${encodeURIComponent(slug)}&limit=1`,
      {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        cf: { cacheEverything: true, cacheTtl: 300, cacheTtlByStatus: { "200-299": 300, 404: 60, "500-599": 0 } },
      },
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
      kvPutDedup(env, `store-info:${slug}`, JSON.stringify(nfData), { expirationTtl: 1800 }); // v8.1.0 dedup

      return { storeId: null, customDomain: null };
    }

    const result = { storeId: row.id, customDomain: row.custom_domain || null };
    const cachePayload = { id: result.storeId, cd: result.customDomain };
    _capMapSize(_storeInfoCache, STORE_INFO_CACHE_MAX);
    // v6.8.0: 5min → 30min in-memory. Reduces store-info lookups by ~6x per isolate.
    _storeInfoCache.set(slug, { ...result, expiresAt: Date.now() + 1_800_000 });
    _capMapSize(domainStoreIdCache, DOMAIN_STORE_ID_CACHE_MAX);
    // v6.8.0: 5min → 30min in-memory. Store info changes only on rename/domain-update.
    domainStoreIdCache.set(hostname, { storeId: result.storeId, expiresAt: Date.now() + 1_800_000 });

    await Promise.all([
      cache
        .put(
          infoCacheKey,
          // v6.8.0: 5min → 1hr. Purge invalidates on store updates.
          new Response(JSON.stringify(cachePayload), { headers: { "Cache-Control": "public, max-age=3600" } }),
        )
        .catch(() => {}),
      cache
        .put(
          new Request(`https://cache/slug-domain-${slug}`),
          new Response(JSON.stringify({ custom_domain: result.customDomain }), {
            headers: { "Cache-Control": "public, max-age=3600" },
          }),
        )
        .catch(() => {}),
      cache
        .put(
          new Request(`https://cache/store-id:${hostname}`),
          new Response(result.storeId, { headers: { "Cache-Control": "public, max-age=600" } }),
        )
        .catch(() => {}),
      kvPutDedup(env, `store-info:${slug}`, JSON.stringify(cachePayload), { expirationTtl: STORE_INFO_KV_TTL }),
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
    kvPutDedup(env, `store-id:${domain}`, storeId, { expirationTtl: 86400 }); // v8.1.0 dedup
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
  // v8.6.0: cf.cacheEverything for CF dashboard cache-rate visibility.
  const res = await fetch(`${SUPABASE_URL}/rest/v1/stores_public?select=id&${query}&limit=1`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    cf: { cacheEverything: true, cacheTtl: 300, cacheTtlByStatus: { "200-299": 300, 404: 60, "500-599": 0 } },
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

async function proxyToOriginCached(request, ctx) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return proxyToOrigin(request);
  }

  const cached = await cache.match(request).catch(() => null);
  if (cached) {
    const hit = new Response(request.method === "HEAD" ? null : cached.body, cached);
    hit.headers.set("X-Static-Asset-Cache", "HIT");
    return hit;
  }

  const url = new URL(request.url);
  url.hostname = ORIGIN_HOST;
  const headers = new Headers(request.headers);
  headers.set("Host", ORIGIN_HOST);
  // Static assets are content-hashed and public. Forwarding cookies makes the
  // origin emit Set-Cookie, which Cloudflare correctly marks as BYPASS and is
  // why the Worker dashboard showed 0% cache rate for asset subrequests.
  headers.delete("Cookie");
  headers.delete("Authorization");

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
    const newRes = new Response(request.method === "HEAD" ? null : res.body, res);
    if (newRes.ok) {
      newRes.headers.set("Cache-Control", "public, max-age=2592000, immutable");
      newRes.headers.delete("Set-Cookie");
      newRes.headers.delete("set-cookie");
      newRes.headers.set("X-Static-Asset-Cache", "MISS");
      ctx?.waitUntil?.(cache.put(request, newRes.clone()).catch(() => {}));
    }
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

/**
 * v8.14.0 — Strip the platform's default SEO tags from <head> so the per-store
 * tags we inject afterwards are the FIRST (and only) ones Googlebot sees.
 * Without this, the original ShopBanao landing meta from index.html wins
 * (canonical → shopbanao.in, title → "ShopBanao — Create…"), and every store
 * is invisible in search.
 */
function _stripPlatformSeoHead(html) {
  const headEnd = html.indexOf("</head>");
  if (headEnd === -1) return html;
  let head = html.slice(0, headEnd);
  const body = html.slice(headEnd);

  // Remove tags that we will replace per-store.
  head = head
    .replace(/<title[^>]*>[\s\S]*?<\/title>/gi, "")
    .replace(/<link[^>]+rel=["']canonical["'][^>]*>\s*/gi, "")
    .replace(/<link[^>]+rel=["'](?:icon|shortcut icon|apple-touch-icon)["'][^>]*>\s*/gi, "")
    .replace(/<meta[^>]+name=["'](?:description|keywords|author)["'][^>]*>\s*/gi, "")
    .replace(/<meta[^>]+property=["']og:[^"']+["'][^>]*>\s*/gi, "")
    .replace(/<meta[^>]+name=["']twitter:[^"']+["'][^>]*>\s*/gi, "")
    .replace(/<meta[^>]+name=["']theme-color["'][^>]*>\s*/gi, "");

  return head + body;
}

/**
 * v8.14.0 — Build JSON-LD structured data for storefront homepage.
 * Emits Organization + WebSite (with SearchAction). PDP/category schemas are
 * emitted in the streaming path where per-route data is available.
 */
function _buildHomepageJsonLd(store, canonicalBase, categories, products) {
  if (!store) return "";
  const sameAs = [];
  if (store.instagram_url) sameAs.push(store.instagram_url);
  if (store.facebook_url) sameAs.push(store.facebook_url);

  const aboutText = store.seo_about_paragraph || store.description || "";

  // 1. Organization / Store
  const org = {
    "@context": "https://schema.org",
    "@type": "Store",
    name: store.name,
    url: canonicalBase + "/",
  };
  if (aboutText) org.description = aboutText;
  if (store.logo_url) org.logo = store.logo_url;
  if (store.banner_url) org.image = store.banner_url;
  if (store.whatsapp_number) org.telephone = store.whatsapp_number;
  if (sameAs.length) org.sameAs = sameAs;
  if (store.location || store.city || store.state) {
    org.address = {
      "@type": "PostalAddress",
      ...(store.location ? { streetAddress: store.location } : {}),
      ...(store.city ? { addressLocality: store.city } : {}),
      ...(store.state ? { addressRegion: store.state } : {}),
      addressCountry: "IN",
    };
  }
  org.currenciesAccepted = store.currency || "INR";
  org.paymentAccepted = "Cash, UPI, Credit Card, Debit Card";

  // 2. WebSite with SearchAction
  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: store.name,
    url: canonicalBase + "/",
    potentialAction: {
      "@type": "SearchAction",
      target: `${canonicalBase}/shop?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  // 3. LocalBusiness — emitted when we have an address
  const schemas = [org, website];
  if (store.location || store.city || store.state) {
    const localBiz = {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      name: store.name,
      url: canonicalBase + "/",
      ...(aboutText ? { description: aboutText } : {}),
      ...(store.logo_url ? { image: store.logo_url } : {}),
      ...(store.whatsapp_number ? { telephone: store.whatsapp_number } : {}),
      address: org.address,
      priceRange: "₹₹",
    };
    // Map business_hours (jsonb { mon: "9-18", ... }) to openingHoursSpecification
    const bh = store.business_hours || null;
    if (bh && typeof bh === "object") {
      const dayMap = {
        mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday",
        fri: "Friday", sat: "Saturday", sun: "Sunday",
      };
      const specs = [];
      for (const [k, label] of Object.entries(dayMap)) {
        const v = bh[k];
        if (!v || typeof v !== "string") continue;
        const m = v.match(/(\d{1,2})[:.]?(\d{2})?\s*[-–to]+\s*(\d{1,2})[:.]?(\d{2})?/i);
        if (m) {
          const fmt = (h, mm) => `${String(h).padStart(2, "0")}:${(mm || "00").padStart(2, "0")}`;
          specs.push({
            "@type": "OpeningHoursSpecification",
            dayOfWeek: label,
            opens: fmt(m[1], m[2]),
            closes: fmt(m[3], m[4]),
          });
        }
      }
      if (specs.length) localBiz.openingHoursSpecification = specs;
    }
    schemas.push(localBiz);
  }

  // 4. ItemList of featured products
  if (Array.isArray(products) && products.length) {
    const items = products.slice(0, 20).map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${canonicalBase}/product/${encodeURIComponent(p.slug || p.id || "")}`,
      name: p.name || "",
      ...(p.image_url ? { image: p.image_url } : {}),
    }));
    schemas.push({
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: `Featured products — ${store.name}`,
      itemListElement: items,
    });
  }

  // 5. FAQPage (only when merchant filled FAQs)
  const faq = Array.isArray(store.faq_items) ? store.faq_items.filter((f) => f && f.q && f.a) : [];
  if (faq.length) {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.slice(0, 25).map((f) => ({
        "@type": "Question",
        name: String(f.q),
        acceptedAnswer: { "@type": "Answer", text: String(f.a) },
      })),
    });
  }

  const safe = (o) => JSON.stringify(o).replace(/<\/script/gi, "<\\/script");
  return schemas.map((s) => `<script type="application/ld+json">${safe(s)}</script>`).join("");
}

/**
 * v8.45.0 — Hidden but crawlable SEO content block injected into the body
 * skeleton. AI crawlers + Googlebot see the full storefront content even if
 * React fails to hydrate. Visually hidden via clip-path (Google-safe — same
 * content React renders, not cloaking).
 */
function _buildSeoBodyBlock(store, categories, products) {
  if (!store) return "";
  const name = escapeHtml(store.name || "");
  const about = escapeHtml(store.seo_about_paragraph || store.description || store.meta_description || "");
  const cats = Array.isArray(categories) ? categories : [];
  const prods = Array.isArray(products) ? products : [];
  const usp = Array.isArray(store.usp_bullets) ? store.usp_bullets.filter(Boolean) : [];
  const faq = Array.isArray(store.faq_items) ? store.faq_items.filter((f) => f && f.q && f.a) : [];

  const loc = [store.city, store.state].filter(Boolean).map(escapeHtml).join(", ");
  const wa = store.whatsapp_number ? escapeHtml(String(store.whatsapp_number)) : "";

  let html = `<div id="seo-content" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:normal" aria-hidden="false">`;
  html += `<h1>${name}</h1>`;
  if (about) html += `<p>${about}</p>`;
  if (loc || wa) {
    const bits = [];
    if (loc) bits.push(`Location: ${loc}`);
    if (wa) bits.push(`WhatsApp: ${wa}`);
    html += `<p>${bits.join(" · ")}</p>`;
  }

  if (cats.length) {
    html += `<h2>Shop by Category</h2><ul>`;
    for (const c of cats.slice(0, 30)) {
      const cn = escapeHtml(c.name || "");
      const cs = escapeHtml(c.slug || "");
      if (cn && cs) html += `<li><a href="/category/${cs}">${cn}</a></li>`;
    }
    html += `</ul>`;
  }

  if (prods.length) {
    html += `<h2>Featured Products</h2><ul>`;
    for (const p of prods.slice(0, 20)) {
      const pn = escapeHtml(p.name || "");
      const ps = escapeHtml(p.slug || p.id || "");
      const pr = p.sale_price || p.price;
      const priceBit = pr ? ` — ${escapeHtml(store.currency || "INR")} ${Number(pr).toFixed(2)}` : "";
      if (pn && ps) html += `<li><a href="/product/${ps}">${pn}${priceBit}</a></li>`;
    }
    html += `</ul>`;
  }

  if (usp.length) {
    html += `<h2>Why Choose Us</h2><ul>`;
    for (const u of usp.slice(0, 8)) html += `<li>${escapeHtml(String(u))}</li>`;
    html += `</ul>`;
  }

  if (faq.length) {
    html += `<h2>Frequently Asked Questions</h2><dl>`;
    for (const f of faq.slice(0, 15)) {
      html += `<dt>${escapeHtml(String(f.q))}</dt><dd>${escapeHtml(String(f.a))}</dd>`;
    }
    html += `</dl>`;
  }

  if (wa || loc || store.business_hours) {
    html += `<h2>Contact</h2><address>`;
    if (wa) html += `WhatsApp: <a href="https://wa.me/${wa.replace(/[^0-9]/g, "")}">${wa}</a><br>`;
    if (loc) html += `${loc}<br>`;
    const bh = store.business_hours;
    if (bh && typeof bh === "object") {
      const days = ["mon","tue","wed","thu","fri","sat","sun"];
      const labels = { mon:"Mon", tue:"Tue", wed:"Wed", thu:"Thu", fri:"Fri", sat:"Sat", sun:"Sun" };
      const lines = days.map((d) => bh[d] ? `${labels[d]}: ${escapeHtml(String(bh[d]))}` : null).filter(Boolean);
      if (lines.length) html += `Hours: ${lines.join(" · ")}`;
    }
    html += `</address>`;
  }

  html += `</div>`;
  return html;
}

/**
 * v8.15.0 — Build per-route (PDP / category) SEO head HTML used by the
 * streaming path. Returns full <title>, meta description, canonical, OG +
 * Twitter tags and JSON-LD (Product+Offer+BreadcrumbList for PDP,
 * CollectionPage+BreadcrumbList for category). Empty string for unknown.
 */
function _buildPdpCategorySeoHead(store, slug, hostname, pathname, pdpCategoryInline) {
  if (!store || !pdpCategoryInline?.json || !pdpCategoryInline?.kind) return "";
  let parsed;
  try {
    parsed = JSON.parse(pdpCategoryInline.json);
  } catch {
    return "";
  }

  const canonicalBase = store.custom_domain ? `https://${store.custom_domain}` : `https://${slug}.${ROOT_DOMAIN}`;
  const url = `${canonicalBase}${pathname || "/"}`;
  const safe = (o) => JSON.stringify(o).replace(/<\/script/gi, "<\\/script");

  if (pdpCategoryInline.kind === "product") {
    const p = parsed?.product;
    if (!p) return "";
    const images = Array.isArray(parsed?.images) ? parsed.images.map((i) => i?.image_url).filter(Boolean) : [];
    const heroImg =
      p.og_image_url || p.image_url || images[0] || store.og_image_url || store.banner_url || store.logo_url || "";
    const title = escapeHtml(p.meta_title || `${p.name} — ${store.name}`);
    const desc = escapeHtml(
      p.meta_description ||
        (p.description
          ? String(p.description).slice(0, 160)
          : `Buy ${p.name} from ${store.name}. Cash on delivery, fast shipping across India.`),
    );
    const ogImg = typeof heroImg === "string" && /^https?:\/\//i.test(heroImg) ? escapeHtml(heroImg) : "";
    const price = Number(p.sale_price || p.price || 0);
    const inStock = Number(p.stock_quantity || 0) > 0;
    const productLd = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: p.name,
      description: p.description || desc,
      image: images.length ? images : heroImg ? [heroImg] : undefined,
      sku: p.sku || undefined,
      brand: { "@type": "Brand", name: store.name },
      offers: {
        "@type": "Offer",
        url,
        priceCurrency: p.currency || store.currency || "INR",
        price: price.toFixed(2),
        availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        seller: { "@type": "Organization", name: store.name },
      },
    };
    const breadcrumbLd = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${canonicalBase}/` },
        ...(p.category
          ? [
              {
                "@type": "ListItem",
                position: 2,
                name: p.category,
                item: `${canonicalBase}/category/${encodeURIComponent(String(p.category).toLowerCase().replace(/\s+/g, "-"))}`,
              },
            ]
          : []),
        { "@type": "ListItem", position: p.category ? 3 : 2, name: p.name, item: url },
      ],
    };
    let html = "";
    html += `<title>${title}</title>`;
    html += `<meta name="description" content="${desc}">`;
    html += `<link rel="canonical" href="${escapeHtml(url)}">`;
    // v8.46.0: rich-result hints + AI engines
    html += `<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">`;
    html += `<meta property="og:type" content="product">`;
    html += `<meta property="og:title" content="${title}">`;
    html += `<meta property="og:description" content="${desc}">`;
    html += `<meta property="og:url" content="${escapeHtml(url)}">`;
    html += `<meta property="og:site_name" content="${escapeHtml(store.name)}">`;
    if (ogImg) {
      html += `<meta property="og:image" content="${ogImg}">`;
      html += `<meta name="twitter:image" content="${ogImg}">`;
    }
    // v8.46.0: product-specific OG tags — WhatsApp/Telegram/FB show price + stock
    if (price > 0) {
      html += `<meta property="product:price:amount" content="${price.toFixed(2)}">`;
      html += `<meta property="product:price:currency" content="${escapeHtml(p.currency || store.currency || "INR")}">`;
      html += `<meta property="og:price:amount" content="${price.toFixed(2)}">`;
      html += `<meta property="og:price:currency" content="${escapeHtml(p.currency || store.currency || "INR")}">`;
    }
    html += `<meta property="product:availability" content="${inStock ? "in stock" : "out of stock"}">`;
    html += `<meta property="product:condition" content="new">`;
    if (p.sku) html += `<meta property="product:retailer_item_id" content="${escapeHtml(p.sku)}">`;
    html += `<meta name="twitter:card" content="summary_large_image">`;
    html += `<meta name="twitter:title" content="${title}">`;
    html += `<meta name="twitter:description" content="${desc}">`;
    if (price > 0) {
      html += `<meta name="twitter:label1" content="Price">`;
      html += `<meta name="twitter:data1" content="${(p.currency || store.currency || "INR") === "INR" ? "₹" : ""}${price.toFixed(0)}">`;
      html += `<meta name="twitter:label2" content="Availability">`;
      html += `<meta name="twitter:data2" content="${inStock ? "In stock" : "Out of stock"}">`;
    }
    html += `<script type="application/ld+json">${safe(productLd)}</script>`;
    html += `<script type="application/ld+json">${safe(breadcrumbLd)}</script>`;
    return html;
  }

  if (pdpCategoryInline.kind === "category") {
    const c = parsed?.category;
    if (!c) return "";
    const products = Array.isArray(parsed?.products) ? parsed.products : [];
    const heroImg = c.og_image_url || c.image_url || store.banner_url || store.logo_url || "";
    const title = escapeHtml(c.meta_title || `${c.name} — ${store.name}${store.city ? ` | ${store.city}` : ""}`);
    const desc = escapeHtml(
      c.meta_description ||
        `Shop ${c.name.toLowerCase()} from ${store.name}. ${products.length} products available with fast shipping across India.`,
    );
    const ogImg = typeof heroImg === "string" && /^https?:\/\//i.test(heroImg) ? escapeHtml(heroImg) : "";
    const collectionLd = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: c.name,
      url,
      description: desc,
      isPartOf: { "@type": "WebSite", name: store.name, url: `${canonicalBase}/` },
      ...(products.length
        ? {
            mainEntity: {
              "@type": "ItemList",
              numberOfItems: products.length,
              itemListElement: products.slice(0, 20).map((pp, i) => ({
                "@type": "ListItem",
                position: i + 1,
                url: `${canonicalBase}/product/${encodeURIComponent(pp.slug || "")}`,
                name: pp.name,
              })),
            },
          }
        : {}),
    };
    const breadcrumbLd = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${canonicalBase}/` },
        { "@type": "ListItem", position: 2, name: c.name, item: url },
      ],
    };
    let html = "";
    html += `<title>${title}</title>`;
    html += `<meta name="description" content="${desc}">`;
    html += `<link rel="canonical" href="${escapeHtml(url)}">`;
    html += `<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">`;
    html += `<meta property="og:type" content="website">`;
    html += `<meta property="og:title" content="${title}">`;
    html += `<meta property="og:description" content="${desc}">`;
    html += `<meta property="og:url" content="${escapeHtml(url)}">`;
    html += `<meta property="og:site_name" content="${escapeHtml(store.name)}">`;
    if (ogImg) {
      html += `<meta property="og:image" content="${ogImg}">`;
      html += `<meta name="twitter:image" content="${ogImg}">`;
    }
    html += `<meta name="twitter:card" content="summary_large_image">`;
    html += `<meta name="twitter:title" content="${title}">`;
    html += `<meta name="twitter:description" content="${desc}">`;
    html += `<script type="application/ld+json">${safe(collectionLd)}</script>`;
    html += `<script type="application/ld+json">${safe(breadcrumbLd)}</script>`;
    return html;
  }
  return "";
}

/**
 * v8.47.0 — Shared homepage SEO head builder.
 * Returns the full `<title> + meta + canonical + og/twitter + icon` block
 * used by BOTH injectIntoHtml (cache mirror) and serveStreamedHtml (live).
 * This guarantees every crawler (Google, Bing, AnswerLens, AI engines)
 * sees a fully-formed head on every storefront, every request — no JS
 * required.
 */
function _buildHomepageSeoHead(s, cats, canonicalBase, logoUrl) {
  if (!s) return "";
  const primaryCat = cats && cats[0]?.name || "";
  const cityBit = s.city ? ` | ${s.city}` : "";
  const autoTitle = primaryCat
    ? `${s.name} — ${primaryCat} Online${cityBit}`
    : `${s.name} — Shop Online${cityBit}`;
  const autoDesc = primaryCat
    ? `Shop ${primaryCat.toLowerCase()} from ${s.name}. Cash on delivery, fast shipping across India.`
    : `Shop the best products at ${s.name}. Fast delivery & easy returns across India.`;

  const ogTitle = escapeHtml(s.meta_title || autoTitle);
  const ogDesc = escapeHtml(s.meta_description || s.description || autoDesc);
  const rawOgImage = s.og_image_url || s.banner_url || s.mobile_hero_url || s.logo_url || "";
  const isAbs = typeof rawOgImage === "string" && /^https?:\/\//i.test(rawOgImage);
  const ogImage = isAbs ? escapeHtml(rawOgImage) : "";
  const isExplicitOg = isAbs && rawOgImage === s.og_image_url;
  const twitterCard = isExplicitOg || (isAbs && rawOgImage === s.banner_url) ? "summary_large_image" : "summary";

  let out = "";
  out += `<link rel="canonical" href="${escapeHtml(canonicalBase)}/" />`;
  out += `<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">`;
  out += `<title>${ogTitle}</title>`;
  out += `<meta name="description" content="${ogDesc}">`;
  if (Array.isArray(cats) && cats.length) {
    const kw = cats.slice(0, 8).map((c) => escapeHtml(c.name || "")).filter(Boolean).join(", ");
    const kwExtra = [s.name, s.city].filter(Boolean).map(escapeHtml).join(", ");
    out += `<meta name="keywords" content="${[kw, kwExtra].filter(Boolean).join(", ")}">`;
  }
  out += `<meta property="og:type" content="website">`;
  out += `<meta property="og:title" content="${ogTitle}">`;
  out += `<meta property="og:description" content="${ogDesc}">`;
  out += `<meta property="og:url" content="${escapeHtml(canonicalBase)}/">`;
  out += `<meta property="og:site_name" content="${escapeHtml(s.name)}">`;
  out += `<meta property="og:locale" content="en_IN">`;
  out += `<meta name="twitter:card" content="${twitterCard}">`;
  out += `<meta name="twitter:title" content="${ogTitle}">`;
  out += `<meta name="twitter:description" content="${ogDesc}">`;
  if (ogImage) {
    out += `<meta property="og:image" content="${ogImage}">`;
    if (isExplicitOg) {
      out += `<meta property="og:image:width" content="1200">`;
      out += `<meta property="og:image:height" content="630">`;
    }
    out += `<meta name="twitter:image" content="${ogImage}">`;
  }
  if (logoUrl && /^https?:\/\//i.test(logoUrl)) {
    out += `<link rel="icon" type="image/png" href="${escapeHtml(logoUrl)}">`;
    out += `<link rel="apple-touch-icon" href="${escapeHtml(logoUrl)}">`;
  }
  return out;
}

function injectIntoHtml(html, slug, storefrontData, dataSource, inlineProducts) {
  // v8.15.0: ensure <html lang="en"> for SEO + accessibility.
  html = html.replace(/<html(?![^>]*\blang=)/i, '<html lang="en"');
  // v8.14.0: strip platform default SEO tags BEFORE we inject per-store ones.
  html = _stripPlatformSeoHead(html);

  let injection = `<script>window.__STORE_SLUG__="${escapeHtml(slug)}";`;
  if (storefrontData) {
    const jsonStr = JSON.stringify(storefrontData).replace(/<\/script/gi, "<\\/script");
    injection += `window.__STOREFRONT_DATA__=${jsonStr};`;
  }
  injection += `</script>\n`;
  // v8.32: removed shared-infra preconnect leak

  let inlineThemeCss = "";
  let bgColor = "#ffffff";
  let textColor = "#1a1a1a";
  let primaryColor = "#004643";

  if (storefrontData?.theme_config) {
    const themeResult = buildThemeCssFromConfig(storefrontData.theme_config);
    inlineThemeCss = themeResult.css;
    bgColor = themeResult.bgColor;
    textColor = themeResult.textColor;
    primaryColor = themeResult.primaryColor || primaryColor;
  }

  const logoUrl = storefrontData?.store?.logo_url || "";
  let ogMeta = "";
  let jsonLd = "";
  let seoBody = "";
  if (storefrontData?.store) {
    const s = storefrontData.store;
    // v8.14.0: smarter auto-defaults — pull category names + city for context.
    const cats = Array.isArray(storefrontData.categories) ? storefrontData.categories : [];
    const primaryCat = cats[0]?.name || "";
    const cityBit = s.city ? ` | ${s.city}` : "";
    const autoTitle = primaryCat ? `${s.name} — ${primaryCat} Online${cityBit}` : `${s.name} — Shop Online${cityBit}`;
    const autoDesc = primaryCat
      ? `Shop ${primaryCat.toLowerCase()} from ${s.name}. Cash on delivery, fast shipping across India.`
      : `Shop the best products at ${s.name}. Fast delivery & easy returns across India.`;

    // v8.47.0: canonical SEO head built by shared helper.
    const canonicalBase = s.custom_domain ? `https://${s.custom_domain}` : `https://${slug}.${ROOT_DOMAIN}`;
    ogMeta = _buildHomepageSeoHead(s, cats, canonicalBase, logoUrl);

    jsonLd = _buildHomepageJsonLd(s, canonicalBase, cats, storefrontData?.products_preview);
    seoBody = _buildSeoBodyBlock(s, cats, storefrontData?.products_preview);
  }

  const skeletonMuted = getSkeletonMuted(textColor);
  // FIX #11: Pass actual bgColor — v8.21.0: also pass store name for instant FCP
  const skeleton = buildSkeleton(
    bgColor,
    skeletonMuted,
    true,
    (storefrontData && storefrontData.store && storefrontData.store.name) || "",
    textColor,
    primaryColor,
  );

  // LCP preload: hero image (mobile_hero > banner > logo)
  let lcpPreload = "";
  const s = storefrontData?.store;
  if (s) {
    // Determine hero image — mobile_hero_images first slide, then mobile_hero_url, then banner_url
    let heroImg = "";
    const mhi = s.mobile_hero_images;
    if (Array.isArray(mhi) && mhi.length > 0 && typeof mhi[0] === "string") {
      heroImg = mhi[0];
    } else if (s.mobile_hero_url) {
      heroImg = s.mobile_hero_url;
    } else if (s.banner_url) {
      heroImg = s.banner_url;
    }
    if (heroImg) {
      // Preload hero as fetchpriority=high with srcset for responsive loading
      const heroEsc = escapeHtml(heroImg);
      lcpPreload += `<link rel="preload" as="image" href="${heroEsc}" fetchpriority="high" />\n`;
    }
    // Also preload logo (small, needed for header)
    if (s.logo_url) {
      lcpPreload += `<link rel="preload" as="image" href="${escapeHtml(s.logo_url)}" />\n`;
    }
  }
  // Preload critical font
  lcpPreload += `<link rel="preload" as="font" type="font/woff2" href="/fonts/inter-latin.woff2" crossorigin />\n`;

  // v6.4.0: Preload-scanner image fast-path —
  // emit <link rel="preload" as="image"> for the first 6 product images so
  // the browser begins downloading them at byte 0 (BEFORE any JS executes).
  let productImagePreloads = "";
  let productPreloaderGrid = "";
  let productsJson = "";
  if (Array.isArray(storefrontData?.products) && storefrontData.products.length > 0) {
    productsJson = JSON.stringify(storefrontData.products);
  } else if (inlineProducts && typeof inlineProducts === "string") {
    productsJson = inlineProducts;
  }
  if (productsJson) {
    // Phase 1 fix #2: cut from 6→2 preloads (above-fold mobile only).
    productImagePreloads = _buildProductImagePreloads(productsJson, 2);
    productPreloaderGrid = _buildProductPreloaderGrid(productsJson, 8);
  }

  const cssMatch = html.match(/href="(\/assets\/[^"]+\.css)"/);
  let cssPreload = cssMatch ? `<link rel="preload" href="${cssMatch[1]}" as="style" />\n` : "";

  const DASHBOARD_CHUNK_PATTERN =
    /(?:charts|dash-vendor|admin-pages|dashboard-pages|dashboard-shell|WhatsApp|auth-pages)-/;
  // v8.21.0: Bumped 6→10. The previous cap caused a 4-hop sequential waterfall
  // (index→App→storefront-shell→supabase). HTTP/2 on the warm worker→client leg
  // handles 10 small (<60KB) chunks in parallel without head-of-line blocking
  // the LCP image preload, which has fetchpriority="high" anyway.
  let modulePreloads = "";
  const seen = new Set();
  let mpCount = 0;
  for (const m of [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)]) {
    if (!seen.has(m[1]) && !DASHBOARD_CHUNK_PATTERN.test(m[1])) {
      seen.add(m[1]);
      modulePreloads += `<link rel="modulepreload" href="${m[1]}" />\n`;
      if (++mpCount >= 10) break;
    }
  }

  let injectedHtml = html.replace(
    "<head>",
    `<head>${inlineThemeCss}${productImagePreloads}${lcpPreload}${cssPreload}${modulePreloads}${injection}${ogMeta}${jsonLd}`,
  );
  // Inject skeleton + invisible product preloader grid before #root.
  // The grid's <img> tags are read by the preload-scanner, queueing image
  // downloads in parallel with the React JS bundle.
  injectedHtml = injectedHtml.replace('<div id="root">', `${skeleton}${productPreloaderGrid}${seoBody}<div id="root">`);
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
  pdpCategoryInline = null, // v8.9.0 { kind, json } | null
) {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const enc = new TextEncoder();

  // v8.27.2: capture every chunk we emit so the mirror can build a fully
  // buffered Response after the stream closes. Cloning a streaming Response
  // and calling arrayBuffer() in waitUntil was unreliable (tee buffer limits
  // + client-paced drain), causing HTML cache writes to silently fail and
  // HIT-EARLY to never fire. Capturing in-process is deterministic.
  const _writtenChunks = [];
  let _bytesResolve = null;
  const htmlBytesPromise = new Promise((res) => {
    _bytesResolve = res;
  });
  const writeChunk = async (bytes) => {
    _writtenChunks.push(bytes);
    await writer.write(bytes);
  };

  (async () => {
    try {
      let html = shellResult.html;
      // v8.15.0: ensure <html lang="en"> for SEO + accessibility.
      html = html.replace(/<html(?![^>]*\blang=)/i, '<html lang="en"');

      const headEnd = html.indexOf("</head>");

      if (headEnd === -1) {
        await writeChunk(enc.encode(html));
        return;
      }

      const bgColor = themeLite?.bg || "#ffffff";
      const textColor = themeLite?.tc || "#1a1a1a";
      const themeCss = themeLite ? buildThemeCssFromConfig(themeLite).css : "";

      const productsHint = inlineProducts
        ? `window.__PRODUCTS_INLINE__=${inlineProducts.replace(/<\/script/gi, "<\\/script")};`
        : "";
      const themeHint = themeLite ? `window.__THEME__=${JSON.stringify(themeLite)};` : "";
      let pdpCatHint = "";
      if (pdpCategoryInline?.json) {
        const safeJson = pdpCategoryInline.json.replace(/<\/script/gi, "<\\/script");
        const varName = pdpCategoryInline.kind === "product" ? "__PRODUCT_INLINE__" : "__CATEGORY_INLINE__";
        pdpCatHint = `window.${varName}=${safeJson};`;
      }
      // Set __SF_WORKER__ in the first injected script, before index.html's
      // bootstrap script executes. That lets the app skip its preview-only
      // shell/products/font fallback fetches on real Worker-served storefronts.
      const slugScript = `<script>window.__SF_WORKER__=true;window.__STORE_SLUG__="${escapeHtml(slug)}";${themeHint}${productsHint}${pdpCatHint}</script>`;

      const productImagePreloads = inlineProducts ? _buildProductImagePreloads(inlineProducts, 6) : "";

      let perRouteSeoHead = "";
      let earlyStorefrontResult = null;
      if (pdpCategoryInline?.kind && pdpCategoryInline?.json) {
        try {
          // v8.51.0 — race against 200ms deadline (same reason as homepage below).
          earlyStorefrontResult = await Promise.race([
            storefrontPromise,
            new Promise((resolve) => setTimeout(() => resolve(null), 200)),
          ]);
        } catch {}
        const earlyStore = earlyStorefrontResult?.data?.store;
        if (earlyStore) {
          perRouteSeoHead = _buildPdpCategorySeoHead(
            earlyStore,
            slug,
            null,
            (pdpCategoryInline.kind === "product" ? "/product/" : "/category/") + (pdpCategoryInline.slug || ""),
            pdpCategoryInline,
          );
        }
      } else {
        // v8.51.0 — RACE the storefront shell against a tight 200ms deadline.
        // v8.47.0 awaited it unconditionally, which on cold KV (after every
        // worker deploy across colos) added 1-3s to TTFB and pushed mobile
        // cold loads from 3-4s to 10-14s. Per-route SEO head is a nice-to-have
        // for crawlers; missing it for one cold request is fine — the next
        // warm request will have it. Humans never saw the head anyway.
        try {
          earlyStorefrontResult = await Promise.race([
            storefrontPromise,
            new Promise((resolve) => setTimeout(() => resolve(null), 200)),
          ]);
        } catch {}
        const earlyStore = earlyStorefrontResult?.data?.store;
        if (earlyStore) {
          const _cats = Array.isArray(earlyStorefrontResult.data.categories)
            ? earlyStorefrontResult.data.categories
            : [];
          const _canonBase = earlyStore.custom_domain
            ? `https://${earlyStore.custom_domain}`
            : `https://${slug}.${ROOT_DOMAIN}`;
          const _logo = earlyStore.logo_url || "";
          perRouteSeoHead = _buildHomepageSeoHead(earlyStore, _cats, _canonBase, _logo);
        }
      }


      let headChunk = _stripPlatformSeoHead(html.slice(0, headEnd) + "</head>");
      headChunk = headChunk.slice(0, headChunk.indexOf("</head>"));
      headChunk = headChunk.replace(
        "<head>",
        `<head>${themeCss}${productImagePreloads}${perRouteSeoHead}${prebuiltHead || ""}${slugScript}`,
      );
      headChunk += "</head>";

      await writeChunk(enc.encode(headChunk));

      const storefrontResult = earlyStorefrontResult || (await storefrontPromise);

      const skeletonMuted = getSkeletonMuted(textColor);
      const skeleton = buildSkeleton(
        bgColor,
        skeletonMuted,
        true,
        (storefrontResult &&
          storefrontResult.data &&
          storefrontResult.data.store &&
          storefrontResult.data.store.name) ||
          "",
        textColor,
        (themeLite && (themeLite.pc || themeLite.primary_color)) || "#004643",
      );

      let preloaderProductsJson = inlineProducts || "";
      if (Array.isArray(storefrontResult?.data?.products) && storefrontResult.data.products.length > 0) {
        preloaderProductsJson = JSON.stringify(storefrontResult.data.products);
      }
      const productPreloaderGrid = preloaderProductsJson ? _buildProductPreloaderGrid(preloaderProductsJson, 8) : "";

      let bodyChunk = html.slice(headEnd + 7);

      // v8.45.0 — homepage SEO body block (hidden, crawler-readable) for the
      // streaming path. Skipped on PDP/category (those have their own per-route
      // SEO head already injected via _buildPdpCategorySeoHead).
      let homepageSeoBody = "";
      let homepageJsonLdScripts = "";
      if (storefrontResult?.data?.store && !pdpCategoryInline?.kind) {
        const _s = storefrontResult.data.store;
        const _cats = Array.isArray(storefrontResult.data.categories) ? storefrontResult.data.categories : [];
        const _prods = Array.isArray(storefrontResult.data.products_preview)
          ? storefrontResult.data.products_preview
          : (Array.isArray(storefrontResult.data.products) ? storefrontResult.data.products : []);
        const _canonBase = _s.custom_domain ? `https://${_s.custom_domain}` : `https://${slug}.${ROOT_DOMAIN}`;
        homepageSeoBody = _buildSeoBodyBlock(_s, _cats, _prods);
        homepageJsonLdScripts = _buildHomepageJsonLd(_s, _canonBase, _cats, _prods);
      }
      bodyChunk = bodyChunk.replace('<div id="root">', `${skeleton}${productPreloaderGrid}${homepageSeoBody}${homepageJsonLdScripts}<div id="root">`);

      // v8.36.0: place __STOREFRONT_DATA__ BEFORE the first <script type="module">
      // so React modules can read it on first render. Previously we injected it
      // before </body> — which technically runs before modules execute, but any
      // race left consumers (TrustStrip, Footer email, etc.) doing a redundant
      // REST call on cold loads. Pre-module placement removes that risk entirely.
      if (storefrontResult?.data) {
        const jsonStr = JSON.stringify(storefrontResult.data).replace(/<\/script/gi, "<\\/script");
        const dataScript = `<script>window.__STOREFRONT_DATA__=${jsonStr};</script>`;
        const moduleIdx = bodyChunk.search(/<script\b[^>]*\btype=["']module["']/i);
        if (moduleIdx !== -1) {
          bodyChunk = bodyChunk.slice(0, moduleIdx) + dataScript + bodyChunk.slice(moduleIdx);
        } else {
          bodyChunk = bodyChunk.replace("</body>", `${dataScript}</body>`);
        }
      }

      // v8.47.0: title/canonical/og:url/icon are now injected as REAL HTML
      // by _buildHomepageSeoHead above, so the previous client-side
      // document.title fallback is no longer needed.


      await writeChunk(enc.encode(bodyChunk));
    } catch {
    } finally {
      try {
        writer.close();
      } catch {}
      try {
        const total = _writtenChunks.reduce((a, c) => a + c.byteLength, 0);
        const buf = new Uint8Array(total);
        let off = 0;
        for (const c of _writtenChunks) {
          buf.set(c, off);
          off += c.byteLength;
        }
        _bytesResolve(buf);
      } catch {
        _bytesResolve(null);
      }
    }
  })();

  const resp = new Response(readable, { status: 200, headers: responseHeaders });
  // v8.27.2: stash buffered-bytes promise for the mirror path.
  try {
    resp._htmlBytesPromise = htmlBytesPromise;
  } catch {}
  return resp;
}

async function mirrorStreamedHtmlDirect(ctx, request, response, slug, env = null) {
  try {
    if (!ctx?.waitUntil || !response || request.method !== "GET") return;
    // v8.27.2: prefer the buffered-bytes promise attached by serveStreamedHtml.
    // Cloning a streaming Response and reading arrayBuffer() in waitUntil was
    // flaky (tee buffer + client-paced drain), so HTML cache writes silently
    // failed. The buffered path is deterministic.
    const bytesPromise = response._htmlBytesPromise;
    if (bytesPromise) {
      const headers = new Headers(response.headers);
      ctx.waitUntil(
        (async () => {
          try {
            const buf = await bytesPromise;
            if (!buf || !buf.byteLength) return;
            const buffered = new Response(buf, { status: 200, headers });
            await mirrorToCfCache(ctx, request, buffered, slug, env);
          } catch {}
        })(),
      );
      return;
    }
    const cloned = response.clone();
    ctx.waitUntil(mirrorToCfCache(ctx, request, cloned, slug, env));
  } catch {}
}

/* ============================================================
   CORE STOREFRONT FETCH + INJECT
   FIX #2: storefront promise starts FIRST (before any awaits)
   FIX #4: batch KV read for shell+theme+storefront
   FIX #5: deadline anchored to requestStart
   ============================================================ */

async function fetchAndInjectSlug(
  request,
  slug,
  ctx,
  env,
  hostname,
  pathname,
  requestStart,
  prefetchedInlineProducts = null,
) {
  // FIX #2 + #5: Kick off storefront fetch IMMEDIATELY.
  // Measure remaining deadline from original request arrival.
  const elapsed = Date.now() - (requestStart || Date.now());
  const remaining = Math.max(400, 1400 - elapsed);
  const storefrontPromise = prefetchStorefrontDataWithDeadline(slug, ctx, env, remaining);

  // v7.7.0 Fix 2: Skip _getInlineProductsOrNull if caller already fetched it.
  // FIX #4: Batch KV reads in one Promise.all
  const [shellResult, kvBatch, cachedHeadMem, inlineProducts] = await Promise.all([
    getNavigationSpaShell(request, ctx, env),
    _batchKvRead(slug, env),
    _getCachedPrebuiltHead(env),
    prefetchedInlineProducts !== null
      ? Promise.resolve(prefetchedInlineProducts)
      : _getInlineProductsOrNull(hostname, slug, env, ctx),
  ]);

  // Hydrate in-memory caches from batch KV read
  if (kvBatch.theme && !_memThemeCache.get(slug)?.expiresAt) {
    _capMapSize(_memThemeCache, MEM_THEME_CACHE_MAX);
    _memThemeCache.set(slug, { lite: kvBatch.theme, expiresAt: Date.now() + MEM_THEME_TTL });
  }
  // v7.6.0 Fix D: kvBatch.storefront removed — prefetchStorefrontData already
  // populates _memStorefrontCache itself, so no manual hydration needed.

  // Resolve theme from memory (already populated above if needed)
  const themeLite = _memThemeCache.get(slug)?.lite || kvBatch.theme || null;

  if (!shellResult?.html) {
    const response = await proxyToOrigin(request);
    return { response, dataSource: "none" };
  }

  let prebuiltHead = cachedHeadMem || (await getPrebuiltHead(shellResult.html, env));
  prebuiltHead = await enrichHeadWithDeepPreloads(prebuiltHead, new URL(request.url).origin, env);
  // FIX #3: Always build Link header for every response
  const linkHeader = _buildLinkPreloadHeader(shellResult.html);

  const newHeaders = new Headers();
  newHeaders.set("Content-Type", "text/html; charset=utf-8");
  // v7.4.0 #1: Streaming HTML TTL bumped 1800→3600s (1h). Storefront data
  // is injected inline; merchants see edits within 1h or via purge button.
  setNoStoreHtmlHeaders(newHeaders);
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

  await mirrorStreamedHtmlDirect(ctx, request, response, slug, env);

  // v7.7.0 Fix 2: pass already-resolved inlineProducts so warm doesn't refetch.
  ctx.waitUntil(_warmFullHtmlInBackground(request, shellResult, slug, ctx, env, hostname, pathname, inlineProducts));

  return { response, dataSource: "streaming" };
}

/* ============================================================
   BACKGROUND HTML WARM
   FIX #10: Cache-Control raised to 3600/7200
   v7.4.0 LEAK FIX #2: 60s in-memory dedup lock prevents the same store
   from being warmed multiple times within a 60s window. Previously this
   function was invoked from 6+ code paths on every cache hit, causing
   ~7k redundant Worker subrequests/day for 2 active stores.
   ============================================================ */

// v7.6.0 Fix B + v7.7.0 Fix 1: Cross-isolate KV-based warm lock with SYNC put.
// The lock now writes synchronously (await) BEFORE any subrequest-heavy work,
// closing the race window from ~500ms (deferred via ctx.waitUntil) to ~50ms.
// v7.7.0 Fix 2: accept prefetchedInlineProducts to avoid 3rd redundant fetch.
async function _warmFullHtmlInBackground(
  request,
  shellResult,
  slug,
  ctx,
  env,
  hostname,
  pathname,
  prefetchedInlineProducts = null,
) {
  try {
    // v8.0.0 cost-cut: bots that fall through to the warm path skip all KV writes.
    if (ctx?.__skipKvWarm) return;

    // v8.9.1: PDP and Category routes need __PRODUCT_INLINE__/__CATEGORY_INLINE__
    // injection which only happens in the streaming path. Skip warm-html here
    // and rely on mirrorToCfCache (per-URL CF cache) populated during streaming.
    if (pathname && /^\/(product|category)\/[a-zA-Z0-9_-]+\/?$/.test(pathname)) {
      return;
    }

    // skip the warm-lock write entirely (avoids ~30% of warm-lock KV writes).
    if (hostname) {
      const earlyKey = getEarlyCacheKey(hostname, pathname);
      const existing = await cache.match(earlyKey);
      if (existing) {
        const ds = existing.headers.get("X-Data-Source") || "";
        if (ds && ds !== "fast-shell" && ds !== "fast-shell-themed" && ds !== "streaming") return;
      }
    }

    // ── Cross-isolate KV lock (SYNC write, v7.7.0 Fix 1) ──
    // v8.18.0 Fix D: short-circuit on in-memory marker first. If this isolate
    // already grabbed the warm-lock within the last 5 min, skip the KV.get
    // AND KV.put entirely — that's the single biggest source of KV ops here.
    if (_memWarmLockHas(slug)) return;
    if (env?.STORE_KV) {
      const lockKey = `warm-lock:${slug}`;
      try {
        const existing = await env.STORE_KV.get(lockKey);
        if (existing) {
          _memWarmLockSet(slug); // remember so future requests skip KV.get too
          return;
        }
        // kvPutDedup already collapses repeat warm-lock writes for 24h per isolate.
        await kvPutDedup(env, lockKey, "1", { expirationTtl: 300 });
        _memWarmLockSet(slug);
      } catch {}
    }

    const warmKey = `warm-html:${slug}`;
    if (!shouldRevalidate(warmKey)) return;

    // v7.7.0 Fix 2: reuse prefetched inlineProducts when caller passed them.
    const [prefetchResult, inlineProducts] = await Promise.all([
      prefetchStorefrontData(slug, ctx, env),
      prefetchedInlineProducts !== null
        ? Promise.resolve(prefetchedInlineProducts)
        : _getInlineProductsOrNull(hostname, slug, env, ctx),
    ]);
    if (!prefetchResult.data) return;

    const result = injectIntoHtml(shellResult.html, slug, prefetchResult.data, prefetchResult.source, inlineProducts);

    const fullHeaders = new Headers();
    fullHeaders.set("Content-Type", "text/html; charset=utf-8");
    // v7.4.0 #1: Warm HTML max-age bumped 3600→7200s (2h) with SWR=7d.
    // Cache hit rate jumps from ~95% → ~98%, cutting Worker invocations
    // for repeat anonymous visitors.
    setNoStoreHtmlHeaders(fullHeaders);
    // v7.3.0 #5: ETag for 304 Not Modified responses on repeat visits.
    const etag = `W/"${slug}-${Date.now().toString(36)}"`;
    fullHeaders.set("ETag", etag);
    fullHeaders.set("X-Store-Slug", slug);
    fullHeaders.set("X-Data-Source", prefetchResult.source);
    fullHeaders.set("X-Shell-Source", shellResult.source);
    fullHeaders.set("X-Cache-Timestamp", new Date().toISOString());
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) fullHeaders.set(k, v);

    const fullResponse = new Response(result.html, { status: 200, headers: fullHeaders });

    if (hostname) {
      const earlyKey = getEarlyCacheKey(hostname, pathname);
      await cache.put(earlyKey, fullResponse.clone()).catch(() => {});
      // v8.4.0: ALSO mirror under the real request URL so Cloudflare's
      // automatic edge cache (and the dashboard cache-rate metric) sees a HIT.
      await mirrorToCfCache(ctx, request, fullResponse, slug, env).catch?.(() => {});
    }
  } catch {}
}

function storeInEdgeCache(ctx, hostname, slug, response, request = null, env = null) {
  if (/no-store|no-cache|max-age=0/i.test(response?.headers?.get("Cache-Control") || "")) return;
  const earlyKey = getEarlyCacheKey(hostname);
  ctx.waitUntil(cache.put(earlyKey, response.clone()).catch(() => {}));
  // v8.4.0: when caller passes request, also mirror to CF Cache API for HIT metric.
  // v8.25.2: pass slug so the canonical zone-key mirror is also written.
  // v8.27.0: pass env so KV HTML mirror also fires.
  // v8.27.1 BUGFIX: previously fire-and-forget — runtime cancelled
  // mirrorToCfCache (async arrayBuffer + 3 cache writes + KV put) before
  // completion, so the cold-cache-api path silently failed to populate
  // any HTML cache. Wrap in waitUntil to keep the chain alive past
  // response return.
  if (request) {
    ctx.waitUntil(mirrorToCfCache(ctx, request, response.clone(), slug || null, env));
  }
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
const MEM_PV_TTL = 1_800_000; // v8.2.0 Fix #4: 5min → 30min. /api/purge bumps version on save → no staleness risk.
const MEM_PV_MAX = 5_000;

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
  _capMapSize(_memProductVersion, MEM_PV_MAX);
  _memProductVersion.set(domain, { version, ts: now });
  return version;
}

async function _bumpProductVersion(domain, env) {
  const current = await _getProductVersion(domain, env);
  const next = current + 1;
  if (env?.STORE_KV) {
    await env.STORE_KV.put(`pv:${domain}`, String(next), { expirationTtl: 86400 }).catch(() => {});
  }
  _capMapSize(_memProductVersion, MEM_PV_MAX);
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
  const cleanDomain = domain
    .replace(/^www\./, "")
    .toLowerCase()
    .trim();
  await _bumpProductVersion(cleanDomain, env);
  _clearInflightProductRequestsForDomain(cleanDomain);
}

async function _prewarmProducts(storeId, slug, ctx, env, customDomain) {
  const domain = slug ? `${slug}.${ROOT_DOMAIN}` : "unknown";
  const version = await _getProductVersion(domain, env);
  const cacheKey = _buildProductsCacheKey(domain, {}, version);

  try {
    const existing = await cache.match(cacheKey);
    if (existing) return;
  } catch {}

  try {
    const data = await _fetchProductsFromDb(storeId, {}, PRODUCTS_DB_TIMEOUT_MS);
    const body = JSON.stringify(data || []);
    const kvKey = _buildProductsKvKey(domain, {}, version);
    const cacheOps = [
      cache
        .put(
          cacheKey,
          new Response(body, {
            headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${PRODUCTS_CACHE_TTL}` },
          }),
        )
        .catch(() => {}),
      kvPutDedup(env, kvKey, body, { expirationTtl: PRODUCTS_KV_TTL }),
    ];

    if (customDomain) {
      const cleanCustom = customDomain
        .replace(/^www\./, "")
        .toLowerCase()
        .trim();
      const cvVersion = await _getProductVersion(cleanCustom, env);
      cacheOps.push(
        cache
          .put(
            _buildProductsCacheKey(cleanCustom, {}, cvVersion),
            new Response(body, {
              headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${PRODUCTS_CACHE_TTL}` },
            }),
          )
          .catch(() => {}),
        kvPutDedup(env, _buildProductsKvKey(cleanCustom, {}, cvVersion), body, { expirationTtl: PRODUCTS_KV_TTL }),
      );
    }

    await Promise.all(cacheOps);
  } catch {}
}

/* ============================================================
   v8.8.0 — PDP + CATEGORY API (single-RPC, edge-cached)
   ============================================================
   Phase A: Eliminates 5+ DB roundtrips on cold product/category
   page opens by proxying the new get_product_page /
   get_category_page RPCs at the edge with KV + Cache API.
   Version-keyed under the same `pv:{domain}` counter so a single
   /api/purge-store call invalidates products + PDP + category. */

const PDP_CACHE_TTL = 300; // 5min browser
const PDP_KV_TTL = 86400; // 24h KV / s-maxage
const CATEGORY_CACHE_TTL = 300;
const CATEGORY_KV_TTL = 86400;
const PDP_DB_TIMEOUT_MS = 1500;

const inflightPdpRequests = new Map();
const inflightCategoryRequests = new Map();

function _buildPdpCacheKey(domain, productSlug, version) {
  return new Request(`https://cache/pdp:v${version}:${domain}:${productSlug}`);
}
function _buildPdpKvKey(domain, productSlug, version) {
  return `pdp:v${version}:${domain}:${productSlug}`;
}
function _buildCategoryCacheKey(domain, categorySlug, version) {
  return new Request(`https://cache/category:v${version}:${domain}:${categorySlug}`);
}
function _buildCategoryKvKey(domain, categorySlug, version) {
  return `category:v${version}:${domain}:${categorySlug}`;
}

async function _fetchPdpFromDb(storeSlug, productSlug, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_product_page`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Encoding": "br, gzip", // Tier-1 #5
      },
      body: JSON.stringify({ _store_slug: storeSlug, _product_slug: productSlug }),
      signal: controller.signal,
      cf: { cacheEverything: true, cacheTtl: 60, cacheTtlByStatus: { "200-299": 60, 404: 30, "500-599": 0 } },
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`PDP RPC error: ${res.status}`);
    return await res.json();
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

async function _fetchCategoryFromDb(storeSlug, categorySlug, limit, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_category_page`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Encoding": "br, gzip", // Tier-1 #5
      },
      body: JSON.stringify({ _store_slug: storeSlug, _category_slug: categorySlug, _limit: limit }),
      signal: controller.signal,
      cf: { cacheEverything: true, cacheTtl: 60, cacheTtlByStatus: { "200-299": 60, 404: 30, "500-599": 0 } },
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`Category RPC error: ${res.status}`);
    return await res.json();
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

async function _resolveStoreSlugForDomain(domain, env) {
  // domain might already be `<slug>.<root>` or a custom domain mapped via KV
  const cleanDomain = domain
    .replace(/^www\./, "")
    .toLowerCase()
    .trim();
  if (cleanDomain.endsWith(`.${ROOT_DOMAIN}`)) {
    return cleanDomain.slice(0, -1 - ROOT_DOMAIN.length);
  }
  if (env?.STORE_KV) {
    try {
      const slug = await env.STORE_KV.get(`domain:${cleanDomain}`, { type: "text" });
      if (slug) {
        try {
          const j = JSON.parse(slug);
          if (j?.slug) return j.slug;
        } catch {
          return slug;
        }
      }
    } catch {}
  }
  return null;
}

/* v8.9.0 — Detect /product/<slug>, legacy /products/<slug>, and /category/<slug> for HTML inlining.
   Returns { kind: 'product'|'category', slug } or null. */
function _parsePdpCategoryPath(pathname) {
  if (!pathname) return null;
  let m = pathname.match(/^\/products?\/([a-zA-Z0-9_-]+)\/?$/);
  if (m) return { kind: "product", slug: m[1] };
  m = pathname.match(/^\/category\/([a-zA-Z0-9_-]+)\/?$/);
  if (m) return { kind: "category", slug: m[1] };
  return null;
}

/* v8.9.0 — Read PDP / category JSON from edge cache or KV WITHOUT touching DB.
   Critical render path must stay cache-only; DB hit happens via /api/* fallback
   if neither layer has it warm. Returns the raw JSON string or null. */
async function _getInlinePdpCategoryOrNull(hostname, route, env, ctx) {
  if (!route) return null;
  try {
    const version = await _getProductVersion(hostname, env);
    let cacheKey, kvKey;
    if (route.kind === "product") {
      cacheKey = _buildPdpCacheKey(hostname, route.slug, version);
      kvKey = _buildPdpKvKey(hostname, route.slug, version);
    } else {
      cacheKey = _buildCategoryCacheKey(hostname, `${route.slug}:l50`, version);
      kvKey = _buildCategoryKvKey(hostname, `${route.slug}:l50`, version);
    }
    const cached = await cache.match(cacheKey);
    if (cached) return await cached.text();
    if (env?.STORE_KV) {
      const kvVal = await env.STORE_KV.get(kvKey, { type: "text" });
      if (kvVal) {
        ctx.waitUntil(
          cache
            .put(
              cacheKey,
              new Response(kvVal, {
                headers: {
                  "Content-Type": "application/json",
                  "Cache-Control":
                    route.kind === "product"
                      ? `public, max-age=${PDP_CACHE_TTL}`
                      : `public, max-age=${CATEGORY_CACHE_TTL}`,
                },
              }),
            )
            .catch(() => {}),
        );
        return kvVal;
      }
    }
  } catch {}
  return null;
}

async function handlePdpApi(request, url, ctx, env) {
  const domain = (request.headers.get("host") || url.hostname).toLowerCase().trim();
  const productSlug = (url.searchParams.get("slug") || "").trim();
  if (!productSlug) {
    return addCorsHeaders(
      new Response(JSON.stringify({ error: "missing slug" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
      "bad-request",
    );
  }
  const version = await _getProductVersion(domain, env);
  const cacheKey = _buildPdpCacheKey(domain, productSlug, version);
  const kvKey = _buildPdpKvKey(domain, productSlug, version);

  try {
    const cached = await cache.match(cacheKey);
    if (cached) {
      const fresh = new Response(cached.body, cached);
      fresh.headers.set(
        "Cache-Control",
        `public, max-age=${PDP_CACHE_TTL}, s-maxage=${PDP_KV_TTL}, stale-while-revalidate=${PDP_KV_TTL}`,
      );
      fresh.headers.set("Vary", "Accept-Encoding");
      return addCorsHeaders(fresh, "pdp-cache-api");
    }
  } catch {}

  if (env?.STORE_KV) {
    try {
      const kvData = await env.STORE_KV.get(kvKey, { type: "text" });
      if (kvData) {
        const resp = new Response(kvData, {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": `public, max-age=${PDP_CACHE_TTL}, s-maxage=${PDP_KV_TTL}, stale-while-revalidate=${PDP_KV_TTL}`,
            Vary: "Accept-Encoding",
          },
        });
        ctx.waitUntil(cache.put(cacheKey, resp.clone()).catch(() => {}));
        return addCorsHeaders(resp, "pdp-kv");
      }
    } catch {}
  }

  const storeSlug = await _resolveStoreSlugForDomain(domain, env);
  if (!storeSlug) {
    return addCorsHeaders(
      new Response(JSON.stringify({ error: "unknown domain" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }),
      "no-store",
    );
  }

  const coalesceKey = `${domain}:${productSlug}`;
  if (inflightPdpRequests.has(coalesceKey)) {
    try {
      const data = await inflightPdpRequests.get(coalesceKey);
      return _buildPdpResponse(data, cacheKey, kvKey, ctx, env, "pdp-coalesced");
    } catch {}
  }
  const fetchPromise = _fetchPdpFromDb(storeSlug, productSlug, PDP_DB_TIMEOUT_MS);
  inflightPdpRequests.set(coalesceKey, fetchPromise);
  try {
    const data = await fetchPromise;
    return _buildPdpResponse(data, cacheKey, kvKey, ctx, env, "pdp-origin");
  } catch {
    return addCorsHeaders(
      new Response(JSON.stringify({ product: null, error: "upstream" }), {
        status: 502,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
      "pdp-error",
    );
  } finally {
    inflightPdpRequests.delete(coalesceKey);
  }
}

function _buildPdpResponse(data, cacheKey, kvKey, ctx, env, source) {
  const body = JSON.stringify(data || { product: null });
  const response = new Response(body, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=${PDP_CACHE_TTL}, s-maxage=${PDP_KV_TTL}, stale-while-revalidate=${PDP_KV_TTL}`,
      Vary: "Accept-Encoding",
    },
  });
  // Only cache successful payloads (avoid cementing nulls forever)
  if (data && data.product) {
    ctx.waitUntil(
      Promise.all([
        cache.put(cacheKey, response.clone()).catch(() => {}),
        ctx?.__skipKvWarm ? Promise.resolve() : kvPutLongTail(env, kvKey, body, { expirationTtl: PDP_KV_TTL }), // v8.19.0 B
      ]),
    );
  } else {
    // v8.8.1 Fix #4: cache "not found" briefly so DoS via random slugs can't hammer DB.
    const negResp = new Response(body, {
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60, s-maxage=60" },
    });
    ctx.waitUntil(cache.put(cacheKey, negResp).catch(() => {}));
  }
  return addCorsHeaders(response, source);
}

async function handleCategoryApi(request, url, ctx, env) {
  const domain = (request.headers.get("host") || url.hostname).toLowerCase().trim();
  const categorySlug = (url.searchParams.get("slug") || "").trim();
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 100);
  if (!categorySlug) {
    return addCorsHeaders(
      new Response(JSON.stringify({ error: "missing slug" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
      "bad-request",
    );
  }
  const version = await _getProductVersion(domain, env);
  const cacheKey = _buildCategoryCacheKey(domain, `${categorySlug}:l${limit}`, version);
  const kvKey = _buildCategoryKvKey(domain, `${categorySlug}:l${limit}`, version);

  try {
    const cached = await cache.match(cacheKey);
    if (cached) {
      const fresh = new Response(cached.body, cached);
      fresh.headers.set(
        "Cache-Control",
        `public, max-age=${CATEGORY_CACHE_TTL}, s-maxage=${CATEGORY_KV_TTL}, stale-while-revalidate=${CATEGORY_KV_TTL}`,
      );
      fresh.headers.set("Vary", "Accept-Encoding");
      return addCorsHeaders(fresh, "category-cache-api");
    }
  } catch {}

  if (env?.STORE_KV) {
    try {
      const kvData = await env.STORE_KV.get(kvKey, { type: "text" });
      if (kvData) {
        const resp = new Response(kvData, {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": `public, max-age=${CATEGORY_CACHE_TTL}, s-maxage=${CATEGORY_KV_TTL}, stale-while-revalidate=${CATEGORY_KV_TTL}`,
            Vary: "Accept-Encoding",
          },
        });
        ctx.waitUntil(cache.put(cacheKey, resp.clone()).catch(() => {}));
        return addCorsHeaders(resp, "category-kv");
      }
    } catch {}
  }

  const storeSlug = await _resolveStoreSlugForDomain(domain, env);
  if (!storeSlug) {
    return addCorsHeaders(
      new Response(JSON.stringify({ error: "unknown domain" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }),
      "no-store",
    );
  }

  const coalesceKey = `${domain}:${categorySlug}:${limit}`;
  if (inflightCategoryRequests.has(coalesceKey)) {
    try {
      const data = await inflightCategoryRequests.get(coalesceKey);
      return _buildCategoryResponse(data, cacheKey, kvKey, ctx, env, "category-coalesced");
    } catch {}
  }
  const fetchPromise = _fetchCategoryFromDb(storeSlug, categorySlug, limit, PDP_DB_TIMEOUT_MS);
  inflightCategoryRequests.set(coalesceKey, fetchPromise);
  try {
    const data = await fetchPromise;
    return _buildCategoryResponse(data, cacheKey, kvKey, ctx, env, "category-origin");
  } catch {
    return addCorsHeaders(
      new Response(JSON.stringify({ category: null, products: [], error: "upstream" }), {
        status: 502,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
      "category-error",
    );
  } finally {
    inflightCategoryRequests.delete(coalesceKey);
  }
}

function _buildCategoryResponse(data, cacheKey, kvKey, ctx, env, source) {
  const body = JSON.stringify(data || { category: null, products: [] });
  const response = new Response(body, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=${CATEGORY_CACHE_TTL}, s-maxage=${CATEGORY_KV_TTL}, stale-while-revalidate=${CATEGORY_KV_TTL}`,
      Vary: "Accept-Encoding",
    },
  });
  if (data && data.category) {
    ctx.waitUntil(
      Promise.all([
        cache.put(cacheKey, response.clone()).catch(() => {}),
        ctx?.__skipKvWarm ? Promise.resolve() : kvPutLongTail(env, kvKey, body, { expirationTtl: CATEGORY_KV_TTL }), // v8.19.0 B
      ]),
    );
  } else {
    // v8.8.1 Fix #4: short negative cache for unknown categories.
    const negResp = new Response(body, {
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60, s-maxage=60" },
    });
    ctx.waitUntil(cache.put(cacheKey, negResp).catch(() => {}));
  }
  return addCorsHeaders(response, source);
}

/* v8.8.1 — Cron prewarm helper for PDP + category edge caches.
   Limits: top 8 products + all categories per store, fire-and-forget. */
async function _prewarmPdpAndCategory(store, storefrontData, env, ctx) {
  if (!store?.slug) return;
  const domain = `${store.slug}.${ROOT_DOMAIN}`.toLowerCase();
  const customDomain = store.custom_domain
    ? store.custom_domain
        .replace(/^www\./, "")
        .toLowerCase()
        .trim()
    : null;
  const products = Array.isArray(storefrontData?.products) ? storefrontData.products : [];
  const categories = Array.isArray(storefrontData?.categories) ? storefrontData.categories : [];

  // v8.47 cost-cut: trim cron prewarm fanout. Previously 8 PDPs × 12 cats × 2
  // domains = up to 40 subreqs per warmed store. Real visitors warm whichever
  // PDP/category they hit (with 24h TTL) — cron just needs to seed the most
  // likely first hits. Cut to 3 PDPs + 5 categories.
  const topProducts = products
    .slice(0, 3)
    .map((p) => p?.slug)
    .filter(Boolean);
  const topCategories = categories
    .slice(0, 5)
    .map((c) => c?.slug)
    .filter(Boolean);


  const version = await _getProductVersion(domain, env);
  const customVersion = customDomain ? await _getProductVersion(customDomain, env) : null;

  // Helper: prewarm one PDP slug for one domain
  async function warmPdp(d, ver, slug) {
    const cacheKey = _buildPdpCacheKey(d, slug, ver);
    try {
      const existing = await cache.match(cacheKey);
      if (existing) return;
    } catch {}
    try {
      const data = await _fetchPdpFromDb(store.slug, slug, PDP_DB_TIMEOUT_MS);
      if (!data?.product) return;
      const body = JSON.stringify(data);
      const resp = new Response(body, {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": `public, max-age=${PDP_CACHE_TTL}, s-maxage=${PDP_KV_TTL}`,
        },
      });
      await Promise.all([
        cache.put(cacheKey, resp.clone()).catch(() => {}),
        kvPutDedup(env, _buildPdpKvKey(d, slug, ver), body, { expirationTtl: PDP_KV_TTL }),
      ]);
    } catch {}
  }

  async function warmCategory(d, ver, slug) {
    const cacheKey = _buildCategoryCacheKey(d, `${slug}:l50`, ver);
    try {
      const existing = await cache.match(cacheKey);
      if (existing) return;
    } catch {}
    try {
      const data = await _fetchCategoryFromDb(store.slug, slug, 50, PDP_DB_TIMEOUT_MS);
      if (!data?.category) return;
      const body = JSON.stringify(data);
      const resp = new Response(body, {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": `public, max-age=${CATEGORY_CACHE_TTL}, s-maxage=${CATEGORY_KV_TTL}`,
        },
      });
      await Promise.all([
        cache.put(cacheKey, resp.clone()).catch(() => {}),
        kvPutDedup(env, _buildCategoryKvKey(d, `${slug}:l50`, ver), body, { expirationTtl: CATEGORY_KV_TTL }),
      ]);
    } catch {}
  }

  // Concurrency-limited fan-out (3 at a time to stay polite to DB)
  const tasks = [];
  for (const slug of topProducts) {
    tasks.push(() => warmPdp(domain, version, slug));
    if (customDomain) tasks.push(() => warmPdp(customDomain, customVersion, slug));
  }
  for (const slug of topCategories) {
    tasks.push(() => warmCategory(domain, version, slug));
    if (customDomain) tasks.push(() => warmCategory(customDomain, customVersion, slug));
  }
  const C = 3;
  for (let i = 0; i < tasks.length; i += C) {
    await Promise.all(tasks.slice(i, i + C).map((fn) => fn()));
  }
}

async function handleProductsApi(request, url, ctx, env) {
  const domain = (request.headers.get("host") || url.hostname).toLowerCase().trim();
  const filters = {
    category: url.searchParams.get("category") || "",
    page: url.searchParams.get("page") || "",
    sort: url.searchParams.get("sort") || "",
  };

  // Get current version for this domain (cached in-memory for 60s)
  const version = await _getProductVersion(domain, env);
  const cacheKey = _buildProductsCacheKey(domain, filters, version);
  const kvKey = _buildProductsKvKey(domain, filters, version);

  try {
    const cached = await cache.match(cacheKey);
    if (cached) {
      const revalKey = `products:v${version}:${domain}:${filters.category}:${filters.page}:${filters.sort}`;
      if (shouldRevalidate(revalKey)) {
        ctx.waitUntil(_refreshProductsBackground(domain, filters, version, env));
      }
      // Re-assert browser Cache-Control for anonymous users so repeat
      // visits within 5 min are served from the BROWSER cache (zero Worker hit).
      const fresh = new Response(cached.body, cached);
      fresh.headers.set(
        "Cache-Control",
        `public, max-age=${PRODUCTS_CACHE_TTL}, stale-while-revalidate=${PRODUCTS_KV_TTL}`,
      );
      fresh.headers.set("Vary", "Accept-Encoding");
      return addCorsHeaders(fresh, "cache-api");
    }
  } catch {}

  if (env?.STORE_KV) {
    try {
      const kvData = await env.STORE_KV.get(kvKey, { type: "text" });
      if (kvData) {
        // v8.2.0 Fix #5: Synchronously seed Cache API on the KV-hit path
        // (was waitUntil → next request still missed cache). Also assert
        // Vary so CF edge stores per-encoding variants.
        const cacheBody = new Response(kvData, {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": `public, max-age=${PRODUCTS_CACHE_TTL}, s-maxage=${PRODUCTS_KV_TTL}`,
            Vary: "Accept-Encoding",
          },
        });
        ctx.waitUntil(cache.put(cacheKey, cacheBody.clone()).catch(() => {}));
        return addCorsHeaders(
          new Response(kvData, {
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": `public, max-age=${PRODUCTS_CACHE_TTL}, s-maxage=${PRODUCTS_KV_TTL}, stale-while-revalidate=${PRODUCTS_KV_TTL}`,
              Vary: "Accept-Encoding",
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

  const coalesceKey = `${domain}:${filters.category}:${filters.page}:${filters.sort}`;

  if (inflightProductRequests.has(coalesceKey)) {
    try {
      const data = await inflightProductRequests.get(coalesceKey);
      return buildProductResponse(data, cacheKey, kvKey, ctx, env, "origin-coalesced", filters);
    } catch {
      return _fallbackProducts(domain, filters, version, env);
    }
  }

  const fetchPromise = _fetchProductsFromDb(storeId, filters, PRODUCTS_DB_TIMEOUT_MS);
  inflightProductRequests.set(coalesceKey, fetchPromise);

  try {
    const data = await fetchPromise;
    return buildProductResponse(data, cacheKey, kvKey, ctx, env, "origin", filters);
  } catch {
    return _fallbackProducts(domain, filters, version, env);
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
        // display_order first (manual merchant sorting), then best-selling, then newest.
        // When a category filter is set, "pinned to top of category" products win first —
        // newest pin first, then existing ordering. Pin flag is per-product, single-category.
        if (filters.category) {
          params.set(
            "order",
            "is_category_pinned.desc,category_pinned_at.desc.nullslast,display_order.asc,is_best_selling.desc,created_at.desc,id.asc"
          );
        } else {
          params.set("order", "display_order.asc,is_best_selling.desc,created_at.desc,id.asc");
        }
    }

    const page = parseInt(filters.page, 10);
    if (page > 0) params.set("offset", String(page * PRODUCTS_PAGE_SIZE));

    // v8.6.0: cf.cacheEverything (60s) — fast invalidation via /api/purge-store still works,
    // and CF dashboard now counts these as cache hits. Short TTL keeps stock/price freshness.
    const res = await fetch(`${SUPABASE_URL}/rest/v1/products?${params}`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, Accept: "application/json" },
      signal: controller.signal,
      cf: { cacheEverything: true, cacheTtl: 60, cacheTtlByStatus: { "200-299": 60, 404: 30, "500-599": 0 } },
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`DB error: ${res.status}`);
    return await res.json();
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

function buildProductResponse(data, cacheKey, kvKey, ctx, env, source, filters) {
  const body = JSON.stringify(data || []);
  const response = new Response(body, {
    headers: {
      "Content-Type": "application/json",
      // v8.2.0 Fix #5: Added s-maxage so Cloudflare's edge (not just the
      // browser) caches this response for PRODUCTS_KV_TTL across all PoPs.
      // Anonymous browser cache (max-age) keeps repeat visits Worker-free
      // for 5 min; CF edge cache absorbs new visitors for 24h.
      "Cache-Control": `public, max-age=${PRODUCTS_CACHE_TTL}, s-maxage=${PRODUCTS_KV_TTL}, stale-while-revalidate=${PRODUCTS_KV_TTL}`,
      Vary: "Accept-Encoding",
    },
  });
  ctx.waitUntil(
    Promise.all([
      cache.put(cacheKey, response.clone()).catch(() => {}),
      // v8.1.0: bots skip KV; dedup collapses repeats.
      // v8.19.0 B+C: default-filter pages → direct KV write; filtered/paged
      // long-tail combos → second-hit gate (Cache API only on first miss).
      ctx?.__skipKvWarm
        ? Promise.resolve()
        : kvPutProducts(env, kvKey, body, { expirationTtl: PRODUCTS_KV_TTL }, filters),
    ]),
  );
  return addCorsHeaders(response, source);
}

async function _refreshProductsBackground(domain, filters, version, env) {
  try {
    const storeId = await _resolveStoreId(domain, env);
    if (!storeId) return;
    const data = await _fetchProductsFromDb(storeId, filters, PRODUCTS_DB_TIMEOUT_MS);
    const body = JSON.stringify(data || []);
    const cacheKey = _buildProductsCacheKey(domain, filters, version);
    const kvKey = _buildProductsKvKey(domain, filters, version);
    await Promise.all([
      cache
        .put(
          cacheKey,
          new Response(body, {
            headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${PRODUCTS_CACHE_TTL}` },
          }),
        )
        .catch(() => {}),
      kvPutProducts(env, kvKey, body, { expirationTtl: PRODUCTS_KV_TTL }, filters), // v8.19.0 C
    ]);
  } catch {}
}

async function _fallbackProducts(domain, filters, version, env) {
  const cacheKey = _buildProductsCacheKey(domain, filters, version);
  const kvKey = _buildProductsKvKey(domain, filters, version);

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

  return addCorsHeaders(
    new Response("[]", { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }),
    "fallback-empty",
  );
}

async function handlePurgeProducts(request, url, ctx, env) {
  const domain = (request.headers.get("host") || url.hostname)
    .replace(/^www\./, "")
    .toLowerCase()
    .trim();
  // Version-based purge: just bump the version — all old keys become unreachable
  await _bumpProductVersion(domain, env);
  _clearInflightProductRequestsForDomain(domain);

  return addCorsHeaders(
    new Response(JSON.stringify({ purged: true, domain }), { headers: { "Content-Type": "application/json" } }),
    "purge",
  );
}

async function handlePurgeStore(request, url, ctx, env, hostname) {
  const normalizedHost = (request.headers.get("host") || hostname || url.hostname)
    .replace(/^www\./, "")
    .toLowerCase()
    .trim();

  let purgeSlug = url.searchParams.get("slug") || "";
  if (!purgeSlug && normalizedHost.endsWith(`.${ROOT_DOMAIN}`))
    purgeSlug = normalizedHost.replace(`.${ROOT_DOMAIN}`, "");
  if (!purgeSlug && normalizedHost !== ROOT_DOMAIN && !normalizedHost.endsWith(`.${ROOT_DOMAIN}`)) {
    purgeSlug = (await resolveDomain(normalizedHost, env)) || "";
  }

  let customDomain = purgeSlug ? await getCustomDomainForSlug(purgeSlug) : null;
  if (customDomain)
    customDomain = customDomain
      .replace(/^www\./, "")
      .toLowerCase()
      .trim();
  const explicitDomain = (url.searchParams.get("domain") || "")
    .replace(/^www\./, "")
    .toLowerCase()
    .trim();

  const domainsToPurge = new Set([normalizedHost]);
  if (purgeSlug) domainsToPurge.add(`${purgeSlug}.${ROOT_DOMAIN}`);
  if (customDomain) domainsToPurge.add(customDomain);
  if (explicitDomain) domainsToPurge.add(explicitDomain);
  if (explicitDomain) domainsToPurge.add(`www.${explicitDomain}`);

  // Clear in-memory caches
  if (purgeSlug) {
    _memThemeCache.delete(purgeSlug);
    _memStorefrontCache.delete(purgeSlug);
    _storeInfoCache.delete(purgeSlug);
  }
  for (const d of domainsToPurge) {
    _memProductVersion.delete(d);
  }

  const purgeOps = [];
  for (const d of domainsToPurge) {
    domainStoreIdCache.delete(d);
    _clearInflightProductRequestsForDomain(d);
    // v8.1.0: also clear write-dedup so the next prewarm/save can re-write KV
    _kvWriteRecent.delete(`store-id:${d}`);
    _kvWriteRecent.delete(`domain:${d}`);
    purgeOps.push(cache.delete(getEarlyCacheKey(d)).catch(() => {}));
    // v8.6.2: purge CF Cache API mirror entries for SPA paths that may carry store/payment data.
    for (const path of STOREFRONT_HTML_MIRROR_PATHS) {
      purgeOps.push(cache.delete(new Request(`https://${d}${path}`)).catch(() => {}));
      purgeOps.push(cache.delete(new Request(`https://www.${d}${path}`)).catch(() => {}));
    }
    purgeOps.push(cache.delete(new Request(`https://cache/store-id:${d}`)).catch(() => {}));
    if (env?.STORE_KV) purgeOps.push(kvDeleteDedup(env, `store-id:${d}`));
    if (d !== ROOT_DOMAIN && !d.endsWith(`.${ROOT_DOMAIN}`)) {
      purgeOps.push(cache.delete(new Request(`https://cache/domain-${d}`)).catch(() => {}));
      if (env?.STORE_KV) purgeOps.push(kvDeleteDedup(env, `domain:${d}`));
    }
  }

  if (purgeSlug) {
    // v8.1.0: clear write-dedup for slug-keyed entries
    _kvWriteRecent.delete(`storefront:${purgeSlug}`);
    _kvWriteRecent.delete(`theme-lite:${purgeSlug}`);
    _kvWriteRecent.delete(`store-info:${purgeSlug}`);
    // v8.18.0: also clear warm-lock dedup + in-memory marker so the next
    // visitor re-warms the full HTML cache immediately (otherwise TTFB stays
    // on the slower streaming path for up to 5 min after a dashboard save).
    _kvWriteRecent.delete(`warm-lock:${purgeSlug}`);
    _memWarmLock.delete(purgeSlug);
    revalCooldowns.delete(`warm-html:${purgeSlug}`);
    for (const d of domainsToPurge) revalCooldowns.delete(`html:${d}`);
    purgeOps.push(cache.delete(new Request(`https://cache/storefront-data/${purgeSlug}`)).catch(() => {}));
    purgeOps.push(cache.delete(new Request(`https://cache/theme-lite:${purgeSlug}`)).catch(() => {}));
    purgeOps.push(cache.delete(new Request(`https://cache/store-info:${purgeSlug}`)).catch(() => {}));
    purgeOps.push(cache.delete(new Request(`https://cache/slug-domain-${purgeSlug}`)).catch(() => {}));
    if (env?.STORE_KV) {
      purgeOps.push(kvDeleteForce(env, `storefront:${purgeSlug}`));
      purgeOps.push(kvDeleteDedup(env, `theme-lite:${purgeSlug}`));
      purgeOps.push(kvDeleteDedup(env, `store-info:${purgeSlug}`));
      purgeOps.push(kvDeleteForce(env, `warm-lock:${purgeSlug}`));
      // v8.27.0: purge all html:<slug>:* KV entries (best-effort list+delete).
      purgeOps.push(
        (async () => {
          try {
            const list = await env.STORE_KV.list({ prefix: `html:${purgeSlug}` });
            await Promise.all((list?.keys || []).map((k) => kvDeleteForce(env, k.name)));
            // also clear per-isolate write-dedup so next visitor re-writes KV
            for (const k of Array.from(_htmlKvWriteRecent.keys())) {
              if (k.startsWith(`html:${purgeSlug}`)) _htmlKvWriteRecent.delete(k);
            }
          } catch {}
        })(),
      );
    }
  }

  await Promise.all(purgeOps);

  // Purge ALL product caches (paginated + category) for every domain variant
  const storeId = purgeSlug
    ? (await _resolveStoreInfo(purgeSlug, `${purgeSlug}.${ROOT_DOMAIN}`, env)).storeId
    : await _resolveStoreId(normalizedHost, env);

  // Version-based purge: bump version for all domain variants
  await Promise.all([...domainsToPurge].map((d) => _purgeProductCachesForDomain(d, storeId, env)));

  return addCorsHeaders(
    new Response(
      JSON.stringify({
        purged: true,
        slug: purgeSlug || null,
        domains: [...domainsToPurge],
        workerVersion: WORKER_VERSION,
      }),
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

async function handleSeoFiles(url, slug, hostname) {
  const domain = hostname || url.hostname;

  // v8.31.0 cost-cut: edge-cache sitemap/robots/llms responses per hostname
  // for 24h. These are tiny static text files that change at most when the
  // merchant adds a new product; cutting the seo-page edge fn from ~8/hr
  // to ~1/day per host (a >95% reduction) saves Supabase invocations with
  // zero SEO impact (Googlebot honors `Cache-Control: public, max-age`).
  const SEO_FILE_TTL = 86400; // 24h
  async function serveSeoFile(pathKey, type, contentType) {
    const cacheKey = new Request(`https://seo-cache/${pathKey}/${encodeURIComponent(domain)}`, { method: "GET" });
    const cached = await cache.match(cacheKey);
    if (cached) {
      const r = new Response(cached.body, cached);
      r.headers.set("X-Seo-Cache", "HIT");
      return r;
    }
    const res = await callEdgeFunction("seo-page", { type, slug, domain });
    if (res.status === 301 || res.status === 302) return res; // never cache redirects
    if (!res.ok) return null;
    const body = await res.text();
    const finalRes = new Response(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": `public, max-age=${SEO_FILE_TTL}, stale-while-revalidate=604800`,
        "X-Seo-Cache": "MISS",
        ...SECURITY_HEADERS,
      },
    });
    try {
      await cache.put(cacheKey, finalRes.clone());
    } catch {}
    return finalRes;
  }

  if (url.pathname === "/sitemap.xml") {
    return await serveSeoFile("sitemap", "sitemap", "application/xml");
  }
  if (url.pathname === "/robots.txt") {
    return await serveSeoFile("robots", "robots", "text/plain");
  }
  if (url.pathname === "/llms.txt") {
    return await serveSeoFile("llms", "llms", "text/plain; charset=utf-8");
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

  // v7.4.0 LEAK FIX #4: Per-IP throttle for ALL bots (incl. Googlebot/
  // facebookexternalhit/WhatsApp). Previously only "aggressive" bots were
  // rate-limited; allowed bots crawled product URLs unrestricted, generating
  // ~10k req/day. 30 req/min ceiling lets SEO + social previews work but
  // caps abuse. Cached HTML still served from edge → SEO unaffected.
  if (isRateLimited(`anybot:${botIp}`, 30)) {
    return new Response("Rate limited", {
      status: 429,
      headers: { "Retry-After": "60", "Cache-Control": "no-store" },
    });
  }

  const hostname = request.headers.get("host") || url.hostname;
  const isSearchBot = SEARCH_BOT_REGEX.test(ua);
  const isSocialBot = SOCIAL_BOT_REGEX.test(ua) || INSTAGRAM_CRAWLER_REGEX.test(ua);
  const productSlug = getProductSlug(url.pathname);
  // v8.16 — Richer route kinds (category/page/shop/best-sellers/categories/about/contact/track-order).
  const botRoute = getBotRoute(url.pathname) || { kind: "home" };

  // PHASE 1 FIX #3: Bot HTML cached aggressively at the edge.
  // Bots re-crawl periodically anyway. 24h cache + 7d SWR = ~95% fewer
  // bot-render edge function invocations + zero DB hits for repeat bot crawls.
  if (isSearchBot) {
    const domain = isCustom ? hostname : null;
    const botCacheKey = new Request(`https://bot-cache/search/${encodeURIComponent(hostname)}${url.pathname}`, {
      method: "GET",
    });
    const botCached = await cache.match(botCacheKey);
    if (botCached) {
      const r = new Response(botCached.body, botCached);
      r.headers.set("X-Bot-Cache", "HIT");
      return r;
    }
    const botRenderRes = await callEdgeFunction("bot-render", {
      slug,
      product: productSlug || "",
      domain: domain || "",
      kind: botRoute.kind,
      route_slug: botRoute.slug || "",
    });
    if (botRenderRes.ok) {
      const html = await botRenderRes.text();
      const finalRes = new Response(html, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
          "X-Bot-Cache": "MISS",
          ...SECURITY_HEADERS,
        },
      });
      // Cache at edge for 24h (only the response body + headers; cache.put handles TTL)
      try {
        await cache.put(botCacheKey, finalRes.clone());
      } catch {}
      return finalRes;
    }
    return null;
  }

  if (isSocialBot) {
    const domain = isCustom ? hostname : null;
    const socialCacheKey = new Request(`https://bot-cache/social/${encodeURIComponent(hostname)}${url.pathname}`, {
      method: "GET",
    });
    const socialCached = await cache.match(socialCacheKey);
    if (socialCached) {
      const r = new Response(socialCached.body, socialCached);
      r.headers.set("X-Bot-Cache", "HIT");
      return r;
    }
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
        const finalRes = new Response(buildOgHtml(og, finalUrl), {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
            "X-Bot-Cache": "MISS",
            ...SECURITY_HEADERS,
          },
        });
        try {
          await cache.put(socialCacheKey, finalRes.clone());
        } catch {}
        return finalRes;
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
  const explicitDomain = (url.searchParams.get("domain") || "")
    .replace(/^www\./, "")
    .toLowerCase()
    .trim();

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
    if (explicitDomain) domainStoreIdCache.delete(explicitDomain);
  }

  const purgeOps = [
    cache.delete(new Request("https://cache/spa-shell")).catch(() => {}),
    cache.delete(new Request("https://cache/prebuilt-head")).catch(() => {}),
  ];

  // v8.1.0: clear write-dedup so the next save can re-write KV
  _kvWriteRecent.delete(SPA_SHELL_KV_KEY);
  _kvWriteRecent.delete(PREBUILT_HEAD_KV_KEY);
  if (env?.STORE_KV) {
    purgeOps.push(kvDeleteForce(env, SPA_SHELL_KV_KEY));
    purgeOps.push(kvDeleteForce(env, PREBUILT_HEAD_KV_KEY));
  }

  if (purgeSlug) {
    _kvWriteRecent.delete(`storefront:${purgeSlug}`);
    _kvWriteRecent.delete(`theme-lite:${purgeSlug}`);
    _kvWriteRecent.delete(`store-info:${purgeSlug}`);
    _kvWriteRecent.delete(`warm-lock:${purgeSlug}`); // v8.18.0
    _memWarmLock.delete(purgeSlug); // v8.18.0
    revalCooldowns.delete(`warm-html:${purgeSlug}`);
    revalCooldowns.delete(`html:${hostname}`);
    if (explicitDomain) {
      revalCooldowns.delete(`html:${explicitDomain}`);
      revalCooldowns.delete(`html:www.${explicitDomain}`);
    }
    purgeOps.push(cache.delete(getEarlyCacheKey(`${purgeSlug}.${ROOT_DOMAIN}`)).catch(() => {}));
    purgeOps.push(cache.delete(getEarlyCacheKey(hostname)).catch(() => {}));
    if (explicitDomain) {
      purgeOps.push(cache.delete(getEarlyCacheKey(explicitDomain)).catch(() => {}));
      purgeOps.push(cache.delete(getEarlyCacheKey(`www.${explicitDomain}`)).catch(() => {}));
    }
    // v8.6.2: purge CF Cache API mirrors for all SPA paths that can inline stale store/payment data.
    for (const path of STOREFRONT_HTML_MIRROR_PATHS) {
      purgeOps.push(cache.delete(new Request(`https://${purgeSlug}.${ROOT_DOMAIN}${path}`)).catch(() => {}));
      purgeOps.push(cache.delete(new Request(`https://${hostname}${path}`)).catch(() => {}));
      if (explicitDomain) {
        purgeOps.push(cache.delete(new Request(`https://${explicitDomain}${path}`)).catch(() => {}));
        purgeOps.push(cache.delete(new Request(`https://www.${explicitDomain}${path}`)).catch(() => {}));
      }
    }
    purgeOps.push(cache.delete(new Request(`https://cache/storefront-data/${purgeSlug}`)).catch(() => {}));
    purgeOps.push(cache.delete(new Request(`https://cache/theme-lite:${purgeSlug}`)).catch(() => {}));
    purgeOps.push(cache.delete(new Request(`https://cache/store-info:${purgeSlug}`)).catch(() => {}));

    if (env?.STORE_KV) {
      purgeOps.push(kvDeleteForce(env, `storefront:${purgeSlug}`));
      purgeOps.push(kvDeleteDedup(env, `theme-lite:${purgeSlug}`));
      purgeOps.push(kvDeleteDedup(env, `store-info:${purgeSlug}`));
      purgeOps.push(kvDeleteForce(env, `warm-lock:${purgeSlug}`)); // v8.18.0
      // v8.27.0: purge html:<slug>:* entries
      purgeOps.push(
        (async () => {
          try {
            const list = await env.STORE_KV.list({ prefix: `html:${purgeSlug}` });
            await Promise.all((list?.keys || []).map((k) => kvDeleteForce(env, k.name)));
            for (const k of Array.from(_htmlKvWriteRecent.keys())) {
              if (k.startsWith(`html:${purgeSlug}`)) _htmlKvWriteRecent.delete(k);
            }
          } catch {}
        })(),
      );
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
          ? kvPutDedup(env, PREBUILT_HEAD_KV_KEY, built, { expirationTtl: PREBUILT_HEAD_KV_TTL })
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
        writes.push(kvPutDedup(env, `domain:${cleanDomain}`, cacheData, { expirationTtl: KV_DOMAIN_TTL }));
      await Promise.all(writes);
      results.domainMapping = "warmed";
    }

    const subDomain = `${slug}.${ROOT_DOMAIN}`;
    let storeId = null;

    // Purge negative caches before re-fetching
    const infoCacheKey = new Request(`https://cache/store-info:${slug}`);
    const storefrontDataCacheKey = new Request(`https://cache/storefront-data/${slug}`);
    await cache.delete(infoCacheKey).catch(() => {});
    await cache.delete(storefrontDataCacheKey).catch(() => {});
    _storeInfoCache.delete(slug);
    _memStorefrontCache.delete(slug);
    _memThemeCache.delete(slug);
    domainStoreIdCache.delete(subDomain);
    if (env?.STORE_KV) {
      await kvDeleteDedup(env, `store-info:${slug}`);
      await kvDeleteForce(env, `storefront:${slug}`);
    }

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
      if (env?.STORE_KV) idWrites.push(kvPutDedup(env, `store-id:${subDomain}`, storeIdStr, { expirationTtl: 86400 }));
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
          idWrites.push(kvPutDedup(env, `store-id:${cleanDomain}`, storeIdStr, { expirationTtl: 86400 }));
      }
      await Promise.all(idWrites);
    }

    if (storeId) {
      try {
        const products = await _fetchProductsFromDb(storeId, {}, PRODUCTS_DB_TIMEOUT_MS);
        const prodBody = JSON.stringify(products || []);
        const cacheOps = [];
        const subVersion = await _getProductVersion(subDomain, env);
        const subCacheKey = _buildProductsCacheKey(subDomain, {}, subVersion);
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
            kvPutDedup(env, _buildProductsKvKey(subDomain, {}, subVersion), prodBody, {
              expirationTtl: PRODUCTS_KV_TTL,
            }),
          );
        if (domain) {
          const cleanDomain = domain
            .replace(/^www\./, "")
            .toLowerCase()
            .trim();
          const cdVersion = await _getProductVersion(cleanDomain, env);
          cacheOps.push(
            cache
              .put(
                _buildProductsCacheKey(cleanDomain, {}, cdVersion),
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
              kvPutDedup(env, _buildProductsKvKey(cleanDomain, {}, cdVersion), prodBody, {
                expirationTtl: PRODUCTS_KV_TTL,
              }),
            );
        }
        await Promise.all(cacheOps);
        results.products = "warmed";
      } catch {
        results.products = "failed";
      }
    }

    // FIX #10: Raised to 3600/7200
    if (shellResult?.html && dataResult.data) {
      const injected = injectIntoHtml(shellResult.html, slug, dataResult.data, "prewarm");
      const htmlResponse = new Response(injected.html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
          ETag: `W/"${slug}-prewarm-${Date.now().toString(36)}"`,
          "X-Store-Slug": slug,
          "X-Data-Source": "prewarm",
          "X-Shell-Source": shellResult.source,
          ...SECURITY_HEADERS,
        },
      });

      const htmlHosts = new Set([`${slug}.${ROOT_DOMAIN}`]);
      if (domain) {
        const cleanDomain = domain
          .replace(/^www\./, "")
          .toLowerCase()
          .trim();
        if (cleanDomain) {
          htmlHosts.add(cleanDomain);
          htmlHosts.add(`www.${cleanDomain}`);
        }
      }

      const htmlWrites = [];
      for (const h of htmlHosts) {
        htmlWrites.push(cache.put(getEarlyCacheKey(h), htmlResponse.clone()).catch(() => {}));
        htmlWrites.push(cache.put(getCfCacheKey(h, "/"), htmlResponse.clone()).catch(() => {}));
      }
      const canonical = getCanonicalHtmlCacheKey(slug, "/");
      if (canonical) htmlWrites.push(cache.put(canonical, htmlResponse.clone()).catch(() => {}));
      if (env?.STORE_KV) {
        const htmlKvKey = getHtmlKvKey(slug, "/");
        if (htmlKvKey) {
          _htmlKvWriteRecent.delete(htmlKvKey);
          htmlWrites.push(
            env.STORE_KV.put(htmlKvKey, injected.html, {
              expirationTtl: HTML_KV_TTL_SEC,
              metadata: { s: 200, h: { "Content-Type": "text/html; charset=utf-8" } },
            }).catch(() => {}),
          );
        }
      }
      await Promise.all(htmlWrites);

      results.fullHtml = "warmed";
    } else {
      results.fullHtml = "skipped";
    }

    // v8.13.1 cost-cut: removed all-active-slugs append-write here.
    // Cron rebuilds the full list every 60min from DB; consumers
    // (`_getSlugIndex`) are fire-and-forget and never gate request handling,
    // so a 60-min staleness window for brand-new stores is harmless.
    if (env?.STORE_KV && _slugIndexSet) {
      // Keep in-memory set fresh for this isolate so subsequent reads see the slug.
      _slugIndexSet.add(slug);
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
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Store Not Found</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fafafa;color:#333}.c{text-align:center;padding:2rem}.c h1{font-size:1.5rem;font-weight:600;margin-bottom:8px}.c p{color:#666;margin-bottom:20px;font-size:0.95rem;line-height:1.55}.a{display:inline-block;padding:10px 24px;background:#4361ee;color:#fff;border-radius:8px;text-decoration:none;font-weight:500;font-size:0.9rem;transition:background .2s}.a:hover{background:#3651d4}.s{color:#999;font-size:0.8rem}</style></head><body><div class="c"><h1>Store Not Found</h1><p>No store exists at <strong>${safeSlug}.${rootDomain}</strong></p><a class="a" href="https://${rootDomain}">Create Your Store</a><p class="s">If the store was just created, refresh manually later.</p></div></body></html>`;
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

  // v7.7.0 Fix 3: removed double cache.put for slug responses.
  // _warmFullHtmlInBackground (called from fetchAndInjectSlug) is now the
  // single source of truth for HTML cache writes — it stores the FULLY
  // injected version. Previously this block stored the streaming version
  // (no inline data) which then got overwritten or, worse, occasionally
  // raced to overwrite the better version.
  // Root-domain (no slug) responses still get cached here.
  const contentType = res.headers.get("content-type") || "";
  if (res.status === 200 && contentType.includes("text/html") && !slug) {
    // v8.23.0: For landing routes (root domain), inject modulepreloads
    // for framework + landing-shell + entry-utils chunks so the browser
    // discovers them in parallel instead of via a 4-step JS waterfall.
    const landingUrl = new URL(request.url);
    if (isLandingPath(landingUrl.pathname)) {
      try {
        const origHtml = await res.text();
        let enriched = origHtml;
        try {
          enriched = await injectLandingModulepreloads(origHtml, landingUrl.origin, env);
        } catch {
          enriched = origHtml;
        }
        res = new Response(enriched, {
          status: 200,
          headers: res.headers,
        });
      } catch {
        // Could not read body — leave res as-is.
      }
    }
    res = makePublicHtmlResponse(res, 3600);
    storeInEdgeCache(ctx, hostname, "", res, request, env);
  }

  return addDiagnosticHeaders(res, { slug, cacheStatus: "MISS", dataSource });
}

/* ============================================================
   MAIN FETCH HANDLER
   ============================================================ */

export default {
  async fetch(request, env, ctx) {
    const _res = await _handleFetch(request, env, ctx);
    return finalizeResponse(request, _res);
  },
  async scheduled(event, env, ctx) {
    return _handleScheduled(event, env, ctx);
  },
};

async function _handleFetch(request, env, ctx) {
  // FIX #5: Record request start time immediately
  const requestStart = Date.now();

  const earlyUA = request.headers.get("user-agent") || "";
  const earlyUrl = new URL(request.url);
  const earlyPath = earlyUrl.pathname;
  const earlyMethod = request.method;

  /* ──────────────────────────────────────────────────────────
       ACME / domain-verification short-circuit
       ──────────────────────────────────────────────────────────
       Lovable's domain-health probe + Let's Encrypt HTTP-01 challenges
       both hit /.well-known/acme-challenge/*. Return 200 OK instantly
       without invoking router / KV / origin fetch. Saves ~3k CPU
       cycles/day on a 1-store platform; scales linearly with tenant count. */
  if (earlyPath.startsWith("/.well-known/acme-challenge/")) {
    return new Response("ok", {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "public, max-age=300",
      },
    });
  }

  /* ──────────────────────────────────────────────────────────
       v8.3.0: EARLY EDGE-CACHE LOOKUP FOR SYNTHESIZED RESPONSES
       ──────────────────────────────────────────────────────────
       Redirects (3xx), attack-path 410s, bot 403s, 405s, favicon 204s,
       unknown-domain 404s — all previously invoked the Worker on every
       request because Worker-generated responses don't auto-populate
       caches.default. We now check the edge cache FIRST (sub-ms lookup)
       and short-circuit if present. This is what flipped the dashboard
       cache rate from 42% → 95%+. Only GET requests are checked. */
  if (earlyMethod === "GET") {
    try {
      // v8.24.0: Previously HTML nav paths bypassed this lookup entirely,
      // which meant every storefront hit ran full Worker compute (~290ms
      // TTFB) even when mirrorToCfCache had a perfect copy stored under
      // the same URL. Now: for anonymous HTML nav (no auth cookie, not
      // checkout/dashboard/admin) we DO check the URL mirror — that's
      // the load-bearing fix that turns repeat visits into ~30ms HITs.
      const cookie = request.headers.get("cookie") || "";
      const isAuthed = /(?:^|;\s*)(?:sb-|.*auth)/i.test(cookie);
      const isPrivatePath =
        earlyPath.startsWith("/checkout") ||
        earlyPath.startsWith("/dashboard") ||
        earlyPath.startsWith("/admin") ||
        earlyPath.startsWith("/api/");
      const isHtmlNav = isHtmlNavigationPath(earlyPath);
      // For HTML nav: allow lookup ONLY if anonymous + non-private.
      // For non-HTML (assets, robots, etc.): always allow.
      const shouldCheckMirror = !isHtmlNav || (!isAuthed && !isPrivatePath);
      let cached = null;
      let hitKey = null;
      let slugForKey = null;
      if (shouldCheckMirror) {
        // v8.25.1: for anonymous HTML navs, look up the REAL-HOST key first
        // (matches what mirrorToCfCache writes via getCfCacheKey). Falls
        // back to raw request for synthesized responses (redirects, 410s,
        // 404s, assets) which already use raw request as their key.
        if (isHtmlNav && !isAuthed && !isPrivatePath) {
          const cfKey = getCfCacheKey(earlyUrl.hostname, earlyPath);
          cached = await cache.match(cfKey);
          if (cached) hitKey = "real-host";
          // v8.25.2: canonical zone-key fallback. Custom domains live outside
          // the Worker zone; their real-host write occasionally lands in a
          // colo that won't serve it back. The slug-subdomain key is always
          // inside the zone, so this is the reliable cache for ad traffic.
          if (!cached) {
            slugForKey = await _earlyResolveSlug(earlyUrl.hostname, env);
            if (slugForKey) {
              const canonical = getCanonicalHtmlCacheKey(slugForKey, earlyPath);
              if (canonical) {
                cached = await cache.match(canonical);
                if (cached) hitKey = "canonical-slug";
              }
            }
          }
          // v8.27.0: KV-backed HTML cache. Global, cross-colo HIT-EARLY.
          // caches.default is colo-local; KV replicates to all 300+ colos.
          // First visitor in any colo (after the URL was warmed elsewhere)
          // gets a sub-15ms response from KV instead of running the full
          // pipeline. Safe: 60s TTL, anonymous-only, non-private only.
          if (!cached && env?.STORE_KV) {
            if (!slugForKey) slugForKey = await _earlyResolveSlug(earlyUrl.hostname, env);
            if (slugForKey) {
              const kvHit = await kvHtmlGet(env, slugForKey, earlyPath);
              if (kvHit) {
                cached = kvHit;
                hitKey = "kv-html";
              }
            }
          }
        }
        if (!cached) {
          cached = await cache.match(request);
          if (cached && !hitKey) hitKey = "raw-request";
        }
      }
      if (cached) {
        if (cached.status === 403 && cached.headers.get("x-blocked-by") === "shopbanao-bot-policy") {
          ctx.waitUntil(cache.delete(request).catch(() => {}));
        } else {
          const hit = new Response(cached.body, cached);
          hit.headers.set("X-Edge-Cache", "HIT-EARLY");
          hit.headers.set("cf-cache-status", "HIT");
          if (hitKey) hit.headers.set("X-Edge-Key", hitKey);
          // v8.44.0: record pageview on the HIT-EARLY path too. Without this,
          // ~95% of real visits (cache HITs) were never written to page_views,
          // leaving the analytics dashboard at zero Sessions/Conversion.
          if (isHtmlNav && !isAuthed && !isPrivatePath) {
            ctx.waitUntil(
              (async () => {
                try {
                  let slug = slugForKey || (await _earlyResolveSlug(earlyUrl.hostname, env));
                  const info = slug ? await _resolveStoreInfo(slug, earlyUrl.hostname, env) : null;
                  await recordPageView(env, request, info?.storeId, earlyPath);
                } catch {}
              })(),
            );
          }
          return hit;
        }
      }
    } catch {}
  }

  // v6.9.4: Reject unsupported methods immediately. Stops scanners hammering
  // PUT/DELETE/PATCH/CONNECT/TRACE on every path with a single cheap response.
  if (earlyMethod !== "GET" && earlyMethod !== "POST" && earlyMethod !== "HEAD" && earlyMethod !== "OPTIONS") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { "cache-control": "public, max-age=86400", allow: "GET, POST, HEAD, OPTIONS" },
    });
  }

  // v6.9.4: Short-circuit common attack/probe paths (wp-admin, .env, .git, etc.)
  if (ATTACK_PATH_REGEX.test(earlyPath)) {
    const r = new Response("Gone", {
      status: 410,
      headers: {
        "content-type": "text/plain",
        "cache-control": "public, max-age=2592000, immutable",
        "x-blocked-by": "shopbanao-attack-filter",
      },
    });
    return cacheableResponse(ctx, request, r, 2592000);
  }

  // v6.9.4: Favicon / apple-touch-icon polling — 204 cached for 30 days.
  if (
    earlyPath === "/favicon.ico" ||
    earlyPath === "/apple-touch-icon.png" ||
    earlyPath === "/apple-touch-icon-precomposed.png" ||
    earlyPath === "/browserconfig.xml" ||
    earlyPath === "/crossdomain.xml"
  ) {
    const r = new Response(null, {
      status: 204,
      headers: {
        "cache-control": "public, max-age=2592000, immutable",
        "x-served-by": "edge-204",
      },
    });
    return cacheableResponse(ctx, request, r, 2592000);
  }

  // v6.9.4 / v8.6.5: Block only known bad crawler UAs. Do NOT block empty
  // or short UAs because some mobile apps, proxies, and ISP browsers strip
  // User-Agent and were incorrectly seeing Forbidden.
  if (BLOCKED_BOT_REGEX.test(earlyUA)) {
    return new Response("Forbidden", {
      status: 403,
      headers: {
        "content-type": "text/plain",
        "cache-control": "private, no-store",
        "x-blocked-by": "shopbanao-bot-policy",
      },
    });
  }

  // v8.1.0 cost-cut: ANY bot request (HTML or API) suppresses KV writes.
  // Bots don't benefit from KV warming for human visitors and they generate
  // huge tail-traffic. Previously only storefront HTML routes set the flag —
  // now all bot traffic skips the warm/lock/KV cascade.
  const earlyIsBot = BOT_UA_REGEX.test(earlyUA);
  if (earlyIsBot) {
    ctx.__skipKvWarm = true;
    const earlyIsStorefrontHtml =
      earlyMethod === "GET" &&
      (earlyPath === "/" || /^\/[a-zA-Z0-9_-]+\/?$/.test(earlyPath)) &&
      !earlyPath.startsWith("/api/") &&
      !earlyPath.startsWith("/cf-img") &&
      !earlyPath.includes(".");
    if (earlyIsStorefrontHtml) {
      try {
        const earlyHostname = earlyUrl.hostname.toLowerCase().replace(/^www\./, "");
        const cached = await cache.match(getEarlyCacheKey(earlyHostname, earlyPath));
        if (cached) return cached;
      } catch {}
    }
  }

  // v6.9.4: OPTIONS preflight short-circuit — never needs origin or pipeline.
  if (earlyMethod === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": request.headers.get("origin") || "*",
        "access-control-allow-methods": "GET, POST, HEAD, OPTIONS",
        "access-control-allow-headers": request.headers.get("access-control-request-headers") || "*",
        "access-control-max-age": "86400",
        "cache-control": "public, max-age=86400",
      },
    });
  }

  const url = new URL(request.url);
  const hostname = (request.headers.get("host") || url.hostname).toLowerCase().trim();

  // R2 custom domain lives under shopbanao.in too, but it must NOT be treated
  // as a storefront subdomain. If the wildcard Worker route catches it,
  // pass through to the R2 custom-domain origin instead of returning
  // "Store Not Found" for slug "cdn".
  if (hostname === R2_CDN_HOST) {
    return fetch(request);
  }

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

  // ─── v6.6.0: STOREFRONT DATA-ONLY ENDPOINT ───
  // When the cold path ships shell + Promise (no embedded data),
  // the browser fetches this endpoint to resolve __STOREFRONT_PREFETCH__.
  // No HTML, just JSON — same prefetchStorefrontData payload.
  if (url.searchParams.get("__sf_data") === "1" || request.headers.get("x-sf-data-only") === "1") {
    try {
      let dataSlug = null;
      if (hostname.endsWith(`.${ROOT_DOMAIN}`)) {
        dataSlug = hostname.replace(`.${ROOT_DOMAIN}`, "").replace(/^www\./, "");
      } else if (hostname !== ROOT_DOMAIN && !hostname.startsWith("www.")) {
        dataSlug = await resolveDomain(hostname.replace(/^www\./, ""), env);
      }
      if (dataSlug) {
        const result = await prefetchStorefrontData(dataSlug, ctx, env);
        if (result?.data) {
          return new Response(JSON.stringify(result.data), {
            status: 200,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "Cache-Control": "public, max-age=60, stale-while-revalidate=600",
              "X-Data-Source": result.source || "data-only",
              ...SECURITY_HEADERS,
            },
          });
        }
      }
      return new Response("null", { status: 404, headers: { "Content-Type": "application/json" } });
    } catch {
      return new Response("null", { status: 500, headers: { "Content-Type": "application/json" } });
    }
  }

  // ─── v8.40.0: /meta.json edge short-circuit (PWA probe, ~859 hits/day) ───
  // Origin returns 404 + Set-Cookie which bypasses cache, so every probe hits
  // the origin. Synthesize a stable empty JSON with 1-day cache here.
  if (url.pathname === "/meta.json") {
    return new Response("{}", {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
        "Access-Control-Allow-Origin": "*",
        "X-Worker-Version": WORKER_VERSION,
        "X-Static-Asset-Cache": "SYNTH",
      },
    });
  }

  // ─── STATIC ASSETS ───
  // v8.47 cost-cut: previously `no-cache, must-revalidate, max-age=0` so every
  // service-worker update-check + every PWA install hit origin (3–6k req/day).
  // These files are immutable in practice — when sw-push.js or the dynamic
  // manifest changes, the deploy invalidates them via the build hash. Cache
  // at the edge for 10 min + 24h stale-while-revalidate so background SW
  // update-checks stay HIT and the Worker stops being invoked.
  if (url.pathname === "/sw-push.js" || url.pathname === "/sw.js" || url.pathname === "/manifest.webmanifest") {
    // Try synthesized edge cache first (≈1ms hit, zero subrequests)
    try {
      const hit = await cache.match(request);
      if (hit) {
        const fresh = new Response(hit.body, hit);
        fresh.headers.set("X-Static-Asset-Cache", "HIT-PWA");
        return fresh;
      }
    } catch {}
    const freshStatic = await proxyToOrigin(request);
    const freshRes = new Response(freshStatic.body, freshStatic);
    freshRes.headers.set("Cache-Control", "public, max-age=600, stale-while-revalidate=86400");
    freshRes.headers.delete("Set-Cookie");
    freshRes.headers.delete("set-cookie");
    freshRes.headers.set("X-Static-Asset-Cache", "MISS-PWA");
    return cacheableResponse(ctx, request, freshRes, 600);
  }


  const isStaticAsset =
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/static/") ||
    url.pathname === "/registerSW.js" ||
    url.pathname === "/favicon.ico" ||
    (url.pathname.includes(".") &&
      !url.pathname.startsWith("/api") &&
      !url.pathname.startsWith("/rest") &&
      url.pathname !== "/sitemap.xml" &&
      url.pathname !== "/robots.txt" &&
      url.pathname !== "/llms.txt");

  if (isStaticAsset) {
    // v7.3.0 #3+#4: Route ALL static assets through cf.cacheEverything proxy
    // (not just /assets/* and /static/*). Icons, manifests, SW files, favicons,
    // and any extensioned file are immutable in practice — cache them at the
    // edge with 30-day TTL so repeat visitors never re-execute worker logic.
    return proxyToOriginCached(request, ctx);
  }

  // ─── PHASE 1 FIX #1: SUPABASE STORAGE IMAGE EDGE CACHE (1yr immutable) ───
  // Product images never mutate (filenames are content-hashed on upload).
  // Cache them at the edge for 1 year. Repeat visitors → 0 origin hits,
  // 0 Supabase storage egress, instant load.
  if (
    url.pathname.startsWith("/storage/v1/object/public/product-images/") ||
    url.pathname.startsWith("/storage/v1/object/public/store-logos/") ||
    url.pathname.startsWith("/storage/v1/object/public/store-banners/")
  ) {
    const imgCacheKey = new Request(`https://sb-img-cache${url.pathname}${url.search}`, { method: "GET" });
    const imgCached = await cache.match(imgCacheKey);
    if (imgCached) {
      const r = new Response(imgCached.body, imgCached);
      r.headers.set("X-SB-Img-Cache", "HIT");
      return r;
    }
    try {
      const sbRes = await fetch(`${SUPABASE_URL}${url.pathname}${url.search}`, {
        cf: { cacheEverything: true, cacheTtl: 31536000 },
      });
      if (!sbRes.ok) return sbRes;
      const headers = new Headers(sbRes.headers);
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
      headers.set("X-SB-Img-Cache", "MISS");
      headers.set("Access-Control-Allow-Origin", "*");
      const finalRes = new Response(sbRes.body, { status: 200, headers });
      ctx.waitUntil(cache.put(imgCacheKey, finalRes.clone()));
      return finalRes;
    } catch {
      return fetch(`${SUPABASE_URL}${url.pathname}${url.search}`);
    }
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
    url.pathname !== "/cf-img" &&
    url.pathname !== "/sitemap.xml" &&
    url.pathname !== "/robots.txt" &&
    url.pathname !== "/llms.txt" &&
    url.pathname !== "/__health" &&
    !request.headers.get("cookie")?.includes("auth");

  const ua = request.headers.get("User-Agent") || "";
  const isBot = BOT_UA_REGEX.test(ua);

  if (isCacheableRequest && !isBot && request.headers.get("x-sf-allow-html-cache") === "1") {
    const earlyKey = getEarlyCacheKey(hostname, url.pathname);
    const earlyHit = await cache.match(earlyKey);

    if (earlyHit) {
      const cachedSlug = earlyHit.headers.get("X-Store-Slug") || "";
      const cachedDataSource = earlyHit.headers.get("X-Data-Source") || "edge";

      // v7.3.0 #5: ETag / If-None-Match — return 304 Not Modified if the
      // client already has the same ETag. Saves ~30% bandwidth on repeat
      // visitors. Browser reuses its cached HTML; perceived load is instant.
      const cachedEtag = earlyHit.headers.get("ETag");
      const ifNoneMatch = request.headers.get("If-None-Match");
      if (cachedEtag && ifNoneMatch && ifNoneMatch === cachedEtag) {
        return new Response(null, {
          status: 304,
          headers: {
            ETag: cachedEtag,
            "Cache-Control": earlyHit.headers.get("Cache-Control") || "public, max-age=3600",
            "X-Cache-Status": "HIT-304",
            "X-Store-Slug": cachedSlug,
          },
        });
      }

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
                  getNavigationSpaShell(request, ctx, env),
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
                  // v7.3.0 #1+#2: matched bumped TTL/SWR
                  setNoStoreHtmlHeaders(fullHeaders);
                  fullHeaders.set("ETag", `W/"${revalSlug}-${Date.now().toString(36)}"`);
                  fullHeaders.set("X-Store-Slug", revalSlug);
                  fullHeaders.set("X-Data-Source", prefetchResult.source);
                  fullHeaders.set("X-Shell-Source", shellResult.source);
                  fullHeaders.set("X-Cache-Timestamp", new Date().toISOString());
                  for (const [k, v] of Object.entries(SECURITY_HEADERS)) fullHeaders.set(k, v);
                  const fullResponse = new Response(result.html, { status: 200, headers: fullHeaders });
                  storeInEdgeCache(ctx, hostname, revalSlug, fullResponse, request, env);
                }
              }
            } catch {}
          })(),
        );
      }

      // v8.44.0: record pageview on edge cache HIT too (previously only
      // MISS/cold paths recorded → ~95% of real visits were invisible to
      // Supabase analytics, so Sessions/Conversion stayed at zero).
      ctx.waitUntil(
        (async () => {
          try {
            const info = cachedSlug ? await _resolveStoreInfo(cachedSlug, hostname, env) : null;
            await recordPageView(env, request, info?.storeId, url.pathname);
          } catch {}
        })(),
      );

      return addDiagnosticHeaders(earlyHit, { slug: cachedSlug, cacheStatus: "HIT", dataSource: cachedDataSource });
    }
  }

  // ─── /fonts/* — long-cache self-hosted fonts (v8.9.2) ───
  // Origin returned default cache headers (~1h). woff2 files are
  // content-stable; serve as immutable for 1y so repeat visits skip
  // network entirely. Edge-cache via cache.match for cold visitors too.
  if (url.pathname.startsWith("/fonts/")) {
    const fontCache = caches.default;
    const fontCacheKey = new Request(url.toString(), { method: "GET" });
    let fontHit = await fontCache.match(fontCacheKey);
    if (fontHit) {
      const h = new Headers(fontHit.headers);
      h.set("X-Font-Cache", "HIT");
      return new Response(fontHit.body, { status: fontHit.status, headers: h });
    }
    const fontResp = await fetch(request);
    if (fontResp.ok) {
      const h = new Headers(fontResp.headers);
      h.set("Cache-Control", "public, max-age=31536000, immutable");
      h.set("Access-Control-Allow-Origin", "*");
      h.set("X-Font-Cache", "MISS");
      const cached = new Response(fontResp.body, { status: 200, headers: h });
      ctx.waitUntil(fontCache.put(fontCacheKey, cached.clone()));
      return cached;
    }
    return fontResp;
  }

  // ─── /cf-img — REMOVED in v8.48.0 ───
  // Route is dead code. All storefront images now go through
  // cdn.shopbanao.in (R2 direct) or Supabase render API directly
  // (see _toRenderUrl, v8.5). No frontend code references /cf-img.
  // Returning 410 Gone so any stale browser/CDN cache fails fast
  // and visibly instead of silently 404-ing through the SPA shell.
  if (url.pathname === "/cf-img") {
    return new Response("Gone: /cf-img removed in worker v8.48.0", {
      status: 410,
      headers: { "Cache-Control": "public, max-age=86400" },
    });
  }

  // ─── API ROUTES (rate-limited) ───
  if (url.pathname.startsWith("/api/")) {
    const clientIP = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
    if (isRateLimited(clientIP, true)) {
      return new Response(JSON.stringify({ error: "Rate limited" }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": "60",
          "Cache-Control": "no-store",
        },
      });
    }

    if (url.pathname === "/api/products" && request.method === "GET") return handleProductsApi(request, url, ctx, env);
    if (url.pathname === "/api/pdp" && request.method === "GET") return handlePdpApi(request, url, ctx, env);
    if (url.pathname === "/api/category" && request.method === "GET") return handleCategoryApi(request, url, ctx, env);
    if (url.pathname === "/api/purge-store" && request.method === "POST")
      return handlePurgeStore(request, url, ctx, env, hostname);
    if (url.pathname === "/api/purge-products" && request.method === "POST")
      return handlePurgeProducts(request, url, ctx, env);
    if (url.pathname === "/api/purge-shell" && (request.method === "POST" || request.method === "GET"))
      return handlePurgeShell(request, url, ctx, env, hostname);
    if (url.pathname === "/api/prewarm") {
      if (request.method === "OPTIONS") return addCorsHeaders(new Response(null, { status: 204 }), "preflight");
      if (request.method === "POST") return handlePrewarm(request, url, ctx, env);
      return addCorsHeaders(
        new Response(JSON.stringify({ error: "Method not allowed" }), {
          status: 405,
          headers: {
            "Content-Type": "application/json",
            Allow: "POST, OPTIONS",
            "Cache-Control": "no-store",
          },
        }),
        "prewarm-method",
      );
    }
    if (request.method === "OPTIONS") return addCorsHeaders(new Response(null, { status: 204 }), "preflight");
  }

  // ─── SUPABASE PROXY ───
  // v7.7.0 Fix 5: Edge-cache anonymous GETs on /rest/v1/ for 30s.
  // Skip caching for: non-GET, /functions/v1/* (POST-heavy, custom logic),
  // and any request carrying a user JWT in Authorization (auth'd reads).
  if (url.pathname.startsWith("/rest/v1/") || url.pathname.startsWith("/functions/v1/")) {
    const targetUrl = new URL(request.url);
    targetUrl.hostname = new URL(SUPABASE_URL).hostname;
    targetUrl.port = "";
    const headers = new Headers(request.headers);
    headers.set("Host", new URL(SUPABASE_URL).hostname);

    // Detect user JWT BEFORE we overwrite Authorization with the anon key.
    // A user JWT is any Authorization: Bearer that isn't our shared anon key.
    const incomingAuth = headers.get("Authorization") || "";
    const hasUserJwt = incomingAuth.startsWith("Bearer ") && incomingAuth.slice(7).trim() !== SUPABASE_ANON_KEY;

    if (!headers.has("apikey")) {
      headers.set("apikey", SUPABASE_ANON_KEY);
      headers.set("Authorization", `Bearer ${SUPABASE_ANON_KEY}`);
    }

    const isCacheable = request.method === "GET" && url.pathname.startsWith("/rest/v1/") && !hasUserJwt;

    // Try edge cache first for cacheable requests
    if (isCacheable) {
      const cacheKey = new Request(`https://__sb-proxy/${url.pathname}${url.search}`, { method: "GET" });
      try {
        const hit = await cache.match(cacheKey);
        if (hit) {
          const cachedRes = new Response(hit.body, hit);
          cachedRes.headers.set("Access-Control-Allow-Origin", "*");
          cachedRes.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
          cachedRes.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, apikey, x-client-info");
          cachedRes.headers.set("X-Sb-Proxy-Cache", "HIT");
          return cachedRes;
        }
      } catch {}
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

      // Store cacheable 200s in edge cache for 30s
      if (isCacheable && res.status === 200) {
        try {
          const cacheKey = new Request(`https://__sb-proxy/${url.pathname}${url.search}`, { method: "GET" });
          const toCache = proxyRes.clone();
          // Override Cache-Control so cache.put respects our TTL
          toCache.headers.set("Cache-Control", "public, max-age=30");
          toCache.headers.set("X-Sb-Proxy-Cache", "MISS-STORED");
          ctx.waitUntil(cache.put(cacheKey, toCache).catch(() => {}));
        } catch {}
      }

      proxyRes.headers.set("X-Sb-Proxy-Cache", isCacheable ? "MISS" : "BYPASS");
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
      const target = customDomain
        ? `https://${customDomain}${remainingPath}${url.search}`
        : `https://${redirectSlug}.${ROOT_DOMAIN}${remainingPath}${url.search}`;
      // v8.3.0: cacheable 301 (1 day) so repeat hits skip the Worker.
      const r = new Response(null, {
        status: 301,
        headers: { Location: target, "Cache-Control": "public, max-age=86400" },
      });
      return cacheableResponse(ctx, request, r, 86400);
    }
    if (hostname === `www.${ROOT_DOMAIN}`) {
      const target = `https://${ROOT_DOMAIN}${url.pathname}${url.search}`;
      const r = new Response(null, {
        status: 301,
        headers: { Location: target, "Cache-Control": "public, max-age=86400" },
      });
      return cacheableResponse(ctx, request, r, 86400);
    }
    return cachedFetch(request, "", ctx, false, env, requestStart);
  }

  // ─── SUBDOMAIN ───
  if (hostname.endsWith(`.${ROOT_DOMAIN}`)) {
    const slug = hostname.replace(`.${ROOT_DOMAIN}`, "");
    if (!slug || slug.includes(".") || slug === "www") return cachedFetch(request, "", ctx, false, env, requestStart);

    // FIX #23: Fire-and-forget — was blocking critical path for no reason
    _getSlugIndex(env).catch(() => {});

    // v8.12.1 BUGFIX: Cold-isolate path was serving the storefront on the
    // subdomain even when the store had a custom_domain configured —
    // bypassing the canonical 301 and splitting Meta Pixel attribution
    // (Pixel fired on *.shopbanao.in, CAPI's event_source_url pointed at
    // the custom domain → EMQ mismatch). Resolve store info FIRST so the
    // 301 happens regardless of isolate warmth. Cheap: hits in-memory /
    // Cache API / KV cascade and is fire-and-forget cached for 30 min.
    {
      const earlyStoreInfo = await _resolveStoreInfo(slug, hostname, env).catch(() => null);
      if (earlyStoreInfo && !earlyStoreInfo.storeId) {
        const safeSlug = slug.replace(/[<>"'&]/g, "");
        const r = new Response(buildNotFoundHtml(safeSlug, ROOT_DOMAIN), {
          status: 404,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "public, max-age=300",
            ...SECURITY_HEADERS,
          },
        });
        return cacheableResponse(ctx, request, r, 300);
      }
      if (earlyStoreInfo?.customDomain) {
        const target = `https://${earlyStoreInfo.customDomain}${url.pathname}${url.search}`;
        const r = new Response(null, {
          status: 301,
          headers: { Location: target, "Cache-Control": "public, max-age=86400" },
        });
        return cacheableResponse(ctx, request, r, 86400);
      }
    }

    // v6.6.0: Cold-start unified path — was causing 2-3 skeleton flashes
    // because the previous instant-skeleton page used document.write() to
    // swap in warm HTML, which wiped React's DOM and forced a full reboot.
    // Now we always serve the real React shell + injected data on cold
    // start. If storefront data isn't ready in ~600ms, we still ship the
    // shell with __STOREFRONT_PREFETCH__ as a Promise so React boots once,
    // awaits the prefetch (already supported in StorefrontLayout.logic.ts),
    // and renders → ONE skeleton only, identical to the warm path.
    if (!_memShell) {
      // v8.35.0 Phase 1: stream cold-path HTML head before awaiting Supabase RPC.
      // Buffered cold path was the #1 FCP bottleneck (~1.9s TTFB measured on
      // serdiyajewellers.shop) because Promise.all blocked the entire HTML on
      // the slowest leg (~700ms RPC). Routing through fetchAndInjectSlug reuses
      // the warm-path streaming pipeline: head flushes as soon as origin shell
      // arrives (~150ms), body waits for RPC. Behind STREAM_HTML="1" so we can
      // flip per-environment and roll back instantly by unsetting the env var.
      if (env?.STREAM_HTML === "1") {
        try {
          const { response } = await fetchAndInjectSlug(request, slug, ctx, env, hostname, url.pathname, requestStart);
          if (response) {
            ctx.waitUntil(recordPageView(env, request, undefined, url.pathname));
            return addDiagnosticHeaders(response, { slug, cacheStatus: "MISS", dataSource: "stream-cold" });
          }
        } catch {
          /* fall through to legacy buffered cold path on any failure */
        }
      }
      // v8.7.0 TTFB-cut: previous deadline of 1300ms blocked HTML flush
      // on cold-cache hits, producing ~2.2s real-world TTFB. The fallback
      // path immediately below (_buildPrefetchPromiseScript) injects a
      // Promise that React's useStorefront() awaits — so when shell data
      // isn't ready we ship HTML instantly and let the browser overlap
      // shell-data RTT with JS download/parse. Net: ~1000ms TTFB cut on
      // cold hits, identical UX (single skeleton, no flash).
      // v8.17.0 cold-load fix: 250ms was too tight — Supabase RPC from
      // CF edge to DB routinely takes 280–450ms, so the deadline almost
      // always missed and we shipped shell-only HTML (forcing a 2nd
      // round-trip in the browser before React could render). 700ms
      // lands the full-injected-HTML path on ~70–80% of cold hits,
      // cutting visible skeleton time by 500–800ms. The HTML is still
      // flushed quickly because shellResult comes from KV in parallel.
      const COLD_DATA_DEADLINE = 700;
      const [shellResult, prefetchResult, inlineProductsCold] = await Promise.all([
        getNavigationSpaShell(request, ctx, env),
        prefetchStorefrontDataWithDeadline(slug, ctx, env, COLD_DATA_DEADLINE).catch(() => ({
          data: null,
          source: "none",
        })),
        _getInlineProductsOrNull(hostname, slug, env, ctx),
      ]);

      // If we have the shell + data, serve fully injected HTML — same as warm path
      if (shellResult?.html && prefetchResult?.data) {
        const injected = injectIntoHtml(
          shellResult.html,
          slug,
          prefetchResult.data,
          prefetchResult.source,
          inlineProductsCold,
        );
        // v8.24.0: enrich with deep modulepreloads (framework, App, supabase,
        // storefront-shell, router-query) so cold loads don't waterfall.
        const enrichedHtml = await injectDeepPreloadsIntoColdHtml(injected.html, url.origin, env);
        const headers = new Headers();
        headers.set("Content-Type", "text/html; charset=utf-8");
        setNoStoreHtmlHeaders(headers);
        headers.set("X-Store-Slug", slug);
        headers.set("X-Data-Source", `cold-${prefetchResult.source}`);
        for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);
        const coldResponse = new Response(enrichedHtml, { status: 200, headers });
        storeInEdgeCache(ctx, hostname, slug, coldResponse.clone(), request, env);
        ctx.waitUntil(recordPageView(env, request, prefetchResult?.data?.store?.id, url.pathname));
        return coldResponse;
      }

      // Shell ready but data not — inject a Promise so React awaits it (one skeleton)
      if (shellResult?.html) {
        const dataPromiseScript = _buildPrefetchPromiseScript(slug);
        const headPreloads = inlineProductsCold ? _buildProductImagePreloads(inlineProductsCold, 6) : "";
        let html = shellResult.html;
        html = html.replace("</head>", `${headPreloads}\n${dataPromiseScript}\n</head>`);
        const headers = new Headers();
        headers.set("Content-Type", "text/html; charset=utf-8");
        headers.set("Cache-Control", "no-store");
        headers.set("X-Store-Slug", slug);
        headers.set("X-Data-Source", "cold-shell-only");
        for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);
        // v7.6.0 Fix A: warm call removed — cold-shell-only path already
        return new Response(html, { status: 200, headers });
      }

      // Shell unavailable — fall through to standard path below
    }

    // FIX #2: Start storefront promise FIRST before any other awaits
    const elapsed0 = Date.now() - requestStart;
    const storefrontDeadline = Math.max(400, 1400 - elapsed0);
    const earlyStorefrontPromise = prefetchStorefrontDataWithDeadline(slug, ctx, env, storefrontDeadline);

    // FIX #4: Batch KV read + shell in parallel
    // v8.9.0: also fetch inline PDP/category payload for /product/* and /category/*
    const pdpCategoryRoute = _parsePdpCategoryPath(url.pathname);
    const [shellResult, storeInfo, kvBatch, cachedHead, inlineProducts, pdpCategoryJson] = await Promise.all([
      getNavigationSpaShell(request, ctx, env),
      _resolveStoreInfo(slug, hostname, env),
      _batchKvRead(slug, env),
      _getCachedPrebuiltHead(env),
      _getInlineProductsOrNull(hostname, slug, env, ctx),
      _getInlinePdpCategoryOrNull(hostname, pdpCategoryRoute, env, ctx),
    ]);
    const pdpCategoryInline = pdpCategoryJson
      ? { kind: pdpCategoryRoute.kind, slug: pdpCategoryRoute.slug, json: pdpCategoryJson }
      : null;

    // Hydrate in-memory caches from batch
    if (kvBatch.theme && !(_memThemeCache.get(slug)?.expiresAt > Date.now())) {
      _capMapSize(_memThemeCache, MEM_THEME_CACHE_MAX);
      _memThemeCache.set(slug, { lite: kvBatch.theme, expiresAt: Date.now() + MEM_THEME_TTL });
    }
    // v7.6.0 Fix D: kvBatch.storefront removed — prefetchStorefrontData
    // (via earlyStorefrontPromise) already populates _memStorefrontCache.

    const themeLite = _memThemeCache.get(slug)?.lite || kvBatch.theme || null;

    if (!storeInfo.storeId) {
      const safeSlug = slug.replace(/[<>"'&]/g, "");
      // v8.3.0: bumped to 5min and edge-cached so unknown-slug attacks
      // (which inflate 4xx counts and tank the cache rate) cost ~zero.
      const r = new Response(buildNotFoundHtml(safeSlug, ROOT_DOMAIN), {
        status: 404,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=300",
          ...SECURITY_HEADERS,
        },
      });
      return cacheableResponse(ctx, request, r, 300);
    }

    if (storeInfo.customDomain) {
      // v8.3.0: cacheable 301 — fixes the 0% cache rate on subdomain hosts.
      const target = `https://${storeInfo.customDomain}${url.pathname}${url.search}`;
      const r = new Response(null, {
        status: 301,
        headers: { Location: target, "Cache-Control": "public, max-age=86400" },
      });
      return cacheableResponse(ctx, request, r, 86400);
    }

    const seoResponse = await handleSeoFiles(url, slug, hostname);
    if (seoResponse) return seoResponse;
    const botResponse = await handleBot(request, slug, url, false);
    if (botResponse) return botResponse;

    if (!shellResult?.html) {
      const response = await proxyToOrigin(request);
      return addDiagnosticHeaders(response, { slug, cacheStatus: "MISS", dataSource: "none" });
    }

    let prebuiltHead = cachedHead || (await getPrebuiltHead(shellResult.html, env));
    prebuiltHead = await enrichHeadWithDeepPreloads(prebuiltHead, new URL(request.url).origin, env);
    // FIX #3: Always set Link header
    const linkHeader = _buildLinkPreloadHeader(shellResult.html);

    const responseHeaders = new Headers();
    responseHeaders.set("Content-Type", "text/html; charset=utf-8");
    setNoStoreHtmlHeaders(responseHeaders);
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
      pdpCategoryInline,
    );

    await mirrorStreamedHtmlDirect(ctx, request, response, slug, env);

    // v7.7.0 Fix 2: pass already-resolved inlineProducts to skip 3rd fetch.
    ctx.waitUntil(
      _warmFullHtmlInBackground(request, shellResult, slug, ctx, env, hostname, url.pathname, inlineProducts),
    );
    ctx.waitUntil(recordPageView(env, request, storeInfo?.storeId, url.pathname));

    return addDiagnosticHeaders(response, { slug, cacheStatus: "MISS", dataSource: "streaming" });
  }

  // ─── CUSTOM DOMAIN ───
  if (hostname.startsWith("www.")) {
    const apex = hostname.slice(4);
    const target = `https://${apex}${url.pathname}${url.search}`;
    const r = new Response(null, {
      status: 301,
      headers: { Location: target, "Cache-Control": "public, max-age=86400" },
    });
    return cacheableResponse(ctx, request, r, 86400);
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

  // v6.6.0: Cold-start unified path (custom domain) — same fix as subdomain.
  // Always serve real React shell + injected data on cold start; never use
  // the document.write swap pattern that caused 2-3 skeleton flashes.
  if (!_memShell) {
    // v8.35.0 Phase 1: same streaming-cold treatment for custom-domain cold path.
    // Behind STREAM_HTML="1". Falls through to legacy buffered path on any error.
    if (env?.STREAM_HTML === "1") {
      const resolvedSlugStream = await resolveDomain(cleanDomain, env).catch(() => null);
      if (resolvedSlugStream) {
        try {
          const { response } = await fetchAndInjectSlug(
            request,
            resolvedSlugStream,
            ctx,
            env,
            hostname,
            url.pathname,
            requestStart,
          );
          if (response) {
            ctx.waitUntil(recordPageView(env, request, undefined, url.pathname));
            return addDiagnosticHeaders(response, {
              slug: resolvedSlugStream,
              cacheStatus: "MISS",
              dataSource: "stream-cold-cd",
            });
          }
        } catch {
          /* fall through to legacy buffered cold path */
        }
      }
    }
    const resolvedSlugCD = await resolveDomain(cleanDomain, env);
    if (resolvedSlugCD) {
      // v6.7.0: Same fix as subdomain path — eliminate self-call subrequest.
      const COLD_DATA_DEADLINE = 1300;
      const [shellResult, prefetchResult, inlineProductsCdCold] = await Promise.all([
        getNavigationSpaShell(request, ctx, env),
        prefetchStorefrontDataWithDeadline(resolvedSlugCD, ctx, env, COLD_DATA_DEADLINE).catch(() => ({
          data: null,
          source: "none",
        })),
        _getInlineProductsOrNull(hostname, resolvedSlugCD, env, ctx),
      ]);

      if (shellResult?.html && prefetchResult?.data) {
        const injected = injectIntoHtml(
          shellResult.html,
          resolvedSlugCD,
          prefetchResult.data,
          prefetchResult.source,
          inlineProductsCdCold,
        );
        // v8.24.0: enrich with deep modulepreloads on the custom-domain cold path too.
        const enrichedHtml = await injectDeepPreloadsIntoColdHtml(injected.html, url.origin, env);
        const headers = new Headers();
        headers.set("Content-Type", "text/html; charset=utf-8");
        setNoStoreHtmlHeaders(headers);
        headers.set("X-Store-Slug", resolvedSlugCD);
        headers.set("X-Data-Source", `cold-${prefetchResult.source}`);
        for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);
        const coldResponse = new Response(enrichedHtml, { status: 200, headers });
        storeInEdgeCache(ctx, hostname, resolvedSlugCD, coldResponse.clone(), request, env);
        ctx.waitUntil(recordPageView(env, request, prefetchResult?.data?.store?.id, url.pathname));
        return coldResponse;
      }

      if (shellResult?.html) {
        const dataPromiseScript = _buildPrefetchPromiseScript(resolvedSlugCD);
        const headPreloads = inlineProductsCdCold ? _buildProductImagePreloads(inlineProductsCdCold, 6) : "";
        let html = shellResult.html;
        html = html.replace("</head>", `${headPreloads}\n${dataPromiseScript}\n</head>`);
        const headers = new Headers();
        headers.set("Content-Type", "text/html; charset=utf-8");
        headers.set("Cache-Control", "no-store");
        headers.set("X-Store-Slug", resolvedSlugCD);
        headers.set("X-Data-Source", "cold-shell-only");
        for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);
        // v7.6.0 Fix A: warm call removed — cold-shell-only path
        return new Response(html, { status: 200, headers });
      }
      // Fall through to standard path if shell unavailable
    } else {
      // FIX #26: No slug found for this domain — return 404 immediately
      return new Response(
        `<html><body style="font-family:sans-serif;text-align:center;padding:60px"><h1>Store Not Found</h1><p>No store is configured for <b>${cleanDomain}</b></p></body></html>`,
        {
          status: 404,
          headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", ...SECURITY_HEADERS },
        },
      );
    }
  }

  // FIX #2: Start storefront promise as soon as we know the domain pattern,
  // but we don't know slug yet — kick off domain resolution + shell in parallel first
  const [resolvedSlug, shellResultCD] = await Promise.all([
    resolveDomain(cleanDomain, env),
    getNavigationSpaShell(request, ctx, env),
  ]);

  if (resolvedSlug) {
    // FIX #2: Now we know the slug, start storefront immediately
    const elapsed1 = Date.now() - requestStart;
    const storefrontDeadlineCD = Math.max(400, 1400 - elapsed1);
    const earlyStorefrontPromiseCD = prefetchStorefrontDataWithDeadline(resolvedSlug, ctx, env, storefrontDeadlineCD);

    // FIX #4: Batch remaining slug-dependent data
    // v8.9.0: also fetch inline PDP/category payload for /product/* and /category/*
    const pdpCategoryRouteCD = _parsePdpCategoryPath(url.pathname);
    const [seoResponse, botResponse, kvBatchCD, cachedHeadCDReal, inlineProductsCDReal, pdpCategoryJsonCD] =
      await Promise.all([
        handleSeoFiles(url, resolvedSlug, hostname),
        handleBot(request, resolvedSlug, url, true),
        _batchKvRead(resolvedSlug, env),
        _getCachedPrebuiltHead(env),
        _getInlineProductsOrNull(hostname, resolvedSlug, env, ctx),
        _getInlinePdpCategoryOrNull(hostname, pdpCategoryRouteCD, env, ctx),
      ]);
    const pdpCategoryInlineCD = pdpCategoryJsonCD
      ? { kind: pdpCategoryRouteCD.kind, slug: pdpCategoryRouteCD.slug, json: pdpCategoryJsonCD }
      : null;

    // Hydrate in-memory from batch
    if (kvBatchCD.theme && !(_memThemeCache.get(resolvedSlug)?.expiresAt > Date.now())) {
      _capMapSize(_memThemeCache, MEM_THEME_CACHE_MAX);
      _memThemeCache.set(resolvedSlug, { lite: kvBatchCD.theme, expiresAt: Date.now() + MEM_THEME_TTL });
    }
    // v7.6.0 Fix D: kvBatchCD.storefront removed — prefetchStorefrontData
    // (via earlyStorefrontPromiseCD) already populates _memStorefrontCache.

    const themeLiteCD = _memThemeCache.get(resolvedSlug)?.lite || kvBatchCD.theme || null;

    if (seoResponse) return seoResponse;
    if (botResponse) return botResponse;

    if (!shellResultCD?.html) {
      const response = await proxyToOrigin(request);
      return addDiagnosticHeaders(response, { slug: resolvedSlug, cacheStatus: "MISS", dataSource: "none" });
    }

    let prebuiltHeadCD = cachedHeadCDReal || (await getPrebuiltHead(shellResultCD.html, env));
    prebuiltHeadCD = await enrichHeadWithDeepPreloads(prebuiltHeadCD, new URL(request.url).origin, env);
    // FIX #3
    const linkHeaderCD = _buildLinkPreloadHeader(shellResultCD.html);

    const responseHeadersCD = new Headers();
    responseHeadersCD.set("Content-Type", "text/html; charset=utf-8");
    setNoStoreHtmlHeaders(responseHeadersCD);
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
      pdpCategoryInlineCD,
    );

    await mirrorStreamedHtmlDirect(ctx, request, responseCD, resolvedSlug, env);

    // v7.7.0 Fix 2: pass already-resolved inlineProducts to skip 3rd fetch.
    ctx.waitUntil(
      _warmFullHtmlInBackground(
        request,
        shellResultCD,
        resolvedSlug,
        ctx,
        env,
        hostname,
        url.pathname,
        inlineProductsCDReal,
      ),
    );
    // Edge-native page view tracking (replaces frontend trackPageView)
    ctx.waitUntil(
      earlyStorefrontPromiseCD
        .then((r) => recordPageView(env, request, r?.data?.store?.id, url.pathname))
        .catch(() => {}),
    );

    return addDiagnosticHeaders(responseCD, { slug: resolvedSlug, cacheStatus: "MISS", dataSource: "streaming" });
  }

  // ─── UNKNOWN DOMAIN → 404 ───
  // v8.3.0: edge-cached for 1h so probes don't re-invoke the Worker.
  {
    const r = new Response(
      `<!DOCTYPE html><html><head><title>Store Not Found</title></head><body style="font-family:sans-serif;text-align:center;padding:60px"><h1>Store Not Found</h1><p>No store is configured for this domain.</p></body></html>`,
      {
        status: 404,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=3600",
          ...SECURITY_HEADERS,
        },
      },
    );
    return cacheableResponse(ctx, request, r, 3600);
  }
}

/* ============================================================
   SCHEDULED HANDLER — DB Keepalive + Full Store Warming
   FIX #14: Warm ALL stores (not just top 20), concurrency=10
   FIX #15: Fetch shell ONCE before the loop, reuse for all stores
   ============================================================ */
async function _handleScheduled(event, env, ctx) {
  const keepaliveStart = Date.now();
  // Flush any pending page-view rows so the buffer never holds data >1 cron interval
  try {
    const flushPromise = flushPageViewBuffer();
    if (flushPromise) ctx.waitUntil(flushPromise);
  } catch {}

  // v8.47 cost-cut: check the 55-min full-sync gate BEFORE pinging Supabase.
  // Previously we always fired get_platform_config_public on every cron tick
  // (every 30 min) even when the heavy sync was throttled, wasting 2-4k
  // subrequests/day. Now: on throttled ticks we skip the DB ping entirely.
  // The DB still gets touched by real visitors + every 60min full-sync run,
  // which is more than enough to keep the connection pool warm.
  let _shouldRunFullSync = true;
  if (env?.STORE_KV) {
    try {
      const lastSync = await env.STORE_KV.get("cron-last-full-sync");
      if (lastSync && Date.now() - parseInt(lastSync, 10) < 55 * 60 * 1000) {
        _shouldRunFullSync = false;
      }
    } catch {}
  }
  if (!_shouldRunFullSync) {
    console.log("[keepalive] sync skipped (throttled, <55min since last) — no DB ping fired");
    return;
  }

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
    console.log(`[keepalive] DB ping: ${dbPingMs}ms, status: ${res.status} (running full sync)`);


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

            // v8.5.0 cost-cut: route all cron KV writes through kvPutDedup
            // (5-min in-isolate dedup) so multi-colo cron fan-out collapses
            // identical writes. store-info already has read-before-write;
            // also gate the related store-id/domain writes by their own
            // existing-value check (not just store-info change) so a slug
            // rename or custom_domain change still propagates correctly.
            const kvWrites = [];
            let kvWriteCount = 0,
              kvSkipCount = 0;

            // Pre-read store-id keys we'll potentially touch (one extra Promise.all
            // round-trip but cuts ~80% of writes on steady-state cron ticks).
            const subDomainKeys = allSlugs.map((slug) => `store-id:${slug}.${ROOT_DOMAIN}`);
            const customDomainPairs = allStores
              .filter((s) => s.custom_domain && s.slug)
              .map((s) => ({
                slug: s.slug,
                cleanCustom: s.custom_domain
                  .replace(/^www\./, "")
                  .toLowerCase()
                  .trim(),
              }));
            const customIdKeys = customDomainPairs.map((p) => `store-id:${p.cleanCustom}`);
            const customDomainKeys = customDomainPairs.map((p) => `domain:${p.cleanCustom}`);

            const [existingSubIds, existingCustomIds, existingDomainMaps] = await Promise.all([
              Promise.all(subDomainKeys.map((k) => env.STORE_KV.get(k).catch(() => null))),
              Promise.all(customIdKeys.map((k) => env.STORE_KV.get(k).catch(() => null))),
              Promise.all(customDomainKeys.map((k) => env.STORE_KV.get(k).catch(() => null))),
            ]);

            for (let i = 0; i < allSlugs.length; i++) {
              const s = allStores.find((st) => st.slug === allSlugs[i]);
              if (!s) continue;
              const payload = JSON.stringify({ id: s.id, cd: s.custom_domain || null });
              let storeChanged = false;

              if (existingValues[i] !== payload) {
                kvWrites.push(kvPutDedup(env, `store-info:${s.slug}`, payload, { expirationTtl: STORE_INFO_KV_TTL }));
                storeChanged = true;
              }

              // store-id:{subDomain} — write only if missing or changed
              if (existingSubIds[i] !== s.id) {
                const subDomain = `${s.slug}.${ROOT_DOMAIN}`;
                kvWrites.push(kvPutDedup(env, `store-id:${subDomain}`, s.id, { expirationTtl: 86400 }));
                storeChanged = true;
              }

              if (storeChanged) kvWriteCount++;
              else kvSkipCount++;
            }

            // Custom domain writes — gated by their own existing-value checks
            for (let j = 0; j < customDomainPairs.length; j++) {
              const { slug, cleanCustom } = customDomainPairs[j];
              const s = allStores.find((st) => st.slug === slug);
              if (!s) continue;
              if (existingCustomIds[j] !== s.id) {
                kvWrites.push(kvPutDedup(env, `store-id:${cleanCustom}`, s.id, { expirationTtl: 86400 }));
              }
              const domainPayload = JSON.stringify({ slug: s.slug });
              if (existingDomainMaps[j] !== domainPayload) {
                kvWrites.push(
                  kvPutDedup(env, `domain:${cleanCustom}`, domainPayload, { expirationTtl: KV_DOMAIN_TTL }),
                );
              }
            }

            // all-active-slugs — read-before-write (skip if unchanged)
            try {
              const slugsPayload = JSON.stringify(allSlugs);
              const existingSlugs = await env.STORE_KV.get("all-active-slugs").catch(() => null);
              if (existingSlugs !== slugsPayload) {
                kvWrites.push(kvPutDedup(env, "all-active-slugs", slugsPayload, { expirationTtl: 3_600 }));
              }
            } catch {}
            _slugIndexSet = new Set(allSlugs);
            _slugIndexExpiresAt = Date.now() + 1_800_000;

            if (kvWrites.length > 0) await Promise.all(kvWrites);
            console.log(
              `[keepalive] warmed ${allStores.length} stores — KV: ${kvWriteCount} changed, ${kvSkipCount} skipped, ${kvWrites.length} total writes`,
            );
          }

          // FIX #26 + v7.6.0 Fix G: Only warm stores with traffic in last 7 days.
          // Active-slug list is cached in KV for 6h to avoid hitting Supabase
          // page_views (a growing table) on every cron tick.
          let activeSlugs = new Set();
          try {
            let cachedSlugs = null;
            if (env?.STORE_KV) {
              cachedSlugs = await env.STORE_KV.get("active-slugs-7d", { type: "json" }).catch(() => null);
            }
            if (Array.isArray(cachedSlugs)) {
              activeSlugs = new Set(cachedSlugs);
            } else {
              const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
              // v8.47 cost-cut: cap the scan at 10k rows. Without this PostgREST
              // can scan the entire page_views table (unbounded, growing daily)
              // every 6h when KV expires. 10k distinct rows is enough to cover
              // every active store on the platform many times over.
              const activeRes = await fetch(
                `${SUPABASE_URL}/rest/v1/page_views?select=store_id&created_at=gte.${sevenDaysAgo}&limit=10000`,

                {
                  headers: {
                    apikey: SUPABASE_ANON_KEY,
                    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                  },
                },
              );
              if (activeRes.ok) {
                const rows = await activeRes.json();
                const activeIds = new Set(rows.map((r) => r.store_id));
                activeSlugs = new Set(allStores.filter((s) => activeIds.has(s.id)).map((s) => s.slug));
                if (env?.STORE_KV) {
                  ctx.waitUntil(
                    env.STORE_KV.put("active-slugs-7d", JSON.stringify([...activeSlugs]), {
                      expirationTtl: 21_600,
                    }).catch(() => {}),
                  );
                }
              }
            }
          } catch {}

          // v7.5.0 LEAK FIX: Cron no longer warms HTML/products on every tick.
          // KV is already synced above (which is the only thing that *must*
          // happen periodically). HTML + products are warmed on-demand by:
          //  1. The first real visitor (instant skeleton + background warm)
          //  2. Dashboard saves (explicit /api/prewarm call)
          //  3. Stale-while-revalidate on the warm HTML cache (7-day window)
          //
          // Previous behavior: every cron tick fanned out ~10-20 subrequests
          // per active store (DB shell fetch + product fetch + 4-6 KV writes
          // + 4-6 cache puts) even when nothing changed. With 1-2 stores
          // that was ~1-2k idle Worker subrequests/hour.
          //
          // Only warm stores whose HTML cache is COMPLETELY missing (true cold).
          const storesToWarm = activeSlugs.size > 0 ? allStores.filter((s) => activeSlugs.has(s.slug)) : []; // No active traffic? Don't warm anything.

          const CONCURRENCY = 5;
          let warmedHtml = 0;
          let skippedAlreadyCached = 0;

          for (let i = 0; i < storesToWarm.length; i += CONCURRENCY) {
            const batch = storesToWarm.slice(i, i + CONCURRENCY);
            await Promise.all(
              batch.map(async (s) => {
                try {
                  if (!s.slug || !s.id) return;

                  // Skip if HTML already cached (the common case — cuts 90%+ of work)
                  const subEarlyKey = getEarlyCacheKey(`${s.slug}.${ROOT_DOMAIN}`);
                  const existing = await cache.match(subEarlyKey).catch(() => null);
                  if (existing) {
                    skippedAlreadyCached++;
                    return;
                  }

                  const shellResult = cronShellResult;
                  if (!shellResult?.html) return;

                  const dataResult = await prefetchStorefrontData(s.slug, ctx, env);
                  if (!dataResult.data) return;

                  const injected = injectIntoHtml(shellResult.html, s.slug, dataResult.data, "cron-prewarm");
                  const htmlResponse = new Response(injected.html, {
                    status: 200,
                    headers: {
                      "Content-Type": "text/html; charset=utf-8",
                      "Cache-Control": "public, max-age=7200, stale-while-revalidate=604800",
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
                    const domEarlyKey = getEarlyCacheKey(cleanCustom);
                    await cache.put(domEarlyKey, htmlResponse.clone()).catch(() => {});
                  }
                  warmedHtml++;
                  // NOTE: Products are NOT warmed here. They are warmed lazily
                  // by _fetchShellFromSupabase via ctx.waitUntil on first visit,
                  // which happens within milliseconds of the HTML cold load.

                  // v8.8.1 Fix #1: prewarm top PDP + category edge caches so the
                  // first visitor to /product/* or /category/* doesn't pay full DB cost.
                  ctx.waitUntil(_prewarmPdpAndCategory(s, dataResult.data, env, ctx).catch(() => {}));
                } catch {}
              }),
            );
          }

          console.log(
            `[keepalive] cron: ${warmedHtml} cold-warmed, ${skippedAlreadyCached} already-cached (skipped), ${allStores.length - storesToWarm.length} inactive (skipped)`,
          );

          // v8.0.0 cost-cut: stamp last-full-sync so the next 30-min tick can skip.
          if (env?.STORE_KV) {
            await env.STORE_KV.put("cron-last-full-sync", String(Date.now()), { expirationTtl: 7200 }).catch(() => {});
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
}
