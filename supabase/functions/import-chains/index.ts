// Temporary one-off importer: adds the supplied Blacky/Jewelnex chain products
// into the Imitation World store under the "new-chains" category.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const STORE = "c3c5dff2-173a-4f4d-90e4-8b1c88c305d9";

const BLACKY = [
  "elegant-1-gram-gold-plated-chain-24-inch-daily-wear-classic-single-piece",
  "premium-1-gram-gold-forming-rudraksha-mala-24-inch-elegant-gold-forming-chain-for-daily-wear",
  "one-gram-gold-chain-om-pendant-set",
  "stylish-1-gram-gold-forming-chain-24-inch-one-chain",
  "stylish-1-gram-gold-forming-4-line-chain-24-inch-lightweight-elegant-single-chain",
  "high-brass-gold-chain-with-beautiful-pendent-set-1",
  "stylish-1-gram-gold-forming-chain-24-inch-2-line-chain",
  "18k-gold-coated-pendant-necklace-anti-tarnish-finish-2-line-chain-3",
  "18k-gold-coated-pendant-necklace-anti-tarnish-finish-2-line-chain",
  "1-gram-gold-plated-box-chain-premium-quality",
  "1-gram-gold-plated-chain-for-men-women-24-inch-stylish-daily-wear-jewellery-lightweight-gold-forming-chain",
  "one-gram-gold-chain-pendant-set-with-tops",
  "premium-one-gram-gold-chain-pendant-set",
  "one-gram-gold-chain-pendant-set-6",
  "18k-gold-coated-pendant-necklace-anti-tarnish-finish",
  "stylish-anti-tarnish-18k-gold-coated-steel-chain-for-men-women",
  "trendy-1-gram-gold-plated-chain-minimal-elegant-style-1",
];

const JEWELNEX = [
  "stylish-1-gram-gold-forming-4-line-chain-24-inch-lightweight-elegant-single-chain-1",
  "one-gram-gold-chain-pendant-set-premium",
  "one-gram-gold-chain-pendant-set-premium-quality",
  "one-gram-gold-chain-pendant-set",
  "one-gram-gold-chain-pendant-set-1",
  "one-gram-gold-chain-pendant-set-2",
  "one-gram-gold-chain-pendant-set-3",
  "one-gram-gold-chain-pendant-set-5",
  "1-gram-gold-forming-snake-chain-for-men-women",
  "one-gram-gold-chain-pendant-set-with-matching-tops-for-women-3-line-chain",
  "one-gram-gold-chain-pendant-set-with-tops-1",
  "one-gram-gold-chain-pendant-set-with-tops-2",
  "one-gram-gold-chain-pendant-set-with-tops-3",
  "premium-1-gram-gold-designer-chain-for-daily-use-lightweight-long-lasting-forming-jewelry",
  "premium-one-gram-gold-chain-pendant-set",
  "stylish-1-gram-gold-forming-2-line-chain-24-inch-lightweight-elegant-single-chain",
  "trendy-1-gram-gold-plated-chain-minimal-elegant-style",
];

const strip = (h: string) =>
  h.replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<li>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const slugify = (t: string) =>
  t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70);

async function load(host: string, handle: string) {
  const base = `https://${host}/products/${handle}`;
  const r = await fetch(`${base}.js`, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!r.ok) return null;
  const j = await r.json();
  const videos: { src: string; poster?: string }[] = [];
  for (const m of j.media ?? []) {
    if (m.media_type === "video") {
      const s = (m.sources ?? []).filter((x: any) => x.format === "mp4")
        .sort((a: any, b: any) => (b.height ?? 0) - (a.height ?? 0))[0];
      if (s) videos.push({ src: s.url, poster: m.preview_image?.src });
    }
  }
  return {
    url: base,
    id: String(j.id),
    title: j.title as string,
    body: strip(j.description ?? ""),
    price: j.price / 100,
    compare: (j.compare_at_price ?? 0) / 100,
    sku: j.variants?.[0]?.sku ?? null,
    available: j.available !== false,
    images: ((j.images ?? []) as string[]).map((s) => (s.startsWith("//") ? "https:" + s : s)),
    videos,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const fetched: any[] = [];
  const failed: string[] = [];
  for (const [host, list] of [["blacky.in", BLACKY], ["www.jewelnex.co.in", JEWELNEX]] as const) {
    for (const h of list) {
      try {
        const p = await load(host, h);
        if (p) fetched.push(p); else failed.push(`${host}/${h}`);
      } catch (_e) {
        failed.push(`${host}/${h}`);
      }
    }
  }

  // de-duplicate identical listings across both sources, keeping richest media
  const map = new Map<string, any>();
  for (const p of fetched) {
    const key = p.title.toLowerCase().replace(/[^a-z0-9]/g, "") + "|" + p.price;
    const cur = map.get(key);
    const score = (x: any) => x.images.length + x.videos.length;
    if (!cur || score(p) > score(cur)) map.set(key, p);
  }
  const products = [...map.values()];

  const { data: cat, error: catErr } = await admin
    .from("categories")
    .select("id")
    .eq("store_id", STORE)
    .eq("slug", "new-chains")
    .maybeSingle();
  if (catErr || !cat) {
    return new Response(JSON.stringify({ error: "new-chains category missing" }), { status: 400 });
  }

  const inserted: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];
  const usedSlugs = new Set<string>();
  let order = 0;

  for (const p of products) {
    const { data: exists } = await admin
      .from("products")
      .select("id")
      .eq("store_id", STORE)
      .eq("source_id", p.id)
      .maybeSingle();
    if (exists) { skipped.push(p.title); continue; }

    let slug = slugify(p.title);
    while (usedSlugs.has(slug)) slug = `${slug}-x`;
    const { data: slugTaken } = await admin
      .from("products").select("id").eq("store_id", STORE).eq("slug", slug).maybeSingle();
    if (slugTaken) slug = `${slug}-${p.id.slice(-4)}`;
    usedSlugs.add(slug);

    const images: string[] = [...p.images];
    if (!images.length && p.videos[0]?.poster) images.push(p.videos[0].poster);
    const mrp = p.compare > p.price ? p.compare : p.price;

    const { data: prod, error } = await admin.from("products").insert({
      store_id: STORE,
      name: p.title,
      slug,
      description: p.body,
      price: mrp,
      sale_price: p.price,
      currency: "INR",
      sku: p.sku,
      stock_quantity: p.available ? 999999 : 0,
      is_active: true,
      image_url: images[0] ?? null,
      video_url: p.videos[0]?.src ?? null,
      video_poster_url: p.videos[0]?.poster ?? null,
      display_order: order++,
      source_platform: "shopify",
      source_id: p.id,
      source_path: p.url,
      source_synced_at: new Date().toISOString(),
    }).select("id").single();

    if (error || !prod) { errors.push(`${p.title}: ${error?.message}`); continue; }

    await admin.from("product_categories").insert({
      product_id: prod.id, category_id: cat.id, store_id: STORE, is_primary: true,
    });
    if (images.length) {
      await admin.from("product_images").insert(
        images.map((image_url, i) => ({ product_id: prod.id, image_url, display_order: i })),
      );
    }
    inserted.push(p.title);
  }

  return new Response(
    JSON.stringify({
      fetched: fetched.length,
      unique: products.length,
      inserted: inserted.length,
      skipped,
      failed,
      errors,
      titles: inserted,
    }, null, 2),
    { headers: { "content-type": "application/json" } },
  );
});
