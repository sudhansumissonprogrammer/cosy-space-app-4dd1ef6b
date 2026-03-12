/**
 * Cloudflare Worker: 301 redirect /store/{slug} → {slug}.storivo.in
 * 
 * Deploy this in your Cloudflare dashboard:
 * 1. Go to Workers & Pages → Create Worker
 * 2. Paste this code
 * 3. Add a route: storivo.in/store/* (under Workers Routes for your zone)
 * 
 * This runs at the edge BEFORE the request hits your origin,
 * giving search engines a proper 301 (not a client-side redirect).
 */

const ROOT_DOMAIN = "storivo.in";

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const hostname = url.hostname;

    // Only act on the root domain (storivo.in or www.storivo.in)
    if (hostname !== ROOT_DOMAIN && hostname !== `www.${ROOT_DOMAIN}`) {
      return fetch(request);
    }

    // Match /store/{slug} or /store/{slug}/...
    const match = url.pathname.match(/^\/store\/([a-zA-Z0-9_-]+)(\/.*)?$/);
    if (!match) {
      return fetch(request);
    }

    const slug = match[1];
    const remainingPath = match[2] || "";
    const search = url.search;
    const hash = url.hash;

    const redirectUrl = `https://${slug}.${ROOT_DOMAIN}${remainingPath}${search}${hash}`;

    return new Response(null, {
      status: 301,
      headers: {
        Location: redirectUrl,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  },
};
