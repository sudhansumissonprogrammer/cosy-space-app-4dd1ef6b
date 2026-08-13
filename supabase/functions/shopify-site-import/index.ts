// Generic Shopify public-JSON importer.
// Migrates a public Shopify catalog (products + collections/categories + galleries)
// into a Storivo store. Images are HOTLINKED to the source CDN (nothing mirrored).
//
// POST { store_slug, source, mode: "categories" | "products", page?: number, wipe?: boolean }
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SKIP_COLLECTIONS = new Set(["all", "frontpage", "shop-all"]);
const PER_PAGE = 250;

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
  s = s.replace(/<\/td>/gi, ": ").replace(/<\/th>/gi, ": ");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<h[1-6][^>]*>/gi, "\n");
  s = s.replace(/<[^>]+>/g, "");
  s = decode(s);
  s = s.replace(/[ \t]+/g, " ").replace(/:\s*\n/g, ": ").replace(/\n\s*\n\s*\n+/g, "\n\n");
  return s.trim();
}

async function getJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 StorivoImporter" } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function listCollections(source: string) {
  const out: any[] = [];
  for (let page = 1; page <= 5; page++) {
    const j = await getJson(`${source}/collections.json?limit=250&page=${page}`);
    const arr = j?.collections;
    if (!Array.isArray(arr) || !arr.length) break;
    out.push(...arr);
    if (arr.length < 250) break;
  }
  return out.filter((c) => !SKIP_COLLECTIONS.has(String(c.handle)) && (c.products_count ?? 1) > 0);
}

/** handle -> collection title (first match wins, smaller collections win) */
async function buildCategoryMap(source: string, cols: any[]) {
  const map = new Map<string, string>();
  const ordered = [...cols].sort(
    (a, b) => (a.products_count ?? 0) - (b.products_count ?? 0),
  );
  for (const c of ordered) {
    for (let page = 1; page <= 4; page++) {
      const j = await getJson(`${source}/collections/${c.handle}/products.json?limit=250&page=${page}`);
      const arr = j?.products;
      if (!Array.isArray(arr) || !arr.length) break;
      for (const p of arr) {
        if (!map.has(p.handle)) map.set(p.handle, decode(String(c.title)));
      }
      if (arr.length < 250) break;
    }
  }
  return map;
}

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
    const mode = String(body.mode || "products");
    const page = Number(body.page || 1);
    const wipe = body.wipe === true;
    if (!storeSlug || !source) throw new Error("store_slug and source are required");

    const { data: store, error: storeErr } = await supabase
      .from("stores")
      .select("id, slug, currency")
      .eq("slug", storeSlug)
      .maybeSingle();
    if (storeErr) throw storeErr;
    if (!store) throw new Error(`store ${storeSlug} not found`);
    const storeId = store.id as string;

    if (wipe) {
      const { data: old } = await supabase.from("products").select("id").eq("store_id", storeId);
      const ids = (old || []).map((r: any) => r.id);
      for (let i = 0; i < ids.length; i += 200) {
        await supabase.from("product_images").delete().in("product_id", ids.slice(i, i + 200));
      }
      await supabase.from("products").delete().eq("store_id", storeId);
      await supabase.from("categories").delete().eq("store_id", storeId);
    }

    const cols = await listCollections(source);

    // ── categories mode ──
    if (mode === "categories") {
      const rows = cols
        .sort((a, b) => String(a.title).localeCompare(String(b.title)))
        .map((c, i) => ({
          store_id: storeId,
          name: decode(String(c.title)),
          slug: String(c.handle),
          image_url: c.image?.src ?? null,
          display_order: i,
          show_on_home: true,
        }));
      // fill missing images with first product image of that collection
      for (const r of rows) {
        if (r.image_url) continue;
        const j = await getJson(`${source}/collections/${r.slug}/products.json?limit=1`);
        r.image_url = j?.products?.[0]?.images?.[0]?.src ?? null;
      }
      if (rows.length) {
        const { error } = await supabase
          .from("categories")
          .upsert(rows, { onConflict: "store_id,slug" });
        if (error) throw new Error(`categories: ${error.message}`);
      }
      return json({ ok: true, mode, categories: rows.length });
    }

    // ── products mode (one page of 250) ──
    const catMap = await buildCategoryMap(source, cols);
    const feed = await getJson(`${source}/products.json?limit=${PER_PAGE}&page=${page}`);
    const products: any[] = feed?.products ?? [];
    if (!products.length) return json({ ok: true, mode, page, products: 0, hasMore: false });

    const baseOrder = (page - 1) * PER_PAGE;
    const prodRows = products.map((p: any, i: number) => {
      const v = (p.variants || [])[0] || {};
      const sell = Number(v.price ?? 0) || 0;
      const cmp = v.compare_at_price ? Number(v.compare_at_price) : null;
      const reg = cmp && cmp > sell ? cmp : sell;
      const sale = cmp && cmp > sell ? sell : null;
      const anyAvail = (p.variants || []).some((x: any) => x.available);
      const gallery = (p.images || [])
        .slice(0, 8)
        .map((im: any) => String(im.src || ""))
        .filter(Boolean);
      const name = decode(String(p.title));
      return {
        store_id: storeId,
        name,
        slug: String(p.handle),
        description: htmlToText(p.body_html) || null,
        price: reg,
        sale_price: sale,
        currency: store.currency || "INR",
        sku: v.sku || null,
        stock_quantity: anyAvail ? 25 : 0,
        is_active: true,
        image_url: gallery[0] ?? null,
        image_alt: name,
        category: catMap.get(p.handle) ?? (p.product_type ? decode(String(p.product_type)) : null),
        display_order: baseOrder + i,
        source_platform: "shopify",
        source_id: String(p.id),
        _gallery: gallery,
      };
    });

    const inserted: Record<string, string> = {};
    for (let i = 0; i < prodRows.length; i += 50) {
      const chunk = prodRows.slice(i, i + 50).map(({ _gallery, ...r }) => r);
      const { data, error } = await supabase
        .from("products")
        .upsert(chunk, { onConflict: "store_id,slug" })
        .select("id, slug");
      if (error) throw new Error(`products @${i}: ${error.message}`);
      for (const r of data || []) inserted[r.slug] = r.id;
    }

    const pids = Object.values(inserted);
    for (let i = 0; i < pids.length; i += 200) {
      await supabase.from("product_images").delete().in("product_id", pids.slice(i, i + 200));
    }
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

    return json({
      ok: true,
      mode,
      page,
      products: Object.keys(inserted).length,
      gallery_images: imgRows.length,
      hasMore: products.length === PER_PAGE,
    });
  } catch (e) {
    console.error("shopify-site-import failed", e);
    return json({ ok: false, error: String((e as any)?.message || e) }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
