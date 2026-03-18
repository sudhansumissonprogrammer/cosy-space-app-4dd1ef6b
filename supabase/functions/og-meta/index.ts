const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function normalizeOgImageUrl(imageUrl: string): string {
  if (!imageUrl) return "";

  try {
    const parsed = new URL(imageUrl);
    const pathname = parsed.pathname.toLowerCase();
    const isShopifyCdnAsset =
      parsed.hostname.includes("shopify.com") ||
      parsed.pathname.includes("/cdn/shop/files/");

    if (isShopifyCdnAsset && !pathname.endsWith(".gif")) {
      parsed.searchParams.set("format", "pjpg");
      parsed.searchParams.set("width", "1200");
    }

    return parsed.toString();
  } catch {
    return imageUrl;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");

  if (!slug) {
    return new Response(JSON.stringify({ error: "Missing slug" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: store, error } = await supabase
    .from("stores")
    .select("name, description, meta_title, meta_description, og_image_url, logo_url, banner_url, slug")
    .eq("slug", slug)
    .single();

  if (error || !store) {
    return new Response(JSON.stringify({ error: "Store not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const ogTitle = store.meta_title || `${store.name} — Shop Online`;
  const ogDescription = store.meta_description || store.description || `Shop the best products at ${store.name}. Fast delivery & easy returns.`;
  const ogImage = normalizeOgImageUrl(store.og_image_url || store.banner_url || store.logo_url || "");

  return new Response(
    JSON.stringify({ title: ogTitle, description: ogDescription, image: ogImage, slug: store.slug }),
    {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=1800, s-maxage=3600",
        "CDN-Cache-Control": "public, max-age=3600",
      },
    }
  );
});
