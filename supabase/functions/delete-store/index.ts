import { createClient } from "npm:@supabase/supabase-js@2";

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

    // 5. Delete storage files by bucket
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
