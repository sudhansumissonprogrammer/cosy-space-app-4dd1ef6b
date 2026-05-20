import { createClient } from "npm:@supabase/supabase-js@2";
import { AwsClient } from "npm:aws4fetch@1.0.20";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── R2 config ───────────────────────────────────────────────────
const R2_ACCOUNT_ID = Deno.env.get("R2_ACCOUNT_ID") || "";
const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID") || "";
const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY") || "";
const R2_BUCKET_NAME = Deno.env.get("R2_BUCKET_NAME") || "";
const R2_PUBLIC_URL = (Deno.env.get("R2_PUBLIC_URL") || "").replace(/\/+$/, "");

const r2 = new AwsClient({
  accessKeyId: R2_ACCESS_KEY_ID,
  secretAccessKey: R2_SECRET_ACCESS_KEY,
  service: "s3",
  region: "auto",
});
const r2Endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET_NAME}`;

async function r2Put(key: string, body: ArrayBuffer | Uint8Array, contentType: string) {
  const res = await r2.fetch(`${r2Endpoint}/${key}`, {
    method: "PUT",
    body: body instanceof Uint8Array ? body : new Uint8Array(body),
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`R2 PUT failed: ${res.status} ${text}`);
  }
  await res.text();
  return `${R2_PUBLIC_URL}/${key}`;
}

// ── Shared URL validation ───────────────────────────────────────

function validateImageUrl(imageUrl: string): string | null {
  try {
    const parsed = new URL(imageUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return "Invalid URL protocol";
    }
    return null;
  } catch {
    return "Invalid URL";
  }
}

// ── Resize (proxy) handler ──────────────────────────────────────

async function handleResize(url: URL) {
  const imageUrl = url.searchParams.get("url");

  if (!imageUrl) {
    return new Response(JSON.stringify({ error: "Missing url param" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const validationError = validateImageUrl(imageUrl);
  if (validationError) {
    return new Response(JSON.stringify({ error: validationError }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const imageResponse = await fetch(imageUrl, {
    headers: { "User-Agent": "ShopBanao-ImageProxy/1.0" },
  });

  if (!imageResponse.ok) {
    return new Response(
      JSON.stringify({ error: "Failed to fetch image" }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
  const imageData = await imageResponse.arrayBuffer();

  return new Response(imageData, {
    headers: {
      ...corsHeaders,
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=604800, s-maxage=2592000, immutable",
      "CDN-Cache-Control": "public, max-age=2592000",
      "Vary": "Accept",
    },
  });
}

// ── Copy external image handler ─────────────────────────────────
// Downloads remote image and pushes to R2 (cdn.shopbanao.in).

async function handleCopy(req: Request) {
  const { url, store_id, product_id } = await req.json();

  if (!url || !store_id || !product_id) {
    return new Response(
      JSON.stringify({ success: false, error: "Missing url, store_id, or product_id" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Skip if already on our CDN or storage
  if (R2_PUBLIC_URL && url.startsWith(R2_PUBLIC_URL)) {
    return new Response(
      JSON.stringify({ success: true, new_url: url, skipped: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  if (url.includes(supabaseUrl) || url.includes("supabase.co/storage")) {
    return new Response(
      JSON.stringify({ success: true, new_url: url, skipped: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const validationError = validateImageUrl(url);
  if (validationError) {
    return new Response(
      JSON.stringify({ success: false, error: validationError }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  let response: Response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "ShopBanao-ImageCopy/1.0" },
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    return new Response(
      JSON.stringify({ success: false, error: `Failed to fetch image: HTTP ${response.status}` }),
      { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const contentType = response.headers.get("content-type") || "image/jpeg";
  if (!contentType.startsWith("image/")) {
    return new Response(
      JSON.stringify({ success: false, error: "URL does not point to an image" }),
      { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const blob = await response.blob();
  if (blob.size > 10 * 1024 * 1024) {
    return new Response(
      JSON.stringify({ success: false, error: "Image too large (max 10MB)" }),
      { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const extMap: Record<string, string> = {
    "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png",
    "image/webp": "webp", "image/gif": "gif", "image/avif": "avif",
  };
  const ext = extMap[contentType] || "jpg";

  const timestamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const key = `external/${store_id}/${product_id}-${timestamp}-${rand}.${ext}`;

  const arrayBuffer = await blob.arrayBuffer();
  let newUrl: string;
  try {
    newUrl = await r2Put(key, arrayBuffer, contentType);
  } catch (err) {
    console.error("[image-ops/copy] R2 upload failed:", err);
    return new Response(
      JSON.stringify({ success: false, error: `Upload failed: ${err instanceof Error ? err.message : "unknown"}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supaAdmin = createClient(supabaseUrl, supabaseServiceKey);

  const { error: updateError } = await supaAdmin
    .from("products")
    .update({ image_url: newUrl })
    .eq("id", product_id)
    .eq("store_id", store_id);

  if (updateError) {
    console.error("Failed to update product image_url:", updateError);
  }

  await supaAdmin
    .from("product_images")
    .update({ image_url: newUrl })
    .eq("product_id", product_id)
    .eq("image_url", url);

  return new Response(
    JSON.stringify({ success: true, new_url: newUrl }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ── Router ──────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "resize";

  try {
    switch (action) {
      case "resize":
        return await handleResize(url);
      case "copy":
        return await handleCopy(req);
      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (err) {
    console.error("[image-ops] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
