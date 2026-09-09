// Seeds a brand-new store with demo categories, 8 in-stock demo products
// (every one has a video + a real description), category links, trust videos
// and the Shop by Video app. Runs with the service role so it can never fail
// silently behind RLS the way the old client-side seeding did.
//
// POST { store_id: uuid }  (caller must own the store, or be an admin)
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const MEDIA =
  "https://dqepeywgftbpxeeqfuwt.supabase.co/storage/v1/object/public/product-images/demo%2F";

export const DEMO_CATEGORIES = [
  { name: "Jewellery", slug: "jewellery", image_url: `${MEDIA}necklace.jpg`, display_order: 0 },
  { name: "Watches", slug: "watches", image_url: `${MEDIA}watch2.jpg`, display_order: 1 },
  { name: "Fashion", slug: "fashion", image_url: `${MEDIA}earrings.jpg`, display_order: 2 },
  { name: "Accessories", slug: "accessories", image_url: `${MEDIA}bangle.jpg`, display_order: 3 },
  { name: "Gifting", slug: "gifting", image_url: `${MEDIA}pendant.jpg`, display_order: 4 },
];

const note = (body: string) =>
  `${body}\n\n📦 In stock & ready to ship\n🚚 Fast delivery across India\n🔄 Easy replacement on eligible returns\n\n⚠️ Demo product — open your dashboard and replace it with your own product.`;

export const DEMO_PRODUCTS = [
  {
    name: "Demo Gold-Plated Necklace Set",
    slug: "demo-necklace-set",
    price: 2499,
    sale_price: 1499,
    category: "Jewellery",
    media: "necklace",
    is_best_selling: true,
    description: note(
      "✨ A classic gold-polished necklace set with matching earrings — light on the neck, rich in finish.\n\n• Skin-friendly, anti-tarnish gold polish\n• Perfect for weddings, festivals and family functions\n• Store in the pouch and keep away from perfume for a longer shine",
    ),
  },
  {
    name: "Demo Gold-Plated Ring",
    slug: "demo-gold-ring",
    price: 1299,
    sale_price: 899,
    category: "Jewellery",
    media: "ring",
    description: note(
      "💍 A slim everyday ring with a smooth gold polish and a subtle stone detail.\n\n• Comfortable adjustable fit\n• Goes with both office wear and ethnic wear\n• Wipe with a soft dry cloth after use",
    ),
  },
  {
    name: "Demo Pearl Jhumka Earrings",
    slug: "demo-jhumka-earrings",
    price: 999,
    sale_price: 649,
    category: "Fashion",
    media: "earrings",
    is_best_selling: true,
    description: note(
      "👂 Pearl-drop jhumkas that stay light all day — the easiest way to finish a saree or kurta look.\n\n• Feather-light, no ear pull\n• Secure push-back closure\n• Festive and daily wear friendly",
    ),
  },
  {
    name: "Demo Gold-Plated Pendant Chain",
    slug: "demo-pendant-chain",
    price: 1199,
    sale_price: 799,
    category: "Gifting",
    media: "pendant",
    description: note(
      "🎁 A dainty solitaire pendant on a fine chain — a safe, loved gift choice.\n\n• Adjustable chain length\n• Bright anti-tarnish polish\n• Arrives in a gift-ready pouch",
    ),
  },
  {
    name: "Demo Gold-Plated Bangle",
    slug: "demo-gold-bangle",
    price: 1599,
    sale_price: 1049,
    category: "Accessories",
    media: "bangle",
    description: note(
      "🌟 A smooth, broad bangle with a mirror-gold finish that lifts any outfit.\n\n• Easy open-close fit for most wrist sizes\n• Smooth edges, no scratching\n• Pairs well with watches and rings",
    ),
  },
  {
    name: "Demo Classic Leather Watch",
    slug: "demo-classic-watch",
    price: 2599,
    sale_price: 1799,
    category: "Watches",
    media: "watch2",
    is_best_selling: true,
    description: note(
      "⌚ A clean dial dress watch on a soft leather strap — simple, sharp and office ready.\n\n• Precise quartz movement\n• Scratch-resistant glass\n• Adjustable strap for a snug fit",
    ),
  },
  {
    name: "Demo Steel Chronograph Watch",
    slug: "demo-steel-chronograph",
    price: 3499,
    sale_price: 2299,
    category: "Watches",
    media: "watch3",
    description: note(
      "⌚ A steel-bracelet chronograph with a bright silver dial — a solid daily-wear statement piece.\n\n• Stainless steel case and bracelet\n• Everyday water-resistant build\n• Sub-dial detailing for a premium look",
    ),
  },
  {
    name: "Demo Minimal Dress Watch",
    slug: "demo-minimal-watch",
    price: 2199,
    sale_price: 1399,
    category: "Watches",
    media: "watch4",
    description: note(
      "⌚ Minimal white dial, black leather strap — the go-anywhere watch for men and women.\n\n• Slim case, sits flat under a sleeve\n• Soft strap, comfortable all day\n• Unisex sizing",
    ),
  },
];

export const DEMO_TRUST_VIDEOS = [
  { media: "necklace", title: "Demo: product close-up" },
  { media: "watch2", title: "Demo: quality check" },
  { media: "earrings", title: "Demo: packed with care" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const storeId = String(body?.store_id || "");
    if (!/^[0-9a-f-]{36}$/i.test(storeId)) return json({ error: "store_id required" }, 400);

    // ── auth: caller must own the store (or be admin) ──
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    if (!token) return json({ error: "unauthorized" }, 401);
    const { data: userRes } = await admin.auth.getUser(token);
    const uid = userRes?.user?.id;
    if (!uid) return json({ error: "unauthorized" }, 401);

    const { data: store } = await admin
      .from("stores")
      .select("id, owner_id, currency")
      .eq("id", storeId)
      .maybeSingle();
    if (!store) return json({ error: "store not found" }, 404);

    if (store.owner_id !== uid) {
      const { data: isAdmin } = await admin.rpc("has_role", { _user_id: uid, _role: "admin" });
      if (!isAdmin) return json({ error: "forbidden" }, 403);
    }

    const currency = store.currency || "INR";
    const result: Record<string, number> = {};

    // ── categories (skip if the store already has some) ──
    const { count: catCount } = await admin
      .from("categories")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId);
    if (!catCount) {
      const { error } = await admin
        .from("categories")
        .insert(
          DEMO_CATEGORIES.map((c) => ({ ...c, store_id: storeId, show_on_home: true })),
        );
      if (error) return json({ error: `categories: ${error.message}` }, 500);
      result.categories = DEMO_CATEGORIES.length;
    }

    // ── products (skip if the store already has some) ──
    const { count: prodCount } = await admin
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId);
    if (!prodCount) {
      const rows = DEMO_PRODUCTS.map((p, i) => ({
        store_id: storeId,
        name: p.name,
        slug: p.slug,
        description: p.description,
        price: p.price,
        sale_price: p.sale_price,
        currency,
        category: p.category,
        image_url: `${MEDIA}${p.media}.jpg`,
        image_alt: p.name,
        video_url: `${MEDIA}${p.media}.mp4`,
        video_poster_url: `${MEDIA}${p.media}.jpg`,
        stock_quantity: 25,
        is_active: true,
        is_best_selling: !!p.is_best_selling,
        display_order: i,
      }));
      const { data: inserted, error } = await admin
        .from("products")
        .insert(rows)
        .select("id, category");
      if (error) return json({ error: `products: ${error.message}` }, 500);
      result.products = inserted?.length ?? 0;

      // link products to categories so category pages are never empty
      const { data: cats } = await admin
        .from("categories")
        .select("id, name")
        .eq("store_id", storeId);
      const byName = new Map((cats || []).map((c: any) => [c.name, c.id]));
      const links = (inserted || [])
        .map((p: any) =>
          byName.has(p.category)
            ? { store_id: storeId, product_id: p.id, category_id: byName.get(p.category) }
            : null,
        )
        .filter(Boolean);
      if (links.length) {
        await admin.from("product_categories").upsert(links as any, {
          onConflict: "product_id,category_id",
          ignoreDuplicates: true,
        });
        result.category_links = links.length;
      }
    }

    // ── trust videos ──
    const { count: tvCount } = await admin
      .from("store_trust_videos")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId);
    if (!tvCount) {
      await admin.from("store_trust_videos").insert(
        DEMO_TRUST_VIDEOS.map((v, i) => ({
          store_id: storeId,
          video_url: `${MEDIA}${v.media}.mp4`,
          poster_url: `${MEDIA}${v.media}.jpg`,
          title: v.title,
          cta_label: "See more details",
          sort_order: i,
          is_active: true,
        })),
      );
      result.trust_videos = DEMO_TRUST_VIDEOS.length;
    }

    // ── Shop by Video app on by default ──
    const { data: appRow } = await admin
      .from("store_apps")
      .select("id")
      .eq("store_id", storeId)
      .eq("app_id", "shop-by-video")
      .maybeSingle();
    if (!appRow) {
      await admin.from("store_apps").insert({
        store_id: storeId,
        app_id: "shop-by-video",
        enabled: true,
        config: {
          title: "Shop by Video",
          autoplay: true,
          loop: true,
          aspect_ratio: "9:16",
          max_items: 10,
          show_price: true,
          show_cta: true,
          order: [],
        },
      });
      result.shop_by_video = 1;
    }

    return json({ ok: true, store_id: storeId, ...result });
  } catch (e) {
    console.error("seed-demo-store failed", e);
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});
