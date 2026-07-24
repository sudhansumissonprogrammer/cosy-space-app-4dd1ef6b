// Branded WhatsApp button redirector.
// URL: https://shopbanao.in/r/<token>  → index.html inline script forwards
// here → 301/302 to the store's real page.
//
// Token formats:
//   o-<order_uuid>      → /account/orders/<id> on store's domain  (stable → 301 + long cache)
//   t-<order_uuid>      → tracking_url (fall back to order page)  (302 + short cache)
//   c-<cart_id_or_token>→ /cart?recover=<token> on store's domain (302 no-store)
//   p-<product_uuid>    → /product/<slug> on store's domain       (302 + medium cache)
//
// Speed engineering (v2):
//   1. Redirect 302 carries `Link: rel=preconnect` + `rel=preload` headers.
//      Modern browsers act on these WHILE following the 3xx — so the
//      final storefront's TLS is warm and the hero image + merged PDP
//      RPC start downloading before the storefront HTML even arrives.
//      Documented in RFC 8288 / Fetch spec, honored by Chromium & Safari.
//   2. Fire-and-forget cache warmers ping the storefront's Cloudflare
//      worker endpoints (`/product/<slug>`, `/api/pdp?slug=...`) so the
//      HTML shell + PDP bundle are hot in KV by the time the user arrives
//      ~150-300ms later.
//   3. Product lookup selects the hero image + slug in one round trip so
//      we can preload the LCP asset without a second Postgres hop.
//
// Caching strategy for the 302 itself:
//   `max-age` ONLY (no `s-maxage`) so browsers cache repeat clicks
//   locally while the function still runs for EVERY unique user —
//   keeps wa_link_clicks accurate. Stronger 301 for order links since
//   order UUIDs never change destination.
import { createClient } from "npm:@supabase/supabase-js@2";
import { mintAutoLoginToken, canonicalPhone } from "../_shared/wa-autologin-token.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Module-scope client → connection pool + TLS reuse across invocations.
const admin = createClient(SUPABASE_URL, SERVICE_KEY);

/**
 * Append an HMAC-signed `?al=<token>` to a redirect target so the storefront
 * lands the shopper already logged-in (consumed by wa-autologin).
 * Returns the URL unchanged when phone is missing/invalid.
 */
async function withAutoLogin(url: string, rawPhone: string | null | undefined): Promise<string> {
  const phone = canonicalPhone(rawPhone || "");
  if (!phone) return url;
  const token = await mintAutoLoginToken(phone, SERVICE_KEY);
  if (!token) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}al=${encodeURIComponent(token)}`;
}

function storeBase(s: any): string {
  if (!s) return "https://shopbanao.in";
  if (s.custom_domain) return `https://${s.custom_domain}`;
  if (s.slug) return `https://${s.slug}.shopbanao.in`;
  return "https://shopbanao.in";
}

type RedirectOpts = {
  status?: 301 | 302;
  maxAge?: number;                 // seconds, browser-only cache
  preconnectHosts?: string[];      // will emit `Link: rel=preconnect`
  preloadImages?: string[];        // will emit `Link: rel=preload; as=image`
  preloadFetches?: string[];       // will emit `Link: rel=preload; as=fetch`
};

function redirect(to: string, opts: RedirectOpts = {}): Response {
  const status = opts.status ?? 302;
  const headers = new Headers();
  headers.set("Location", to);
  headers.set(
    "Cache-Control",
    opts.maxAge ? `public, max-age=${opts.maxAge}` : "no-store",
  );

  // Multiple Link headers — browsers merge and act on each.
  const links: string[] = [];
  for (const h of opts.preconnectHosts || []) {
    if (h) links.push(`<https://${h}>; rel=preconnect; crossorigin`);
  }
  for (const u of opts.preloadImages || []) {
    if (u) links.push(`<${u}>; rel=preload; as=image; fetchpriority=high`);
  }
  for (const u of opts.preloadFetches || []) {
    if (u) links.push(`<${u}>; rel=preload; as=fetch; crossorigin`);
  }
  if (links.length) headers.set("Link", links.join(", "));

  return new Response(null, { status, headers });
}

// Fire-and-forget storefront cache warmer. Only warms the JSON PDP bundle
// (`/api/pdp?slug=...`) — NOT the HTML shell — so we don't pollute pageview
// analytics with synthetic hits. HTML shell latency is already mitigated by
// the `Link: rel=preconnect` header on the 302, which warms TLS to the
// storefront domain during the redirect.
function warmStorefront(host: string, productSlug?: string) {
  try {
    if (!productSlug) return;
    const url = `https://${host}/api/pdp?slug=${encodeURIComponent(productSlug)}`;
    // No await — race the browser. Errors ignored (best-effort).
    fetch(url, {
      method: "GET",
      headers: { "User-Agent": "wa-r-warmer/1.0", "X-Warmer": "wa-r" },
    }).catch(() => {});
  } catch { /* noop */ }
}

// Best-effort hero image URL extractor. Product images may live in a
// separate table; we grab the top display_order image with one shot.
async function getHeroImage(productId: string): Promise<string | null> {
  try {
    const { data } = await admin
      .from("product_images")
      .select("image_url")
      .eq("product_id", productId)
      .order("display_order", { ascending: true })
      .limit(1)
      .maybeSingle();
    const raw = (data as any)?.image_url as string | undefined;
    if (!raw) return null;
    // Absolute URL only — Link header preloads need scheme+host.
    if (raw.startsWith("http")) return raw;
    return null;
  } catch { return null; }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const token = (parts[parts.length - 1] || "").trim();
  if (!token || token === "wa-r") return redirect("https://shopbanao.in");

  const kind = token.slice(0, 2);
  // For `p-` marketing links, cart-recovery-cron appends `~<phone10>` so we
  // can autologin the recipient (products carry no phone in the DB).
  const rawId = token.slice(2);
  const tildeIdx = rawId.indexOf("~");
  const id = tildeIdx >= 0 ? rawId.slice(0, tildeIdx) : rawId;
  const suffixPhone = tildeIdx >= 0 ? rawId.slice(tildeIdx + 1) : "";

  // Fire-and-forget click log. Never blocks the redirect.
  const ua = req.headers.get("user-agent") || "";
  const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "";
  admin.from("wa_link_clicks").insert({
    token, kind, ref_id: id, user_agent: ua.slice(0, 256), ip_address: ip.split(",")[0].trim() || null,
  } as any).then(() => {}, () => {});

  try {
    if (kind === "o-" || kind === "t-") {
      const { data: o } = await admin
    if (kind === "r-") {
      const { data: o } = await admin
        .from("orders")
        .select("id, customer_phone, stores:store_id(name, slug, custom_domain)")
        .eq("id", id).maybeSingle();
      if (!o) return redirect("https://shopbanao.in");
      const storeRow = (o as any).stores;
      const base = storeBase(storeRow);
      const host = base.replace(/^https?:\/\//, "");
      const phone = (o as any).customer_phone as string | null;
      const target = await withAutoLogin(`${base}/checkout?recover_order=${(o as any).id}`, phone);
      return redirect(target, {
        status: 302,
        maxAge: 0,
        preconnectHosts: [host],
      });
    }
        .from("orders")
        .select("id, tracking_url, customer_phone, stores:store_id(name, slug, custom_domain)")
        .eq("id", id).maybeSingle();
      if (!o) return redirect("https://shopbanao.in");
      const storeRow = (o as any).stores;
      const base = storeBase(storeRow);
      const host = base.replace(/^https?:\/\//, "");
      const phone = (o as any).customer_phone as string | null;
      if (kind === "t-" && (o as any).tracking_url) {
        // Tracking URLs are usually external courier sites — no autologin.
        return redirect((o as any).tracking_url, { status: 302, maxAge: 60 });
      }
      const target = await withAutoLogin(`${base}/account/orders/${(o as any).id}`, phone);
      // Preconnect to storefront so account page TLS is warm.
      // Downgraded to 302 (was 301) so a fresh signed token is minted on
      // every click — 301s get cached forever by browsers.
      return redirect(target, {
        status: 302,
        maxAge: 0,
        preconnectHosts: [host],
      });
    }
    if (kind === "c-") {
      const { data: c } = await admin
        .from("abandoned_carts")
        .select("id, session_token, customer_phone, stores:store_id(name, slug, custom_domain)")
        .eq("id", id).maybeSingle();
      if (!c) return redirect("https://shopbanao.in");
      const base = storeBase((c as any).stores);
      const host = base.replace(/^https?:\/\//, "");
      const t = (c as any).session_token || (c as any).id;
      const phone = (c as any).customer_phone as string | null;
      const target = await withAutoLogin(
        `${base}/cart?recover=${encodeURIComponent(String(t))}`,
        phone,
      );
      return redirect(target, { preconnectHosts: [host] });
    }
    if (kind === "p-") {
      const { data: p } = await admin
        .from("products")
        .select("id, slug, stores:store_id(name, slug, custom_domain)")
        .eq("id", id).maybeSingle();
      if (!p) return redirect("https://shopbanao.in");
      const storeRow = (p as any).stores;
      const base = storeBase(storeRow);
      const host = base.replace(/^https?:\/\//, "");
      const slug = (p as any).slug as string | undefined;
      if (!slug) return redirect(base, { preconnectHosts: [host] });

      // Parallel: hero image lookup + storefront cache warm.
      const heroPromise = getHeroImage((p as any).id);
      warmStorefront(host, slug);

      const hero = await heroPromise;
      const pdpApi = `${base}/api/pdp?slug=${encodeURIComponent(slug)}`;

      const target = await withAutoLogin(
        `${base}/product/${encodeURIComponent(slug)}`,
        suffixPhone,
      );
      return redirect(target, {
        status: 302,
        // 0 when signed — every click must mint a fresh token. Retain the 300s
        // browser cache for unsigned (no-phone) marketing links.
        maxAge: suffixPhone ? 0 : 300,
        preconnectHosts: [host, "cdn.shopbanao.in"],
        preloadImages: hero ? [hero] : undefined,
        preloadFetches: [pdpApi],
      });
    }
  } catch { /* fallthrough */ }
  return redirect("https://shopbanao.in");
});
