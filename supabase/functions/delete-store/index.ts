import { createClient } from "npm:@supabase/supabase-js@2";
import { AwsClient } from "npm:aws4fetch@1.0.20";

// ── R2 setup for image cleanup ─────────────────────────────────
const R2_ACCOUNT_ID = Deno.env.get("R2_ACCOUNT_ID") || "";
const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID") || "";
const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY") || "";
const R2_BUCKET_NAME = Deno.env.get("R2_BUCKET_NAME") || "";
const R2_PUBLIC_URL = (Deno.env.get("R2_PUBLIC_URL") || "").replace(/\/+$/, "");
const r2 = (R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY)
  ? new AwsClient({ accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY, service: "s3", region: "auto" })
  : null;
const r2Endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET_NAME}`;

/** Convert a cdn.shopbanao.in URL → R2 key. Returns null for non-R2 URLs. */
function r2KeyFromUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  let key: string | null = null;
  if (R2_PUBLIC_URL && u.startsWith(R2_PUBLIC_URL + "/")) key = u.slice(R2_PUBLIC_URL.length + 1);
  else if (u.startsWith("https://cdn.shopbanao.in/")) key = u.slice("https://cdn.shopbanao.in/".length);
  if (!key) return null;
  return key.split("?")[0];
}

async function deleteR2Keys(keys: string[]): Promise<number> {
  if (!r2 || keys.length === 0) return 0;
  let deleted = 0;
  // Sequential to keep memory low; R2 DELETE is fast (~50ms each)
  for (const key of keys) {
    try {
      const res = await r2.fetch(`${r2Endpoint}/${key}`, { method: "DELETE" });
      await res.text();
      if (res.ok || res.status === 204 || res.status === 404) deleted++;
    } catch (e) {
      console.warn(`[delete-store] R2 DELETE failed for ${key}:`, e);
    }
  }
  return deleted;
}


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the caller is an admin using their token
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role for admin check and deletions
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { storeId } = await req.json();
    if (!storeId) {
      return new Response(JSON.stringify({ error: "storeId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanupResults: Record<string, number | string> = {};

    // 1. Get the store info (logo, banner)
    const { data: store } = await supabase
      .from("stores")
      .select("logo_url, banner_url, mobile_hero_url, og_image_url, owner_id")
      .eq("id", storeId)
      .single();

    if (!store) {
      return new Response(JSON.stringify({ error: "Store not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Get all product image URLs from product_images table
    const { data: productImages } = await supabase
      .from("product_images")
      .select("image_url")
      .in("product_id", 
        supabase.from("products").select("id").eq("store_id", storeId)
      );

    // 3. Get main product image URLs
    const { data: products } = await supabase
      .from("products")
      .select("image_url")
      .eq("store_id", storeId)
      .not("image_url", "is", null);

    // 4. Collect all storage file paths to delete
    const filesToDelete: { bucket: string; path: string }[] = [];

    const extractStoragePath = (url: string | null, bucket: string): string | null => {
      if (!url) return null;
      // URL format: .../storage/v1/object/public/bucket-name/path
      const marker = `/storage/v1/object/public/${bucket}/`;
      const idx = url.indexOf(marker);
      if (idx !== -1) return url.substring(idx + marker.length);
      return null;
    };

    // Store logo
    const logoPath = extractStoragePath(store.logo_url, "store-logos");
    if (logoPath) filesToDelete.push({ bucket: "store-logos", path: logoPath });

    // Store banner
    const bannerPath = extractStoragePath(store.banner_url, "store-banners");
    if (bannerPath) filesToDelete.push({ bucket: "store-banners", path: bannerPath });

    // Mobile hero
    const heroPath = extractStoragePath(store.mobile_hero_url, "store-banners");
    if (heroPath) filesToDelete.push({ bucket: "store-banners", path: heroPath });

    // OG image
    const ogPath = extractStoragePath(store.og_image_url, "store-banners");
    if (ogPath) filesToDelete.push({ bucket: "store-banners", path: ogPath });

    // Product images from product_images table
    if (productImages) {
      for (const img of productImages) {
        const path = extractStoragePath(img.image_url, "product-images");
        if (path) filesToDelete.push({ bucket: "product-images", path });
      }
    }

    // Main product images
    if (products) {
      for (const p of products) {
        const path = extractStoragePath(p.image_url, "product-images");
        if (path) filesToDelete.push({ bucket: "product-images", path });
      }
    }

    // Category images
    const { data: categories } = await supabase
      .from("categories")
      .select("image_url")
      .eq("store_id", storeId)
      .not("image_url", "is", null);

    if (categories) {
      for (const cat of categories) {
        const path = extractStoragePath(cat.image_url, "product-images");
        if (path) filesToDelete.push({ bucket: "product-images", path });
      }
    }

    // 5. Delete storage files by bucket (Supabase Storage — legacy URLs)
    const bucketGroups: Record<string, string[]> = {};
    for (const f of filesToDelete) {
      if (!bucketGroups[f.bucket]) bucketGroups[f.bucket] = [];
      bucketGroups[f.bucket].push(f.path);
    }

    let totalFilesDeleted = 0;
    for (const [bucket, paths] of Object.entries(bucketGroups)) {
      // Delete in batches of 100
      for (let i = 0; i < paths.length; i += 100) {
        const batch = paths.slice(i, i + 100);
        const { data: deleted, error } = await supabase.storage.from(bucket).remove(batch);
        if (!error && deleted) totalFilesDeleted += deleted.length;
        if (error) console.error(`[delete-store] Storage error for ${bucket}:`, error.message);
      }
    }

    // 5b. Delete R2 (cdn.shopbanao.in) objects for the same store
    const r2Keys: string[] = [];
    const pushR2 = (u: string | null | undefined) => { const k = r2KeyFromUrl(u); if (k) r2Keys.push(k); };
    pushR2(store.logo_url); pushR2(store.banner_url); pushR2(store.mobile_hero_url); pushR2(store.og_image_url);
    if (productImages) for (const img of productImages) pushR2(img.image_url);
    if (products) for (const p of products) pushR2(p.image_url);
    if (categories) for (const cat of categories) pushR2(cat.image_url);
    const r2Deleted = await deleteR2Keys(r2Keys);
    cleanupResults.r2_files_deleted = r2Deleted;

    cleanupResults.storage_files_deleted = totalFilesDeleted;

    // 6. Delete the store (CASCADE will remove all related DB rows)
    const { error: deleteError } = await supabase
      .from("stores")
      .delete()
      .eq("id", storeId);

    if (deleteError) throw deleteError;

    cleanupResults.status = "deleted";

    console.log(`[delete-store] Store ${storeId} fully deleted:`, cleanupResults);

    return new Response(JSON.stringify({ success: true, results: cleanupResults }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[delete-store] Error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
