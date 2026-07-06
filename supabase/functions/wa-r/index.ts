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
// Caching strategy:
//   We use `max-age` ONLY (no `s-maxage`) so browsers cache repeat clicks
//   locally (instant back-button + same-user re-clicks) while the function
//   still executes for EVERY unique user — keeps wa_link_clicks analytics
//   accurate. A stronger 301 is used for order links because order UUIDs
//   never change destination; products/tracking stay 302 in case slug or
//   tracking_url is edited later.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function storeBase(s: any): string {
  if (!s) return "https://shopbanao.in";
  if (s.custom_domain) return `https://${s.custom_domain}`;
  if (s.slug) return `https://${s.slug}.shopbanao.in`;
  return "https://shopbanao.in";
}

type RedirectOpts = {
  status?: 301 | 302;
  // seconds — browser-only cache. Omit for no-store.
  maxAge?: number;
  // optional store host to hint preconnect for the final PDP TLS handshake.
  preconnectHost?: string;
};

function redirect(to: string, opts: RedirectOpts = {}): Response {
  const status = opts.status ?? 302;
  const headers: Record<string, string> = { Location: to };
  headers["Cache-Control"] = opts.maxAge
    ? `public, max-age=${opts.maxAge}`
    : "no-store";
  // Link: rel=preconnect hint — some browsers act on it even for 3xx.
  if (opts.preconnectHost) {
    headers["Link"] = `<https://${opts.preconnectHost}>; rel=preconnect; crossorigin`;
  }
  return new Response(null, { status, headers });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const token = (parts[parts.length - 1] || "").trim();
  if (!token || token === "wa-r") return redirect("https://shopbanao.in");

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
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
        // Tracking URLs can be added/changed later → short 60s browser cache.
        return redirect((o as any).tracking_url, { status: 302, maxAge: 60 });
      }
      // Order page URL is stable forever (UUID) → 301 + 1 day browser cache.
      return redirect(`${base}/account/orders/${(o as any).id}`, {
        status: 301,
        maxAge: 86400,
        preconnectHost: host,
      });
    }
    if (kind === "c-") {
      const { data: c } = await admin
        .from("abandoned_carts")
        .select("id, session_token, stores:store_id(name, slug, custom_domain)")
        .eq("id", id).maybeSingle();
      if (!c) return redirect("https://shopbanao.in");
      const base = storeBase((c as any).stores);
      const t = (c as any).session_token || (c as any).id;
      // Cart recovery is session-sensitive → never cache.
      return redirect(`${base}/cart?recover=${encodeURIComponent(String(t))}`);
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
      const slug = (p as any).slug;
      // Product slug CAN change on edit → 302 + 5 min browser cache is the
      // sweet spot: instant back-button, self-heals within 5 min if slug edited.
      return redirect(slug ? `${base}/product/${encodeURIComponent(slug)}` : base, {
        status: 302,
        maxAge: 300,
        preconnectHost: host,
      });
    }
  } catch { /* fallthrough */ }
  return redirect("https://shopbanao.in");
});
