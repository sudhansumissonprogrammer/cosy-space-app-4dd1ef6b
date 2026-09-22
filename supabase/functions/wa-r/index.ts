// Branded WhatsApp button redirector.
// URL: https://shopbanao.in/r/<token>  → index.html inline script forwards
// here → 301/302 to the store's real page.
//
// Token formats:
//   o-<order_uuid>      → /account/orders/<id> on store's domain  (stable → 301 + long cache)
//   t-<order_uuid>      → prefilled Speed Post Track page (fall back to order page)
//   r-<order_uuid>      → /checkout?recover_order=<id> on store's domain (302 no-store)
//   c-<cart_id_or_token>→ /cart?recover=<token> on store's domain (302 no-store)
//   p-<product_uuid>    → /product/<slug> on store's domain       (302 + medium cache)
//   r-<order_uuid>      → /checkout?product=<id> payment retry    (302 no-store)
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
import { mintSessionForPhone, type MintedSession } from "../_shared/wa-mint-session.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// Module-scope client → connection pool + TLS reuse across invocations.
const admin = createClient(SUPABASE_URL, SERVICE_KEY);

function speedPostTrackingUrl(awb: string): string {
  const payload = btoa(JSON.stringify({ t: awb.trim(), c: "speedpost" }));
  return `https://speedposttrack.io/tracking-result?d=${encodeURIComponent(payload)}&utm_source=copy&utm_medium=share&utm_campaign=parcel_tracking`;
}

/**
 * Kick off a pre-mint as early as possible (in parallel with the DB lookup)
 * so the storefront lands with a full session already in-hand, skipping the
 * wa-autologin round-trip entirely on the client. Falls back gracefully to
 * the signed `?al=` token when mint fails or phone is missing.
 */
function startPreMint(rawPhone: string | null | undefined): Promise<MintedSession | null> {
  const p = canonicalPhone(rawPhone || "");
  if (!p) return Promise.resolve(null);
  // Fire immediately — do NOT await here. Caller awaits at redirect-emit time.
  return mintSessionForPhone(p, SUPABASE_URL, SERVICE_KEY, ANON_KEY);
}

/**
 * Append a pre-minted session (fragment, no server leak) + fallback signed
 * `?al=` token to the redirect target. Fragment format:
 *   `#als=<access_token>|<refresh_token>|<phone10>`
 * StorefrontAutoLogin consumes the fragment first and skips wa-autologin.
 * Fragment is stripped by history.replaceState immediately after consumption.
 */
/**
 * Marks the redirect target as a WhatsApp-sourced arrival. The client uses
 * this to unlock the store's WhatsApp-exclusive auto-apply coupon on the PDP
 * and at checkout. Added unconditionally (even when auto-login mint fails or
 * the phone is missing) so the discount never depends on the auth fast-path.
 */
function withWaMarker(url: string): string {
  try {
    if (/[?&]wa=1(&|#|$)/.test(url)) return url;
    const hashAt = url.indexOf("#");
    const base = hashAt === -1 ? url : url.slice(0, hashAt);
    const hash = hashAt === -1 ? "" : url.slice(hashAt);
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}wa=1${hash}`;
  } catch {
    return url;
  }
}

async function withAutoLogin(
  url: string,
  rawPhone: string | null | undefined,
  mintPromise?: Promise<MintedSession | null>,
): Promise<string> {
  const phone = canonicalPhone(rawPhone || "");
  if (!phone) return withWaMarker(url);

  // Race pre-mint against a small budget so a slow auth API never blocks the
  // redirect longer than ~800ms. If mint misses, we still ship the signed
  // fallback token and the client will hit wa-autologin as before.
  const budgeted = mintPromise
    ? Promise.race([
        mintPromise,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 800)),
      ])
    : Promise.resolve(null);

  const [minted, token] = await Promise.all([
    budgeted,
    mintAutoLoginToken(phone, SERVICE_KEY),
  ]);

  let out = withWaMarker(url);
  if (token) {
    const sep = out.includes("?") ? "&" : "?";
    out = `${out}${sep}al=${encodeURIComponent(token)}`;
  }
  if (minted?.access_token && minted?.refresh_token) {
    // Fragment placement — after any existing #hash the caller supplied
    // (rare for our routes). Encode phone for good measure.
    const frag = `als=${encodeURIComponent(minted.access_token)}|${encodeURIComponent(minted.refresh_token)}|${minted.phone}`;
    out += (out.includes("#") ? "&" : "#") + frag;
  }
  return out;
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
  const tokenParts = rawId.split("~");
  const id = tokenParts[0] || "";
  const suffixPhone = tokenParts[1] || "";
  // New recovery links retain the store id as a final segment. This lets a
  // deleted/expired product fall back to the correct storefront rather than
  // the ShopBanao landing page. Older two-segment links remain compatible.
  const fallbackStoreId = tokenParts[2] || "";

  const resolveFallbackStore = async (): Promise<{ base: string; host: string } | null> => {
    if (!fallbackStoreId) return null;
    const { data: store } = await admin
      .from("stores")
      .select("slug, custom_domain")
      .eq("id", fallbackStoreId)
      .maybeSingle();
    if (!store) return null;
    const base = storeBase(store);
    return { base, host: base.replace(/^https?:\/\//, "") };
  };

  // Fire-and-forget click log. Never blocks the redirect.
  // NOTE: column names must match public.wa_link_clicks exactly — a previous
  // version inserted token/kind/ref_id/ip_address (non-existent columns), so
  // every insert silently failed and click tracking recorded zero rows.
  const ua = req.headers.get("user-agent") || "";
  const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "";
  admin.from("wa_link_clicks").insert({
    short_id: token.slice(0, 128),
    target_url: `${kind}${id}`,
    recipient_phone: suffixPhone ? canonicalPhone(suffixPhone) : null,
    user_agent: ua.slice(0, 256),
    ip_hash: ip.split(",")[0].trim() || null,
  } as any).then(() => {}, () => {});


  try {
    if (kind === "o-" || kind === "t-") {
      const { data: o } = await admin
        .from("orders")
        .select("id, tracking_url, tracking_number, customer_phone, stores:store_id(name, slug, custom_domain)")
        .eq("id", id).maybeSingle();
      if (!o) return redirect("https://shopbanao.in");
      const storeRow = (o as any).stores;
      const base = storeBase(storeRow);
      const host = base.replace(/^https?:\/\//, "");
      const phone = (o as any).customer_phone as string | null;
      if (kind === "t-") {
        const awb = String((o as any).tracking_number || "").trim();
        if (awb) {
          return redirect(speedPostTrackingUrl(awb), {
            status: 302,
            maxAge: 0,
            preconnectHosts: ["speedposttrack.io"],
          });
        }
      }
      const mintP = startPreMint(phone);
      const target = await withAutoLogin(
        `${base}/account/orders/${(o as any).id}`,
        phone,
        mintP,
      );
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
      const mintP = startPreMint(phone);
      const target = await withAutoLogin(
        `${base}/cart?recover=${encodeURIComponent(String(t))}`,
        phone,
        mintP,
      );
      return redirect(target, { preconnectHosts: [host] });
    }
    // Payment-retry / order-recover deep link. Handles the "r-" prefix.
    if (kind === "r-") {
      const { data: o } = await admin
        .from("orders")
        .select("id, customer_phone, stores:store_id(name, slug, custom_domain), order_items(product_id, quantity)")
        .eq("id", id)
        .maybeSingle();
      if (!o) return redirect("https://shopbanao.in");

      const base = storeBase((o as any).stores);
      const host = base.replace(/^https?:\/\//, "");
      const items = Array.isArray((o as any).order_items) ? (o as any).order_items : [];
      const firstItem = items.find((it: any) => it?.product_id) || items[0];
      const retryProductId = firstItem?.product_id;
      const effectivePhone = (o as any).customer_phone || suffixPhone;
      const mintP = startPreMint(effectivePhone);
      if (!retryProductId) {
        const fallback = await withAutoLogin(`${base}/account/orders/${encodeURIComponent(id)}`, effectivePhone, mintP);
        return redirect(fallback, { status: 302, maxAge: 0, preconnectHosts: [host] });
      }

      // 🚫 Dead-link guard: the merchant may have disabled the product after
      // the message was queued. Checkout would render an empty/broken cart, so
      // land the shopper on the store home (still auto-logged + wa=1) instead.
      const { data: rp } = await admin
        .from("products").select("is_active").eq("id", retryProductId).maybeSingle();
      if (!rp || (rp as any).is_active === false) {
        const home = await withAutoLogin(base, effectivePhone, mintP);
        return redirect(home, { status: 302, maxAge: 0, preconnectHosts: [host] });
      }

      const qty = Math.max(1, Number(firstItem?.quantity || 1));
      const target = await withAutoLogin(
        `${base}/checkout?product=${encodeURIComponent(retryProductId)}&qty=${encodeURIComponent(String(qty))}&v2=1&recover=order`,
        effectivePhone,
        mintP,
      );
      return redirect(target, { status: 302, maxAge: 0, preconnectHosts: [host, "cdn.shopbanao.in"] });
    }
    if (kind === "p-") {
      // Fire pre-mint IMMEDIATELY (parallel with products lookup) — the phone
      // is already known from the token suffix, so there's no dependency on
      // the DB. This is the highest-value optimisation: on a warm auth API
      // the mint finishes before the products query, adding zero latency.
      const mintP = startPreMint(suffixPhone);

      const { data: p } = await admin
        .from("products")
        .select("id, slug, is_active, stores:store_id(name, slug, custom_domain)")
        .eq("id", id).maybeSingle();
      if (!p) {
        const fallbackStore = await resolveFallbackStore();
        if (!fallbackStore) return redirect("https://shopbanao.in");
        return redirect(await withAutoLogin(fallbackStore.base, suffixPhone, mintP), {
          status: 302,
          maxAge: 0,
          preconnectHosts: [fallbackStore.host],
        });
      }
      const storeRow = (p as any).stores;
      const base = storeBase(storeRow);
      const host = base.replace(/^https?:\/\//, "");
      const slug = (p as any).slug as string | undefined;
      // Merchant disabled the product after the message was queued → the PDP
      // renders "Product not found". Land the shopper on the storefront home
      // instead of a dead end so the click still has a chance to convert.
      if ((p as any).is_active === false) {
        return redirect(await withAutoLogin(base, suffixPhone, mintP), {
          status: 302,
          maxAge: 0,
          preconnectHosts: [host, "cdn.shopbanao.in"],
        });
      }

      // No slug → home, but keep the auto-login + wa=1 markers so the shopper
      // stays logged in and still unlocks the WhatsApp-exclusive coupon.
      if (!slug) {
        return redirect(await withAutoLogin(base, suffixPhone, mintP), {
          status: 302,
          maxAge: 0,
          preconnectHosts: [host],
        });
      }

      // Parallel: hero image lookup + storefront cache warm.
      const heroPromise = getHeroImage((p as any).id);
      warmStorefront(host, slug);

      const hero = await heroPromise;
      const pdpApi = `${base}/api/pdp?slug=${encodeURIComponent(slug)}`;

      const target = await withAutoLogin(
        `${base}/product/${encodeURIComponent(slug)}`,
        suffixPhone,
        mintP,
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
  } catch {
    // A valid store hint survives product deletion and temporary lookup
    // failures, so recovery shoppers still remain inside the merchant store.
    const fallbackStore = await resolveFallbackStore().catch(() => null);
    if (fallbackStore) {
      return redirect(await withAutoLogin(fallbackStore.base, suffixPhone).catch(() => withWaMarker(fallbackStore.base)), {
        status: 302,
        maxAge: 0,
        preconnectHosts: [fallbackStore.host],
      });
    }
  }
  return redirect("https://shopbanao.in");
});

