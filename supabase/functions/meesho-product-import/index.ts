import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";
import { extFromUrl, mirrorImageToR2 } from "../_shared/migration/r2.ts";

const ProductSchema = z.object({
  source_id: z.string().trim().min(1).max(100),
  source_url: z.string().url().max(1000),
  name: z.string().trim().min(2).max(300),
  selling_price: z.number().positive().max(10_000_000),
  original_price: z.number().positive().max(10_000_000).nullable().optional(),
  description: z.string().max(50_000).optional().default(""),
  images: z.array(z.string().url()).min(1).max(12),
  videos: z.array(z.string().url()).max(2).optional().default([]),
});

const BodySchema = z.object({
  store_id: z.string().uuid(),
  category_name: z.string().trim().min(1).max(100).default("New2"),
  category_slug: z.string().regex(/^[a-z0-9-]+$/).max(100).default("new2"),
  product: ProductSchema,
});

const cleanText = (value: string) => value.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/\son\w+\s*=\s*(["']).*?\1/gi, "").trim();
const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 80);

function cleanMeeshoUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || !/(^|\.)meesho\.com$/i.test(url.hostname)) return null;
    if (!/\/s\/p\/[a-z0-9]+/i.test(url.pathname)) return null;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch { return null; }
}

function allowedMediaUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && (/(^|\.)meesho\.com$/i.test(url.hostname) || /(^|\.)meesho\.io$/i.test(url.hostname));
  } catch { return false; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = auth.slice(7);
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    const userId = claimsData?.claims?.sub as string | undefined;
    if (claimsError || !userId) return json({ error: "Unauthorized" }, 401);

    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ error: "Invalid import item", fields: parsed.error.flatten().fieldErrors }, 400);
    const { store_id, category_name, category_slug, product } = parsed.data;
    const sourceUrl = cleanMeeshoUrl(product.source_url);
    if (!sourceUrl) return json({ error: "Only clean Meesho product links are accepted" }, 400);
    if (product.images.some((url) => !allowedMediaUrl(url)) || product.videos.some((url) => !allowedMediaUrl(url))) {
      return json({ error: "A media link does not belong to Meesho" }, 400);
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: store } = await admin.from("stores").select("id,owner_id,currency").eq("id", store_id).maybeSingle();
    if (!store) return json({ error: "Store not found" }, 404);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (store.owner_id !== userId && !isAdmin) return json({ error: "Forbidden" }, 403);

    const { data: existing } = await admin.from("products").select("id,name").eq("store_id", store_id).eq("source_platform", "meesho").eq("source_id", product.source_id).maybeSingle();
    if (existing) return json({ status: "skipped", reason: "duplicate", product_id: existing.id, name: existing.name });

    const { data: limit } = await admin.rpc("check_product_limit", { _user_id: store.owner_id });
    if (limit && limit.can_create === false) return json({ error: "Product limit reached" }, 409);

    const { data: category, error: categoryError } = await admin.from("categories").upsert({
      store_id,
      name: cleanText(category_name),
      slug: category_slug,
      show_on_home: true,
    }, { onConflict: "store_id,slug" }).select("id,name").single();
    if (categoryError || !category) return json({ error: categoryError?.message || "Could not create category" }, 500);

    const mediaKey = `${store.owner_id}/${store_id}/meesho/${product.source_id}`;
    const mirroredImages: string[] = [];
    for (let index = 0; index < product.images.length; index++) {
      const source = product.images[index];
      const mirrored = await mirrorImageToR2(source, `product-images/${mediaKey}-${index + 1}.${extFromUrl(source)}`);
      if (mirrored) mirroredImages.push(mirrored);
    }
    if (!mirroredImages.length) return json({ error: "No product photo could be copied" }, 422);

    let videoUrl: string | null = null;
    if (product.videos[0]) {
      videoUrl = await mirrorImageToR2(product.videos[0], `product-videos/${mediaKey}.${extFromUrl(product.videos[0], "mp4")}`);
    }
    const selling = product.selling_price;
    const original = product.original_price && product.original_price >= selling ? product.original_price : selling;
    const baseSlug = slugify(product.name) || `meesho-${product.source_id}`;
    const slug = `${baseSlug}-${product.source_id.toLowerCase()}`.slice(0, 120);
    const { data: inserted, error: insertError } = await admin.from("products").insert({
      store_id,
      name: cleanText(product.name),
      slug,
      description: cleanText(product.description || "") || null,
      price: original,
      sale_price: original > selling ? selling : null,
      currency: store.currency || "INR",
      category: category.name,
      stock_quantity: 999999,
      is_active: true,
      image_url: mirroredImages[0],
      video_url: videoUrl,
      source_platform: "meesho",
      source_id: product.source_id,
      source_path: sourceUrl,
      source_synced_at: new Date().toISOString(),
    }).select("id,slug").single();
    if (insertError || !inserted) return json({ error: insertError?.message || "Could not create product" }, 500);

    if (mirroredImages.length > 1) {
      const { error: galleryError } = await admin.from("product_images").insert(
        mirroredImages.slice(1).map((image_url, index) => ({ product_id: inserted.id, image_url, display_order: index })),
      );
      if (galleryError) console.error("[meesho-product-import] gallery", galleryError.message);
    }
    return json({ status: "created", product_id: inserted.id, slug: inserted.slug, images: mirroredImages.length, video: Boolean(videoUrl) });
  } catch (error) {
    console.error("[meesho-product-import]", error);
    return json({ error: error instanceof Error ? error.message : "Import failed" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}