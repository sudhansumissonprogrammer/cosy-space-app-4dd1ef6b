/**
 * Unified Cloudflare Worker: storivo-router
 *
 * Handles THREE responsibilities:
 * 1. 301 redirect: storivo.in/store/{slug} → {slug}.storivo.in
 * 2. OG rewriting: Detects social crawlers on subdomains and injects store-specific OG tags
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

// Social media crawler User-Agent patterns
const BOT_UA_REGEX = /WhatsApp|facebookexternalhit|Facebot|Twitterbot|TelegramBot|LinkedInBot|Slackbot|Discordbot|Pinterest|Googlebot|OpenGraphIO|opengraph\.xyz|Embedly|Iframely|MetaInspector|PetalBot|Bingbot|YandexBot/i;

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
      // Not a /store/ path on root domain — proxy to origin
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

    // ─── 3. OG REWRITING FOR SOCIAL CRAWLERS ───
    const userAgent = request.headers.get("User-Agent") || "";
    if (BOT_UA_REGEX.test(userAgent)) {
      try {
        const ogResponse = await callEdgeFunction("og-meta", slug);

        if (ogResponse.ok) {
          const og = await ogResponse.json();
          const storeUrl = `https://${slug}.${ROOT_DOMAIN}${url.pathname}`;

          // Fetch original HTML from origin
          const originResponse = await proxyToOrigin(request);
          const html = await originResponse.text();

          // Build store-specific OG tags
          const ogTags = `
    <title>${escapeHtml(og.title)}</title>
    <meta name="description" content="${escapeHtml(og.description)}">
    <meta property="og:title" content="${escapeHtml(og.title)}">
    <meta property="og:description" content="${escapeHtml(og.description)}">
    <meta property="og:url" content="${escapeHtml(storeUrl)}">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="${escapeHtml(og.title.split('—')[0]?.trim() || og.title)}">
    ${og.image ? `<meta property="og:image" content="${escapeHtml(og.image)}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">` : ""}
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(og.title)}">
    <meta name="twitter:description" content="${escapeHtml(og.description)}">
    ${og.image ? `<meta name="twitter:image" content="${escapeHtml(og.image)}">` : ""}
    <link rel="canonical" href="${escapeHtml(storeUrl)}">
  </head>`;

          // Strip existing meta tags to avoid duplicates, then inject new ones
          let rewritten = html
            .replace(/<title>[^<]*<\/title>/i, "")
            .replace(/<meta\s+name="description"[^>]*>/gi, "")
            .replace(/<meta\s+property="og:[^"]*"[^>]*>/gi, "")
            .replace(/<meta\s+name="twitter:[^"]*"[^>]*>/gi, "")
            .replace(/<link\s+rel="canonical"[^>]*>/gi, "");

          rewritten = rewritten.replace(/<\/head>/i, ogTags);

          return new Response(rewritten, {
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
