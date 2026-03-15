/**
 * Cloudflare Worker: OG Meta Tag Rewriting for Social Crawlers
 * 
 * This worker intercepts requests from social media crawlers (WhatsApp, Facebook,
 * Twitter, Telegram, etc.) on store subdomains and rewrites the HTML <head> to
 * inject store-specific OG tags so link previews show the store info instead of
 * the platform's default meta tags.
 * 
 * Deploy: Integrate into your existing storivo-router worker or as a separate worker.
 * Route: *.storivo.in/*
 * 
 * Required: The og-meta edge function must be deployed.
 */

const ROOT_DOMAIN = "storivo.in";
const SUPABASE_URL = "https://nyopdqvfbgnjmqluhynr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55b3BkcXZmYmduam1xbHVoeW5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNjUxMDUsImV4cCI6MjA4ODY0MTEwNX0.ziyVV6rwdgYIvOirV3s67QFDw2IrKrT6-bwBvhUR0OM";

// Regex to detect social media crawler user agents
const BOT_UA_REGEX = /WhatsApp|facebookexternalhit|Facebot|Twitterbot|TelegramBot|LinkedInBot|Slackbot|Discordbot|Pinterest|Googlebot/i;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const hostname = url.hostname;

    // Only act on subdomains of ROOT_DOMAIN
    if (!hostname.endsWith(`.${ROOT_DOMAIN}`) || hostname === ROOT_DOMAIN || hostname === `www.${ROOT_DOMAIN}`) {
      return fetch(request);
    }

    // Extract slug from subdomain
    const slug = hostname.slice(0, hostname.length - ROOT_DOMAIN.length - 1);
    if (!slug || slug.includes(".") || slug === "www") {
      return fetch(request);
    }

    // Check if the request is from a social crawler
    const userAgent = request.headers.get("User-Agent") || "";
    if (!BOT_UA_REGEX.test(userAgent)) {
      // Normal user — pass through to origin
      return fetch(request);
    }

    // === Social crawler detected — fetch store OG data and rewrite HTML ===
    try {
      const ogResponse = await fetch(
        `${SUPABASE_URL}/functions/v1/og-meta?slug=${encodeURIComponent(slug)}`,
        {
          headers: {
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          },
        }
      );

      if (!ogResponse.ok) {
        // Fallback: serve original page
        return fetch(request);
      }

      const og = await ogResponse.json();
      const storeUrl = `https://${slug}.${ROOT_DOMAIN}${url.pathname}`;

      // Fetch the original HTML from origin
      const originResponse = await fetch(request);
      const html = await originResponse.text();

      // Build replacement OG meta tags
      const ogTags = `
    <title>${escapeHtml(og.title)}</title>
    <meta name="description" content="${escapeHtml(og.description)}">
    <meta property="og:title" content="${escapeHtml(og.title)}">
    <meta property="og:description" content="${escapeHtml(og.description)}">
    <meta property="og:url" content="${escapeHtml(storeUrl)}">
    <meta property="og:type" content="website">
    ${og.image ? `<meta property="og:image" content="${escapeHtml(og.image)}">` : ""}
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(og.title)}">
    <meta name="twitter:description" content="${escapeHtml(og.description)}">
    ${og.image ? `<meta name="twitter:image" content="${escapeHtml(og.image)}">` : ""}
    <link rel="canonical" href="${escapeHtml(storeUrl)}">
  </head>`;

      // Replace existing </head> with our OG tags + </head>
      // First, strip existing OG/twitter meta tags and title to avoid duplicates
      let rewritten = html
        .replace(/<title>[^<]*<\/title>/i, "")
        .replace(/<meta\s+name="description"[^>]*>/gi, "")
        .replace(/<meta\s+property="og:[^"]*"[^>]*>/gi, "")
        .replace(/<meta\s+name="twitter:[^"]*"[^>]*>/gi, "")
        .replace(/<link\s+rel="canonical"[^>]*>/gi, "");

      // Inject new tags before </head>
      rewritten = rewritten.replace(/<\/head>/i, ogTags);

      return new Response(rewritten, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=300, s-maxage=3600",
        },
      });
    } catch (err) {
      // On any error, fall back to original
      return fetch(request);
    }
  },
};

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
