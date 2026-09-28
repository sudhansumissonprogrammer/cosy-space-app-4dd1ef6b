/**
 * assistant-image-studio
 *
 * Powers the AI product-creative studio inside the Store Assistant chat.
 * Everything is scoped to one store and the caller must own it (or be admin).
 *
 * Actions (POST { action, store_id, ... }):
 *   categories        → categories of the store with product counts
 *   products          → products (optionally by category / search) + primary image
 *   product_media     → all images of one product (source picker)
 *   generate          → AI campaign/product image from a source photo + brief
 *   attach            → add a generated image to the product page (PDP)
 *   detach            → remove a previously attached generated image
 *   history           → recent generated creatives for this store
 *
 * Read-only for everything except `attach` / `detach`, which the merchant
 * triggers explicitly by clicking a button in chat.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const IMAGE_MODEL = "google/gemini-3-pro-image";
const IMAGE_MODEL_FAST = "google/gemini-3.1-flash-image";

const GEN_LIMIT_PER_DAY = 40;

/* ------------------------------ presets ------------------------------ */

type Preset = {
  id: string;
  label: string;
  hint: string;
  prompt: string;
};

const PRESETS: Preset[] = [
  {
    id: "clean_white",
    label: "Clean catalogue",
    hint: "Pure white studio shot for marketplace-style listings",
    prompt:
      "Place the exact same product on a seamless pure-white studio background with soft even lighting, a subtle natural contact shadow, sharp focus and true-to-life colours. Catalogue/e-commerce listing style. No text, no logo, no props.",
  },
  {
    id: "festive_offer",
    label: "Festive offer post",
    hint: "Diwali / festival sale creative for WhatsApp & Instagram",
    prompt:
      "Create a festive Indian sale creative around the exact same product: warm gold and deep maroon tones, soft diya glow, marigold and bokeh accents, premium depth of field. Keep the product perfectly centred, unchanged and hero-lit. Leave clean empty space at the top and bottom for text.",
  },
  {
    id: "lifestyle",
    label: "Lifestyle scene",
    hint: "Product styled in a real-life setting",
    prompt:
      "Show the exact same product styled in a warm, aspirational real-life setting with natural window light, tasteful complementary props, shallow depth of field and editorial colour grading. The product stays the clear hero and completely unchanged.",
  },
  {
    id: "luxury_dark",
    label: "Premium dark",
    hint: "High-end dark backdrop with reflections",
    prompt:
      "Photograph the exact same product on a deep charcoal / black reflective surface with dramatic rim lighting, soft gradient falloff and a mirror reflection underneath. Luxury brand campaign look, ultra sharp, high contrast, no text.",
  },
  {
    id: "model_ready",
    label: "On-model / in-use",
    hint: "Product shown being worn or used",
    prompt:
      "Show the exact same product naturally worn or in use by an Indian model, close crop on the product, soft natural light, realistic skin tones, clean neutral background. The product must stay identical in shape, colour and detail.",
  },
  {
    id: "banner_wide",
    label: "Store banner",
    hint: "Wide hero banner for the storefront homepage",
    prompt:
      "Create a wide storefront hero banner featuring the exact same product on the right third, elegant gradient backdrop matching the product colours, generous clean empty space on the left for a headline. Premium, minimal, no text.",
  },
];

const ASPECTS: Record<string, string> = {
  square: "1:1 square framing (1024x1024), ideal for a product page and Instagram feed",
  portrait: "4:5 vertical framing, ideal for Instagram feed and WhatsApp status",
  story: "9:16 vertical framing, ideal for a story / reel cover",
  wide: "16:9 wide framing, ideal for a storefront banner",
};

/* ------------------------------ helpers ------------------------------ */

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function toDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") || "image/jpeg";
    if (!type.startsWith("image/")) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > 8 * 1024 * 1024) return null;
    let bin = "";
    const chunk = 0x8000;
    for (let i = 0; i < buf.length; i += chunk) {
      bin += String.fromCharCode(...buf.subarray(i, i + chunk));
    }
    return `data:${type};base64,${btoa(bin)}`;
  } catch (_) {
    return null;
  }
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function purgeStorefrontCache(store: { slug: string; custom_domain?: string | null }) {
  const secret = Deno.env.get("WORKER_PURGE_SECRET") || "";
  if (!secret) return;
  const domain = (store.custom_domain || "").replace(/^www\./, "").toLowerCase().trim();
  const params = new URLSearchParams({ slug: store.slug });
  if (domain) params.set("domain", domain);
  const bases = [`https://${store.slug}.shopbanao.in`];
  if (domain) bases.push(`https://${domain}`);
  await Promise.allSettled(
    bases.map((base) => fetch(`${base}/api/purge-store?${params}`, {
      method: "POST",
      headers: { "x-purge-secret": secret, "Cache-Control": "no-store" },
    })),
  );
}

/* -------------------------------- main -------------------------------- */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Not signed in" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "Not signed in" }, 401);

    const body = await req.json().catch(() => null);
    const action = String(body?.action ?? "");
    const storeId = String(body?.store_id ?? "");
    if (!storeId) return json({ error: "Missing store" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: store } = await admin
      .from("stores")
      .select("id, slug, name, owner_id, theme, custom_domain")
      .eq("id", storeId)
      .maybeSingle();
    if (!store) return json({ error: "Store not found" }, 404);
    if (store.owner_id !== user.id) {
      const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!isAdmin) return json({ error: "Not allowed" }, 403);
    }

    switch (action) {
      case "presets":
        return json({ presets: PRESETS, aspects: Object.keys(ASPECTS) });

      case "categories": {
        const { data: cats } = await admin
          .from("categories")
          .select("id, name, slug, image_url")
          .eq("store_id", storeId)
          .order("display_order", { ascending: true })
          .limit(100);
        const { data: links } = await admin
          .from("product_categories")
          .select("category_id")
          .eq("store_id", storeId)
          .limit(20000);
        const counts = new Map<string, number>();
        for (const l of links ?? []) counts.set(l.category_id, (counts.get(l.category_id) || 0) + 1);
        return json({
          categories: (cats ?? []).map((c) => ({ ...c, product_count: counts.get(c.id) ?? 0 })),
        });
      }

      case "products": {
        const categoryId = body?.category_id ? String(body.category_id) : null;
        const q = (body?.q ?? "").toString().trim();
        const limit = Math.min(60, Math.max(1, Number(body?.limit) || 24));

        let ids: string[] | null = null;
        if (categoryId) {
          const { data: links } = await admin
            .from("product_categories")
            .select("product_id")
            .eq("store_id", storeId)
            .eq("category_id", categoryId)
            .limit(500);
          ids = (links ?? []).map((l) => l.product_id);
          if (ids.length === 0) return json({ products: [] });
        }

        let query = admin
          .from("products")
          .select("id, name, slug, price, sale_price, image_url, is_active")
          .eq("store_id", storeId)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (ids) query = query.in("id", ids);
        if (q) query = query.ilike("name", `%${q}%`);
        const { data: products } = await query;
        return json({ products: products ?? [] });
      }

      case "product_media": {
        const productId = String(body?.product_id ?? "");
        if (!productId) return json({ error: "Missing product" }, 400);
        const { data: product } = await admin
          .from("products")
          .select("id, name, slug, description, price, sale_price, image_url, store_id")
          .eq("id", productId)
          .eq("store_id", storeId)
          .maybeSingle();
        if (!product) return json({ error: "Product not found" }, 404);
        const { data: images } = await admin
          .from("product_images")
          .select("id, image_url, display_order")
          .eq("product_id", productId)
          .order("display_order", { ascending: true })
          .limit(30);
        const gallery = [
          ...(product.image_url ? [{ id: "primary", image_url: product.image_url, display_order: -1 }] : []),
          ...(images ?? []).filter((i) => i.image_url !== product.image_url),
        ];
        return json({ product, images: gallery, presets: PRESETS });
      }

      case "history": {
        const { data } = await admin
          .from("store_ai_creatives")
          .select("id, product_id, image_url, prompt, preset, aspect, attached, created_at")
          .eq("store_id", storeId)
          .order("created_at", { ascending: false })
          .limit(24);
        return json({ creatives: data ?? [] });
      }

      case "generate": {
        const productId = String(body?.product_id ?? "");
        // Detailed product-preservation briefs can be long. Keep enough room for
        // exact geometry, material, lighting and exclusion instructions instead
        // of silently truncating the merchant's requirements.
        const brief = (body?.brief ?? "").toString().slice(0, 6000);
        const presetId = String(body?.preset ?? "clean_white");
        const aspect = ASPECTS[String(body?.aspect ?? "square")] ? String(body.aspect) : "square";
        const quality = body?.quality === "fast" ? "fast" : "high";
        // Strict preservation jobs may intentionally use only the selected first
        // slide. This avoids a different gallery angle influencing the output.
        const sourceOnly = body?.source_only === true;
        if (!productId) return json({ error: "Pick a product first" }, 400);

        // Daily fair-use cap per store.
        const since = new Date(Date.now() - 86400000).toISOString();
        const { count: used } = await admin
          .from("store_ai_creatives")
          .select("id", { count: "exact", head: true })
          .eq("store_id", storeId)
          .gte("created_at", since);
        if ((used ?? 0) >= GEN_LIMIT_PER_DAY) {
          return json(
            { error: `You've generated ${GEN_LIMIT_PER_DAY} images today. Please try again tomorrow.` },
            429,
          );
        }

        const { data: product } = await admin
          .from("products")
          .select("id, name, description, image_url")
          .eq("id", productId)
          .eq("store_id", storeId)
          .maybeSingle();
        if (!product) return json({ error: "Product not found" }, 404);

        let sourceUrl = (body?.source_image_url ?? "").toString();
        if (!sourceUrl) {
          if (product.image_url) sourceUrl = product.image_url;
          else {
            const { data: first } = await admin
              .from("product_images")
              .select("image_url")
              .eq("product_id", productId)
              .order("display_order", { ascending: true })
              .limit(1)
              .maybeSingle();
            sourceUrl = first?.image_url ?? "";
          }
        }
        if (!sourceUrl) {
          return json({ error: "This product has no photo yet. Upload one photo first, then I can restyle it." }, 400);
        }

        const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0];
        const dataUrl = await toDataUrl(sourceUrl);
        if (!dataUrl) return json({ error: "Could not read the product photo. Try another image." }, 400);

        // Extra reference angles: the more real views the model sees, the less
        // it "invents" texture (chain link weave, clasp, plating tone, dial).
        const refUrls: string[] = [];
        if (!sourceOnly) {
          const { data: extra } = await admin
            .from("product_images")
            .select("image_url, display_order")
            .eq("product_id", productId)
            .order("display_order", { ascending: true })
            .limit(6);
          for (const im of extra ?? []) {
            if (!im.image_url || im.image_url === sourceUrl) continue;
            if (refUrls.length >= 2) break;
            refUrls.push(im.image_url);
          }
        }
        const refDataUrls = (await Promise.all(refUrls.map(toDataUrl))).filter(
          (d): d is string => !!d,
        );

        const instruction = [
          `You are a senior product photographer retouching a REAL photograph for an Indian D2C brand named "${store.name}".`,
          `This is a re-photograph / relight of the physical item in the reference image — NOT a new design and NOT an illustration.`,
          `Product: ${product.name}.`,
          product.description ? `Details: ${String(product.description).replace(/<[^>]*>/g, " ").slice(0, 300)}` : "",
          refDataUrls.length
            ? `You are given ${refDataUrls.length + 1} photos of the SAME single item from different angles. Use them together to understand its true geometry, texture and finish. Produce ONE image of that one item.`
            : "",
          `Style: ${preset.prompt}`,
          brief ? `Merchant's request (highest priority): ${brief}` : "",
          `Framing: ${ASPECTS[aspect]}.`,
          `PRODUCT-IDENTITY RULES (most important, never break):`,
          `• Copy the item pixel-faithfully: exact silhouette, proportions, thickness, length and item count.`,
          `• Reproduce the surface EXACTLY as photographed — link-by-link chain weave/pattern, braid direction, stone cuts and settings, engraving, filigree, beadwork, kundan/meena work, embossing, dial layout, indices, hands, logo placement, strap grain and stitching.`,
          `• Keep the exact metal tone and finish (gold polish vs rose gold vs silver/steel, matte vs mirror polish, antique/oxidised patina) and the exact clasp/hook/lock type shown.`,
          `• Keep real material behaviour: genuine metal specular highlights, micro-scratches and casting texture from the reference. Do not smooth it into plastic or CGI, do not "beautify", do not add glitter/sparkle overlays.`,
          `• Do not redesign, simplify, straighten, re-space or stylise any part. If a detail is unclear in the reference, copy it as-is instead of inventing something.`,
          `Only the background, lighting, camera angle and composition may change.`,
          `Do not add any text, watermark, price, brand name or logo unless the merchant explicitly asked for it.`,
          `Output ONE photorealistic, ultra-sharp, high-resolution image with true-to-life colour — macro-level detail on the product, no noise, no blur on the product.`,
        ]
          .filter(Boolean)
          .join("\n");

        const genRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Lovable-AIG-SDK": "fetch",
          },
          body: JSON.stringify({
            model: quality === "fast" ? IMAGE_MODEL_FAST : IMAGE_MODEL,
            modalities: ["image", "text"],
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: instruction },
                  { type: "image_url", image_url: { url: dataUrl } },
                  ...refDataUrls.map((u) => ({ type: "image_url", image_url: { url: u } })),
                ],
              },
            ],
          }),
        });

        if (!genRes.ok) {
          const text = await genRes.text().catch(() => "");
          console.error("image gen failed", genRes.status, text.slice(0, 500));
          const msg =
            genRes.status === 429
              ? "Image generation is busy right now. Please try again in a moment."
              : genRes.status === 402
                ? "AI credits are exhausted for this workspace. Please add credits to keep generating images."
                : genRes.status === 403
                  ? "Image generation is disabled for this workspace."
                  : "Could not generate the image right now. Please try again.";
          return json({ error: msg }, genRes.status === 429 || genRes.status >= 500 ? 503 : 400);
        }

        const gen = await genRes.json().catch(() => null);
        const raw = gen?.choices?.[0]?.message?.images?.[0]?.image_url?.url as string | undefined;
        if (!raw?.startsWith("data:image/")) {
          console.error("no image in response", JSON.stringify(gen).slice(0, 400));
          return json({ error: "The model did not return an image. Try a simpler brief." }, 502);
        }

        const [, mime, b64] = raw.match(/^data:(image\/[a-z+]+);base64,(.+)$/) ?? [];
        if (!b64) return json({ error: "Bad image data returned." }, 502);
        const bytes = b64ToBytes(b64);

        // Store on R2 through the existing upload function (WebP conversion,
        // tenant path guard and CDN URL all handled there).
        const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
        const key = `${user.id}/${storeId}/ai/${crypto.randomUUID()}-1600w.${ext}`;
        const form = new FormData();
        form.append("file", new File([bytes], `creative.${ext}`, { type: mime }));
        form.append("bucket", "product-images");
        form.append("path", key);
        // Near-lossless WebP: jewellery texture (chain weave, engraving) is the
        // first thing normal q80 compression smears away.
        form.append("webp_quality", "94");

        const up = await fetch(`${SUPABASE_URL}/functions/v1/r2-upload`, {
          method: "POST",
          headers: { Authorization: authHeader, apikey: ANON_KEY },
          body: form,
        });
        const upJson = await up.json().catch(() => null);
        if (!up.ok || !upJson?.publicUrl) {
          console.error("r2 upload failed", up.status, JSON.stringify(upJson).slice(0, 300));
          return json({ error: "The image was created but could not be saved. Please try again." }, 502);
        }

        const { data: creative } = await admin
          .from("store_ai_creatives")
          .insert({
            store_id: storeId,
            product_id: productId,
            created_by: user.id,
            source_image_url: sourceUrl,
            image_url: upJson.publicUrl,
            prompt: brief || preset.label,
            preset: preset.id,
            aspect,
          })
          .select("id, image_url, product_id, preset, aspect, prompt, attached")
          .single();

        return json({
          creative,
          product: { id: product.id, name: product.name },
          preset: preset.label,
        });
      }

      case "attach": {
        const creativeId = String(body?.creative_id ?? "");
        const makePrimary = !!body?.make_primary;
        if (!creativeId) return json({ error: "Missing image" }, 400);

        const { data: creative } = await admin
          .from("store_ai_creatives")
          .select("id, store_id, product_id, image_url, attached, product_image_id")
          .eq("id", creativeId)
          .eq("store_id", storeId)
          .maybeSingle();
        if (!creative) return json({ error: "Image not found" }, 404);
        const productId = body?.product_id ? String(body.product_id) : creative.product_id;
        if (!productId) return json({ error: "Missing product" }, 400);

        const { data: product } = await admin
          .from("products")
          .select("id, image_url")
          .eq("id", productId)
          .eq("store_id", storeId)
          .maybeSingle();
        if (!product) return json({ error: "Product not found" }, 404);

        const { data: existing } = await admin
          .from("product_images")
          .select("id, display_order")
          .eq("product_id", productId)
          .order("display_order", { ascending: false })
          .limit(1)
          .maybeSingle();
        const nextOrder = (existing?.display_order ?? -1) + 1;

        let productImageId = creative.product_image_id as string | null;
        if (!productImageId) {
          const { data: inserted, error: insErr } = await admin
            .from("product_images")
            .insert({
              product_id: productId,
              image_url: creative.image_url,
              display_order: makePrimary ? 0 : nextOrder,
              image_alt: null,
            })
            .select("id")
            .single();
          if (insErr) {
            console.error("attach failed", insErr);
            return json({ error: "Could not add the image to the product." }, 500);
          }
          productImageId = inserted.id;
        }

        if (makePrimary) {
          await admin.from("products").update({ image_url: creative.image_url }).eq("id", productId).eq("store_id", storeId);
        }

        await admin
          .from("store_ai_creatives")
          .update({ attached: true, product_image_id: productImageId, product_id: productId })
          .eq("id", creativeId);

        // AI Studio writes gallery rows server-side, outside the dashboard's
        // normal product-save purge. Clear versioned PDP caches immediately.
        await purgeStorefrontCache(store);

        return json({ ok: true, attached: true, primary: makePrimary, product_image_id: productImageId });
      }

      case "detach": {
        const creativeId = String(body?.creative_id ?? "");
        const { data: creative } = await admin
          .from("store_ai_creatives")
          .select("id, product_id, image_url, product_image_id")
          .eq("id", creativeId)
          .eq("store_id", storeId)
          .maybeSingle();
        if (!creative) return json({ error: "Image not found" }, 404);
        if (creative.product_image_id) {
          await admin.from("product_images").delete().eq("id", creative.product_image_id);
        }
        if (creative.product_id) {
          const { data: product } = await admin
            .from("products")
            .select("id, image_url")
            .eq("id", creative.product_id)
            .eq("store_id", storeId)
            .maybeSingle();
          if (product?.image_url === creative.image_url) {
            const { data: fallback } = await admin
              .from("product_images")
              .select("image_url")
              .eq("product_id", creative.product_id)
              .order("display_order", { ascending: true })
              .limit(1)
              .maybeSingle();
            await admin
              .from("products")
              .update({ image_url: fallback?.image_url ?? null })
              .eq("id", creative.product_id);
          }
        }
        await admin
          .from("store_ai_creatives")
          .update({ attached: false, product_image_id: null })
          .eq("id", creativeId);
        await purgeStorefrontCache(store);
        return json({ ok: true, attached: false });
      }

      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (e) {
    console.error("assistant-image-studio error", e);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
