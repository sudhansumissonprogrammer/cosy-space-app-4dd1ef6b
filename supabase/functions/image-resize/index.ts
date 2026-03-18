import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { searchParams } = new URL(req.url);
    const imageUrl = searchParams.get("url");
    const width = Math.min(Number(searchParams.get("w") || "400"), 1200);
    const quality = Math.min(Number(searchParams.get("q") || "75"), 100);

    if (!imageUrl) {
      return new Response(JSON.stringify({ error: "Missing url param" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate URL to prevent SSRF
    const parsed = new URL(imageUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return new Response(JSON.stringify({ error: "Invalid URL protocol" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the original image
    const imageResponse = await fetch(imageUrl, {
      headers: { "User-Agent": "Storivo-ImageProxy/1.0" },
    });

    if (!imageResponse.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch image" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
    const imageData = await imageResponse.arrayBuffer();

    // For Deno edge functions, we can't do canvas-based resizing,
    // so we pass through with aggressive caching headers.
    // The real optimization happens at upload time (compressImage)
    // and for known CDNs (Supabase/Shopify/Unsplash) via URL params.
    // This proxy ensures images are served from our domain (good for perf/CORS)
    // and adds proper cache headers.

    return new Response(imageData, {
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=604800, s-maxage=2592000, immutable",
        "CDN-Cache-Control": "public, max-age=2592000",
        "Vary": "Accept",
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Internal error", details: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
