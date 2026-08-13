// Shopify public-JSON collection importer with FULL media (images + video).
//
// Imports one Shopify collection into a Storivo store as a single category.
// Images are HOTLINKED to the source CDN (nothing mirrored). Product videos
// come from /products/<handle>.js (media array), which products.json omits.
//
// POST {
//   store_slug, source, collection,
//   category_title?, category_slug?,
//   offset?: number, size?: number,   // batch window over the collection
//   dry_run?: boolean
// }
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
    await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
  }
  return null;
}

/** Full ordered media for one product: gallery images + best-quality video. */
async function productMedia(source: string, handle: string) {
  const j = await getJson(`${source}/products/${handle}.js`);
  const media: any[] = Array.isArray(j?.media) ? j.media : [];
  const images: string[] = [];
  let videoUrl: string | null = null;
  let videoPoster: string | null = null;

  for (const m of media.sort((a, b) => (a.position ?? 0) - (b.position ?? 0))) {
    if (m.media_type === "image") {
      const src = String(m.src || m.preview_image?.src || "");
      if (src) images.push(src.startsWith("//") ? `https:${src}` : src);
    } else if (
      (m.media_type === "video" || m.media_type === "external_video") &&
      !videoUrl
    ) {
      const sources = (m.sources || []).filter((s: any) => s.mime_type === "video/mp4");
      // Prefer the highest resolution capped at 1080p (keeps quality, avoids 4K weight)
      const pick =
        sources
          .filter((s: any) => Number(s.height || 0) <= 1080)
          .sort((a: any, b: any) => Number(b.height || 0) - Number(a.height || 0))[0] ||
        sources[0];
      if (pick?.url) {
        videoUrl = String(pick.url);
        videoPoster = m.preview_image?.src ? String(m.preview_image.src) : null;
      }
    }
  }
  return { images, videoUrl, videoPoster, ok: media.length > 0 };
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
    const collection = String(body.collection || "");
    const offset = Math.max(0, Number(body.offset || 0));
    const size = Math.max(1, Math.min(60, Number(body.size || 40)));
    if (!storeSlug || !source || !collection) {
      throw new Error("store_slug, source and collection are required");
    }

    const { data: store, error: storeErr } = await supabase
      .from("stores")
      .select("id, slug, currency")
      .eq("slug", storeSlug)
      .maybeSingle();
    if (storeErr) throw storeErr;
    if (!store) throw new Error(`store ${storeSlug} not found`);
    const storeId = store.id as string;

    // ── collection meta + category row ──
    const colMeta = await getJson(`${source}/collections/${collection}.json`);
    const catTitle = String(body.category_title || decode(String(colMeta?.collection?.title || collection)));
    const catSlug = String(body.category_slug || collection);

    if (offset === 0) {
      const { data: existing } = await supabase
        .from("categories")
        .select("id, display_order")
        .eq("store_id", storeId)
        .eq("slug", catSlug)
        .maybeSingle();
      const { count } = await supabase
        .from("categories")
        .select("id", { count: "exact", head: true })
        .eq("store_id", storeId);
      const { error: catErr } = await supabase.from("categories").upsert(
        {
          store_id: storeId,
          name: catTitle,
          slug: catSlug,
          image_url: colMeta?.collection?.image?.src ?? null,
          display_order: existing?.display_order ?? (count ?? 0),
          show_on_home: true,
        },
        { onConflict: "store_id,slug" },
      );
      if (catErr) throw new Error(`category: ${catErr.message}`);
    }

    // ── collection product list (full, then window) ──
    const all: any[] = [];
    for (let page = 1; page <= 8; page++) {
      const j = await getJson(`${source}/collections/${collection}/products.json?limit=250&page=${page}`);
      const arr = j?.products;
      if (!Array.isArray(arr) || !arr.length) break;
      all.push(...arr);
      if (arr.length < 250) break;
    }
    const total = all.length;
    const slice = all.slice(offset, offset + size);

    if (body.dry_run === true) {
      return json({ ok: true, total, category: catTitle, slug: catSlug, window: slice.length });
    }

    const rows: any[] = [];
    const skipped: string[] = [];

    for (let i = 0; i < slice.length; i++) {
      const p = slice[i];
      const variants = Array.isArray(p.variants) ? p.variants : [];
      const priced = variants.filter((v: any) => Number(v.price) > 0);
      const v = priced[0] || variants[0] || {};
      const sell = Number(v.price ?? 0) || 0;
      const cmp = v.compare_at_price ? Number(v.compare_at_price) : null;
      const reg = cmp && cmp > sell ? cmp : sell;
      const sale = cmp && cmp > sell ? sell : null;
      const anyAvail = variants.some((x: any) => x.available);
      const name = decode(String(p.title));

      const media = await productMedia(source, String(p.handle));
      // Fallback to products.json images if the .js endpoint hiccuped
      const gallery = media.images.length
        ? media.images
        : (p.images || []).map((im: any) => String(im.src || "")).filter(Boolean);

      if (!(reg > 0) || !gallery.length) {
        skipped.push(String(p.handle));
        continue;
      }

      rows.push({
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
        image_url: gallery[0],
        image_alt: name,
        category: catTitle,
        display_order: offset + i,
        video_url: media.videoUrl,
        video_poster_url: media.videoPoster,
        source_platform: "shopify",
        source_id: String(p.id),
        _gallery: gallery.slice(0, 12),
      });
    }

    const inserted: Record<string, string> = {};
    for (let i = 0; i < rows.length; i += 40) {
      const chunk = rows.slice(i, i + 40).map(({ _gallery, ...r }: any) => r);
      const { data, error } = await supabase
        .from("products")
        .upsert(chunk, { onConflict: "store_id,slug" })
        .select("id, slug");
      if (error) throw new Error(`products @${offset}+${i}: ${error.message}`);
      for (const r of data || []) inserted[r.slug] = r.id;
    }

    const pids = Object.values(inserted);
    for (let i = 0; i < pids.length; i += 200) {
      await supabase.from("product_images").delete().in("product_id", pids.slice(i, i + 200));
    }

    const imgRows: any[] = [];
    for (const p of rows) {
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

    const nextOffset = offset + size;
    return json({
      ok: true,
      category: catTitle,
      total,
      from: offset,
      to: Math.min(nextOffset, total),
      products: Object.keys(inserted).length,
      gallery_images: imgRows.length,
      videos: rows.filter((r) => r.video_url).length,
      skipped,
      hasMore: nextOffset < total,
      nextOffset: nextOffset < total ? nextOffset : null,
    });
  } catch (e) {
    console.error("shopify-collection-import failed", e);
    return json({ ok: false, error: String((e as any)?.message || e) }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
