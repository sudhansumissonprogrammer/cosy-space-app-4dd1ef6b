// Generic Shopify public-JSON importer.
// Migrates a public Shopify catalog (products + collections/categories + galleries)
// into a Storivo store. Images are HOTLINKED to the source CDN (nothing mirrored).
//
// POST {
//   store_slug, source,
//   mode: "categories" | "products",
//   page?: number, pages?: number,           // products mode: start page + how many pages
//   include?: [{ title, handles: string[] }],// curated category groups (optional)
//   wipe?: boolean
// }
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SKIP_COLLECTIONS = new Set(["all", "frontpage", "shop-all"]);
const PER_PAGE = 250;

type Group = { title: string; handles: string[]; slug: string };

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 StorivoImporter" } });
      if (res.ok) return await res.json();
      if (res.status === 404) return null;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
  }
  return null;
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

async function collectionProducts(source: string, handle: string) {
  const out: any[] = [];
  for (let page = 1; page <= 8; page++) {
    const j = await getJson(`${source}/collections/${handle}/products.json?limit=250&page=${page}`);
    const arr = j?.products;
    if (!Array.isArray(arr) || !arr.length) break;
    out.push(...arr);
    if (arr.length < 250) break;
  }
  return out;
}

/** Build the curated groups: explicit `include` wins, else one group per collection. */
function resolveGroups(cols: any[], include?: any[]): Group[] {
  if (Array.isArray(include) && include.length) {
    return include
      .filter((g) => g?.title && Array.isArray(g.handles) && g.handles.length)
      .map((g) => ({
        title: String(g.title),
        handles: g.handles.map(String),
        slug: String(g.slug || slugify(String(g.title))),
      }));
  }
  return [...cols]
    .sort((a, b) => (a.products_count ?? 0) - (b.products_count ?? 0))
    .map((c) => ({
      title: decode(String(c.title)),
      handles: [String(c.handle)],
      slug: String(c.handle),
    }));
}

/** product handle -> category title (groups are evaluated in the order supplied) */
async function buildCategoryMap(source: string, groups: Group[]) {
  const map = new Map<string, string>();
  for (const g of groups) {
    for (const h of g.handles) {
      const prods = await collectionProducts(source, h);
      for (const p of prods) if (!map.has(p.handle)) map.set(p.handle, g.title);
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
    const startPage = Math.max(1, Number(body.page || 1));
    const pageCount = Math.max(1, Math.min(6, Number(body.pages || 1)));
    const include = body.include;
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
    const groups = resolveGroups(cols, include);

    // ── categories mode ──
    if (mode === "categories") {
      const byHandle = new Map(cols.map((c) => [String(c.handle), c]));
      const rows: any[] = [];
      for (let i = 0; i < groups.length; i++) {
        const g = groups[i];
        let img: string | null = null;
        for (const h of g.handles) {
          img = byHandle.get(h)?.image?.src ?? null;
          if (img) break;
        }
        if (!img) {
          for (const h of g.handles) {
            const j = await getJson(`${source}/collections/${h}/products.json?limit=1`);
            img = j?.products?.[0]?.images?.[0]?.src ?? null;
            if (img) break;
          }
        }
        rows.push({
          store_id: storeId,
          name: g.title,
          slug: g.slug,
          image_url: img,
          display_order: i,
          show_on_home: true,
        });
      }
      if (rows.length) {
        const { error } = await supabase
          .from("categories")
          .upsert(rows, { onConflict: "store_id,slug" });
        if (error) throw new Error(`categories: ${error.message}`);
      }
      return json({ ok: true, mode, categories: rows.length, names: rows.map((r) => r.name) });
    }

    // ── products mode ──
    const catMap = await buildCategoryMap(source, groups);
    let totalProducts = 0;
    let totalImages = 0;
    let hasMore = true;
    let lastPage = startPage - 1;

    for (let page = startPage; page < startPage + pageCount; page++) {
      const feed = await getJson(`${source}/products.json?limit=${PER_PAGE}&page=${page}`);
      const products: any[] = feed?.products ?? [];
      lastPage = page;
      if (!products.length) {
        hasMore = false;
        break;
      }

      const baseOrder = (page - 1) * PER_PAGE;
      const prodRows = products.map((p: any, i: number) => {
        const variants = Array.isArray(p.variants) ? p.variants : [];
        const priced = variants.filter((v: any) => Number(v.price) > 0);
        const v = priced[0] || variants[0] || {};
        const sell = Number(v.price ?? 0) || 0;
        const cmp = v.compare_at_price ? Number(v.compare_at_price) : null;
        const reg = cmp && cmp > sell ? cmp : sell;
        const sale = cmp && cmp > sell ? sell : null;
        const anyAvail = variants.some((x: any) => x.available);
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
          category:
            catMap.get(p.handle) ?? (p.product_type ? decode(String(p.product_type)) : null),
          display_order: baseOrder + i,
          source_platform: "shopify",
          source_id: String(p.id),
          _gallery: gallery,
        };
      }).filter((r: any) => r.price > 0 && r.image_url);

      const inserted: Record<string, string> = {};
      for (let i = 0; i < prodRows.length; i += 50) {
        const chunk = prodRows.slice(i, i + 50).map(({ _gallery, ...r }: any) => r);
        const { data, error } = await supabase
          .from("products")
          .upsert(chunk, { onConflict: "store_id,slug" })
          .select("id, slug");
        if (error) throw new Error(`products p${page}@${i}: ${error.message}`);
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
        if (error) throw new Error(`product_images p${page}@${i}: ${error.message}`);
      }

      totalProducts += Object.keys(inserted).length;
      totalImages += imgRows.length;
      if (products.length < PER_PAGE) {
        hasMore = false;
        break;
      }
    }

    return json({
      ok: true,
      mode,
      from: startPage,
      to: lastPage,
      products: totalProducts,
      gallery_images: totalImages,
      hasMore,
      nextPage: hasMore ? lastPage + 1 : null,
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
