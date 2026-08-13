// Generic WooCommerce Store-API importer.
// Migrates a public WooCommerce catalog (products + categories + galleries) into
// a Storivo store. Images are HOTLINKED to the source site (nothing mirrored to R2).
//
// POST { store_slug: "watchtrade", source: "https://watchtrade.in", wipe?: true }
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&#x27;|&rsquo;|&#8217;/g, "'")
    .replace(/&nbsp;|\u00a0/g, " ")
    .replace(/&#8377;/g, "₹")
    .replace(/&ndash;|&#8211;/g, "–")
    .replace(/&mdash;|&#8212;/g, "—")
    .replace(/&hellip;/g, "…")
    .replace(/&#(\d+);/g, (_m, d) => String.fromCharCode(Number(d)));
}

function htmlToText(h?: string): string {
  if (!h) return "";
  let s = h;
  s = s.replace(/<\/(p|div|h[1-6]|ul|ol|tr)>/gi, "\n\n");
  s = s.replace(/<li[^>]*>/gi, "• ").replace(/<\/li>/gi, "\n");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<h[1-6][^>]*>/gi, "\n");
  s = s.replace(/<[^>]+>/g, "");
  s = decode(s);
  s = s.replace(/[ \t]+/g, " ").replace(/\n\s*\n\s*\n+/g, "\n\n");
  return s.trim();
}

/** Smallest srcset candidate >= 700w, else largest. Keeps payloads sane while hotlinked. */
function bestSrc(img: any): string | null {
  const full = img?.src || null;
  const srcset: string = img?.srcset || "";
  if (!srcset) return full;
  const cands = srcset
    .split(",")
    .map((part) => part.trim().split(/\s+/))
    .filter((a) => a.length === 2 && a[1].endsWith("w"))
    .map((a) => ({ url: a[0], w: parseInt(a[1], 10) }))
    .filter((c) => c.url && !Number.isNaN(c.w))
    .sort((a, b) => a.w - b.w);
  if (!cands.length) return full;
  const pick = cands.find((c) => c.w >= 700) || cands[cands.length - 1];
  return pick.url || full;
}

const money = (c: string | null | undefined, minor = 2) =>
  c === null || c === undefined || c === ""
    ? null
    : Math.round(Number(c)) / Math.pow(10, minor);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const storeSlug = String(body.store_slug || "");
    const source = String(body.source || "").replace(/\/+$/, "");
    const wipe = body.wipe !== false;
    if (!storeSlug || !source) throw new Error("store_slug and source are required");
    const SRC = `${source}/wp-json/wc/store/v1`;

    const { data: store, error: storeErr } = await supabase
      .from("stores")
      .select("id, slug, currency")
      .eq("slug", storeSlug)
      .maybeSingle();
    if (storeErr) throw storeErr;
    if (!store) throw new Error(`store ${storeSlug} not found`);
    const storeId = store.id as string;

    // ── 1. Pull source catalog ──
    const products: any[] = [];
    for (let page = 1; page <= 30; page++) {
      const res = await fetch(`${SRC}/products?per_page=100&page=${page}`);
      if (!res.ok) break;
      const batch = await res.json();
      if (!Array.isArray(batch) || batch.length === 0) break;
      products.push(...batch);
      if (batch.length < 100) break;
    }
    const catsRes = await fetch(`${SRC}/products/categories?per_page=100`);
    const srcCats: any[] = catsRes.ok ? await catsRes.json() : [];
    if (products.length === 0) throw new Error("no products fetched from source");

    // ── 2. Wipe existing catalog for this store ──
    if (wipe) {
      const { data: old } = await supabase.from("products").select("id").eq("store_id", storeId);
      const ids = (old || []).map((r: any) => r.id);
      for (let i = 0; i < ids.length; i += 200) {
        await supabase.from("product_images").delete().in("product_id", ids.slice(i, i + 200));
      }
      await supabase.from("products").delete().eq("store_id", storeId);
      await supabase.from("categories").delete().eq("store_id", storeId);
    }

    // ── 3. Categories (source image, fallback = first product image) ──
    const catImg: Record<string, string> = {};
    for (const p of products) {
      for (const c of p.categories || []) {
        if (!catImg[c.slug] && p.images?.[0]) catImg[c.slug] = bestSrc(p.images[0]) as string;
      }
    }
    const catRows = srcCats
      .filter((c) => (c.count ?? 0) > 0)
      .sort((a, b) => String(a.name).localeCompare(String(b.name)))
      .map((c, i) => ({
        store_id: storeId,
        name: decode(String(c.name)),
        slug: String(c.slug),
        image_url: (c.image ? bestSrc(c.image) : null) ?? catImg[c.slug] ?? null,
        display_order: i,
        show_on_home: true,
      }));
    if (catRows.length) {
      const { error } = await supabase.from("categories").insert(catRows);
      if (error) throw new Error(`categories: ${error.message}`);
    }

    // ── 4. Products ──
    const seen = new Set<string>();
    const prodRows = products.map((p: any, i: number) => {
      let slug = String(p.slug || "").trim() || `product-${p.id}`;
      if (seen.has(slug)) slug = `${slug}-${p.id}`;
      seen.add(slug);
      const minor = Number(p.prices?.currency_minor_unit ?? 2);
      const reg = money(p.prices?.regular_price, minor) ?? money(p.prices?.price, minor) ?? 0;
      let sale = money(p.prices?.sale_price, minor);
      if (sale !== null && sale >= reg) sale = null;
      const desc = [htmlToText(p.description), htmlToText(p.short_description)]
        .filter(Boolean)
        .join("\n\n");
      return {
        store_id: storeId,
        name: decode(String(p.name)),
        slug,
        description: desc || null,
        price: reg,
        sale_price: sale,
        currency: store.currency || "INR",
        sku: p.sku || null,
        stock_quantity: p.is_in_stock ? 25 : 0,
        is_active: true,
        image_url: p.images?.[0] ? bestSrc(p.images[0]) : null,
        image_alt: decode(String(p.name)),
        category: p.categories?.[0]?.name ? decode(String(p.categories[0].name)) : null,
        display_order: i,
        source_platform: "woocommerce",
        source_id: String(p.id),
        _gallery: (p.images || []).slice(0, 8).map((im: any) => bestSrc(im)).filter(Boolean),
      };
    });

    const inserted: Record<string, string> = {};
    for (let i = 0; i < prodRows.length; i += 50) {
      const chunk = prodRows.slice(i, i + 50).map(({ _gallery, ...r }) => r);
      const { data, error } = await supabase.from("products").insert(chunk).select("id, slug");
      if (error) throw new Error(`products @${i}: ${error.message}`);
      for (const r of data || []) inserted[r.slug] = r.id;
    }

    // ── 5. Gallery images (hotlinked source URLs) ──
    const imgRows: any[] = [];
    for (const p of prodRows) {
      const pid = inserted[p.slug];
      if (!pid) continue;
      p._gallery.forEach((u: string, j: number) => {
        imgRows.push({ product_id: pid, image_url: u, display_order: j, image_alt: p.name });
      });
    }
    for (let i = 0; i < imgRows.length; i += 200) {
      const { error } = await supabase.from("product_images").insert(imgRows.slice(i, i + 200));
      if (error) throw new Error(`product_images @${i}: ${error.message}`);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        store: storeSlug,
        source,
        source_products: products.length,
        categories: catRows.length,
        products: Object.keys(inserted).length,
        gallery_images: imgRows.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("woo-site-import failed", e);
    return new Response(JSON.stringify({ ok: false, error: String((e as any)?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
