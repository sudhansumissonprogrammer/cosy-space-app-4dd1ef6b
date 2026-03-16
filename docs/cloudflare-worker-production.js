/**
 * Unified Cloudflare Worker: storivo-router
 *
 * Handles THREE responsibilities:
 * 1. 301 redirect: storivo.in/store/{slug} → {slug}.storivo.in
 * 2. OG rewriting: Detects social crawlers on subdomains and serves lightweight OG HTML
 * 3. SEO files: Intercepts /sitemap.xml and /robots.txt on subdomains → Edge Functions
 *
 * Deploy in Cloudflare dashboard:
 * 1. Workers & Pages → Create Worker → Name: "storivo-router"
 * 2. Paste this entire code
 * 3. Add TWO routes under Workers Routes for your zone:
 *    - *.storivo.in/*    (subdomains: OG rewrite + SEO files + proxy)
 *    - storivo.in/store/* (path redirect)
 *
 * Required: og-meta, sitemap, robots-txt edge functions must be deployed.
 */

const ROOT_DOMAIN = "storivo.in";
const ORIGIN_HOST = "core-sparkle-suite.lovable.app";
const SUPABASE_URL = "https://dtwmmuzmepdltroiypgu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0d21tdXptZXBkbHRyb2l5cGd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NDM4MjMsImV4cCI6MjA4OTIxOTgyM30.Kq4jRUeelihhqyRWLodiQIhhSi0AANQ7PletSjS4NlU";

// Social media crawler + OG scraper User-Agent patterns
const BOT_UA_REGEX = /WhatsApp|facebookexternalhit|Facebot|Twitterbot|TelegramBot|LinkedInBot|Slackbot|Discordbot|Pinterest|Googlebot|OpenGraphIO|opengraph\.xyz|Embedly|Iframely|MetaInspector|PetalBot|Bingbot|YandexBot|curl|wget|HeadlessChrome|Lighthouse|Prerender/i;

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Proxy a request to the Lovable origin */
function proxyToOrigin(request) {
  const originUrl = new URL(request.url);
  originUrl.hostname = ORIGIN_HOST;
  const headers = new Headers(request.headers);
  headers.set("Host", ORIGIN_HOST);
  return fetch(originUrl.toString(), {
    method: request.method,
    headers,
    body: request.body,
    redirect: "follow",
  });
}

/** Call a Supabase edge function */
function callEdgeFunction(name, slug) {
  return fetch(
    `${SUPABASE_URL}/functions/v1/${name}?slug=${encodeURIComponent(slug)}`,
    { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
  );
}

/**
 * Build a lightweight self-contained HTML page with OG tags.
 * Served directly to bots — no proxying needed, so it's instant.
 * Human visitors who somehow hit this get redirected to the real page.
 */
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
  <meta property="og:image:secure_url" content="${escapeHtml(image)}">
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
<body>
  <p>Redirecting to <a href="${escapeHtml(storeUrl)}">${siteName}</a>...</p>
</body>
</html>`;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const hostname = url.hostname;

    // ─── 1. PATH REDIRECT: storivo.in/store/{slug} → {slug}.storivo.in ───
    if (hostname === ROOT_DOMAIN || hostname === `www.${ROOT_DOMAIN}`) {
      const match = url.pathname.match(/^\/store\/([a-zA-Z0-9_-]+)(\/.*)?$/);
      if (match) {
        const slug = match[1];
        const remainingPath = match[2] || "";
        const redirectUrl = `https://${slug}.${ROOT_DOMAIN}${remainingPath}${url.search}${url.hash}`;
        return new Response(null, {
          status: 301,
          headers: {
            Location: redirectUrl,
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      }
      return proxyToOrigin(request);
    }

    // ─── SUBDOMAIN LOGIC ───
    if (!hostname.endsWith(`.${ROOT_DOMAIN}`)) {
      return proxyToOrigin(request);
    }

    const slug = hostname.slice(0, hostname.length - ROOT_DOMAIN.length - 1);
    if (!slug || slug.includes(".") || slug === "www") {
      return proxyToOrigin(request);
    }

    // ─── 2. SEO FILES: /sitemap.xml and /robots.txt ───
    if (url.pathname === "/sitemap.xml") {
      const res = await callEdgeFunction("sitemap", slug);
      return new Response(await res.text(), {
        headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=86400" },
      });
    }

    if (url.pathname === "/robots.txt") {
      const res = await callEdgeFunction("robots-txt", slug);
      return new Response(await res.text(), {
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" },
      });
    }

    // ─── 3. OG FOR SOCIAL CRAWLERS — serve lightweight HTML, no proxy needed ───
    const userAgent = request.headers.get("User-Agent") || "";
    if (BOT_UA_REGEX.test(userAgent)) {
      try {
        const ogResponse = await callEdgeFunction("og-meta", slug);

        if (ogResponse.ok) {
          const og = await ogResponse.json();
          const storeUrl = `https://${slug}.${ROOT_DOMAIN}${url.pathname}`;
          const html = buildOgHtml(og, storeUrl);

          return new Response(html, {
            status: 200,
            headers: {
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "public, max-age=300, s-maxage=3600",
            },
          });
        }
      } catch {
        // Fall through to normal proxy on error
      }
    }

    // ─── 4. NORMAL REQUEST — proxy to origin ───
    return proxyToOrigin(request);
  },
};
