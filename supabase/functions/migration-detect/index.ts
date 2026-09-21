/**
 * migration-detect — Test a source connection and return record counts.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  shopifyCountProducts,
  shopifyCountCollections,
  shopifyCountOrders,
  shopifyCountCustomers,
} from "../_shared/migration/shopify.ts";
import {
  wooCountProducts,
  wooCountCategories,
  wooCountOrders,
  wooCountCustomers,
} from "../_shared/migration/woocommerce.ts";
import { discoverProductUrls, inspectPublicSite } from "../_shared/migration/generic.ts";
import { assertSafePublicUrl } from "../_shared/migration/safe-fetch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: claims } = await supabase.auth.getClaims(auth.replace("Bearer ", ""));
    if (!claims?.claims?.sub) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const platform = String(body.platform || "auto").toLowerCase();
    const sourceUrl = String(body.source_url || "").trim();
    const creds = (body.credentials ?? {}) as Record<string, string>;

    if (!sourceUrl) return json({ error: "source_url is required" }, 400);
    const normalizedUrl = assertSafePublicUrl(sourceUrl).toString();

    if (platform === "auto") {
      const profile = await inspectPublicSite(normalizedUrl);
      const urls = await discoverProductUrls(normalizedUrl, 500).catch(() => [] as string[]);
      return json({ ok: true, platform: profile.platform, import_platform: "generic", counts: { products: urls.length, collections: 0, pages: profile.pages.length, orders: 0, customers: 0 }, profile, warnings: urls.length ? [] : ["No public product pages were found. You can still create the store and retry later."] });
    }

    if (platform === "shopify") {
      const token = creds.access_token?.trim();
      if (!token) return json({ error: "access_token is required for Shopify" }, 400);
      const host = sourceUrl.replace(/^https?:\/\//, "").replace(/\/.*/, "");
      const [products, collections, orders, customers] = await Promise.all([
        shopifyCountProducts(host, token).catch(() => -1),
        shopifyCountCollections(host, token).catch(() => 0),
        shopifyCountOrders(host, token).catch(() => 0),
        shopifyCountCustomers(host, token).catch(() => 0),
      ]);
      if (products < 0) return json({ error: "Could not reach Shopify. Check your URL and token." }, 400);
      return json({ ok: true, counts: { products, collections, orders, customers } });
    }

    if (platform === "woocommerce") {
      const key = creds.consumer_key?.trim();
      const secret = creds.consumer_secret?.trim();
      if (!key || !secret) return json({ error: "consumer_key and consumer_secret are required for WooCommerce" }, 400);
      const host = sourceUrl.replace(/^https?:\/\//, "").replace(/\/.*/, "");
      const [products, collections, orders, customers] = await Promise.all([
        wooCountProducts(host, key, secret).catch((e) => { console.error("[woo count]", e); return -1; }),
        wooCountCategories(host, key, secret).catch(() => 0),
        wooCountOrders(host, key, secret).catch(() => 0),
        wooCountCustomers(host, key, secret).catch(() => 0),
      ]);
      if (products < 0) return json({ error: "Could not reach WooCommerce. Check your URL and API keys (needs read access)." }, 400);
      return json({ ok: true, counts: { products, collections, orders, customers } });
    }

    if (platform === "generic" || platform === "dukaan") {
      const urls = await discoverProductUrls(normalizedUrl, 500).catch(() => [] as string[]);
      if (!urls.length) {
        return json({
          error: "No product URLs found in the site's sitemap. The store may not expose /sitemap.xml or product pages use an unusual URL structure.",
        }, 400);
      }
      const profile = await inspectPublicSite(normalizedUrl).catch(() => null);
      return json({ ok: true, platform: profile?.platform ?? platform, import_platform: "generic", counts: { products: urls.length, collections: 0, pages: profile?.pages.length ?? 0, orders: 0, customers: 0 }, profile });
    }

    return json({ error: `Platform "${platform}" is not yet supported.` }, 400);
  } catch (err) {
    console.error("[migration-detect] error:", err);
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
