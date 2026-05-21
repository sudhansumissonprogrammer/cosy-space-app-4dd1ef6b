/**
 * r2-upload — Uploads an image to Cloudflare R2 via S3 API (SigV4).
 *
 * POST multipart/form-data:
 *   file:   the image File
 *   bucket: logical bucket prefix (e.g. "product-images", "store-assets")
 *   path:   the key suffix (e.g. "userId/storeId/123abc-800w.webp")
 *
 * Returns: { publicUrl, path }
 * publicUrl is served by Cloudflare R2 custom domain (R2_PUBLIC_URL).
 */
import { AwsClient } from "npm:aws4fetch@1.0.20";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

const ALLOWED_BUCKETS = new Set([
  "product-images",
  "store-assets",
  "store-logos",
  "store-banners",
  "category-images",
  "media-library",
  "store-pages",
  "external",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME || !R2_PUBLIC_URL) {
      return new Response(
        JSON.stringify({ error: "R2 not configured (missing env vars)" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const form = await req.formData();
    const file = form.get("file");
    const bucket = String(form.get("bucket") || "product-images");
    const rawPath = String(form.get("path") || "").replace(/^\/+/, "");

    if (!(file instanceof File) || !rawPath) {
      return new Response(JSON.stringify({ error: "Missing file or path" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!ALLOWED_BUCKETS.has(bucket)) {
      return new Response(JSON.stringify({ error: `Invalid bucket: ${bucket}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (file.size > 15 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "File too large (max 15MB)" }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const key = `${bucket}/${rawPath}`;
    const contentType = file.type || "application/octet-stream";
    const body = new Uint8Array(await file.arrayBuffer());

    const res = await r2.fetch(`${r2Endpoint}/${key}`, {
      method: "PUT",
      body,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[r2-upload] R2 PUT failed:", res.status, text);
      return new Response(
        JSON.stringify({ error: `R2 upload failed: ${res.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    await res.text(); // drain body

    const publicUrl = `${R2_PUBLIC_URL}/${key}`;
    return new Response(
      JSON.stringify({ publicUrl, path: key }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[r2-upload] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
