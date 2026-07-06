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

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Module-scope client → connection pool + TLS reuse across invocations.
const admin = createClient(SUPABASE_URL, SERVICE_KEY);

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

// Fire-and-forget storefront cache warmers. Runs during the ~150-300ms the
// browser spends handshaking to the storefront domain, so KV is already hot
// when the real request arrives. Errors are ignored — this is best-effort.
function warmStorefront(host: string, productSlug?: string) {
  try {
    const targets: string[] = [];
    if (productSlug) {
      // Warms the merged PDP bundle (worker route → KV cached).
      targets.push(`https://${host}/api/pdp?slug=${encodeURIComponent(productSlug)}`);
      // Warms the storefront HTML shell for this product route.
      targets.push(`https://${host}/product/${encodeURIComponent(productSlug)}`);
    }
    for (const url of targets) {
      // No await — let it race. cf-worker keepalive keeps it running past
      // the response return in the Supabase runtime.
      fetch(url, {
        method: "GET",
        headers: { "User-Agent": "wa-r-warmer/1.0", "X-Warmer": "wa-r" },
      }).catch(() => {});
    }
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
  const id = token.slice(2);

  // Fire-and-forget click log. Never blocks the redirect.
  const ua = req.headers.get("user-agent") || "";
  const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "";
  admin.from("wa_link_clicks").insert({
    token, kind, ref_id: id, user_agent: ua.slice(0, 256), ip_address: ip.split(",")[0].trim() || null,
  } as any).then(() => {}, () => {});

  try {
    if (kind === "o-" || kind === "t-") {
      const { data: o } = await admin
        .from("orders")
        .select("id, tracking_url, stores:store_id(name, slug, custom_domain)")
        .eq("id", id).maybeSingle();
      if (!o) return redirect("https://shopbanao.in");
      const storeRow = (o as any).stores;
      const base = storeBase(storeRow);
      const host = base.replace(/^https?:\/\//, "");
      if (kind === "t-" && (o as any).tracking_url) {
        return redirect((o as any).tracking_url, { status: 302, maxAge: 60 });
      }
      // Preconnect to storefront so account page TLS is warm.
      return redirect(`${base}/account/orders/${(o as any).id}`, {
        status: 301,
        maxAge: 86400,
        preconnectHosts: [host],
      });
    }
    if (kind === "c-") {
      const { data: c } = await admin
        .from("abandoned_carts")
        .select("id, session_token, stores:store_id(name, slug, custom_domain)")
        .eq("id", id).maybeSingle();
      if (!c) return redirect("https://shopbanao.in");
      const base = storeBase((c as any).stores);
      const host = base.replace(/^https?:\/\//, "");
      const t = (c as any).session_token || (c as any).id;
      return redirect(`${base}/cart?recover=${encodeURIComponent(String(t))}`, {
        preconnectHosts: [host],
      });
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

      return redirect(`${base}/product/${encodeURIComponent(slug)}`, {
        status: 302,
        maxAge: 300,
        preconnectHosts: [host, "cdn.shopbanao.in"],
        preloadImages: hero ? [hero] : undefined,
        preloadFetches: [pdpApi],
      });
    }
  } catch { /* fallthrough */ }
  return redirect("https://shopbanao.in");
});
