/**
 * r2-upload — Uploads an image to Cloudflare R2 via S3 API (SigV4).
 *
 * POST multipart/form-data:
 *   file:   the image File
 *   bucket: logical bucket prefix (e.g. "product-images", "store-assets")
 *   path:   the key suffix (e.g. "userId/storeId/123abc-800w.webp")
 *
 * WebP guarantee:
 * If the incoming file is NOT WebP (browser fell back to JPEG/PNG because
 * canvas.toBlob("image/webp") returned null on old Safari / some Android
 * WebView / privacy browsers), we decode + re-encode to WebP server-side
 * using jSquash WASM before R2 PUT. Path extension is forced to .webp.
 * On any conversion error we fall back to uploading the original — never
 * break a merchant's upload.
 *
 * Returns: { publicUrl, path, converted? }
 */
import { AwsClient } from "npm:aws4fetch@1.0.20";
import { createClient } from "npm:@supabase/supabase-js@2";
import encodeWebp from "npm:@jsquash/webp@1.4.0/encode.js";
import decodeJpeg from "npm:@jsquash/jpeg@1.5.0/decode.js";
import decodePng from "npm:@jsquash/png@3.1.0/decode.js";
import { sniffImageMime } from "../_shared/security.ts";

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
  "product-videos",
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
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

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

    // Path-traversal + tenant-isolation guard.
    // Every upload key MUST begin with the caller's own user id segment
    // (matches how clients currently build paths: "<userId>/<storeId>/...").
    // This blocks "../" tricks AND cross-user overwrites.
    if (rawPath.includes("..") || rawPath.includes("\\")) {
      return new Response(JSON.stringify({ error: "Invalid path" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const firstSegment = rawPath.split("/")[0];
    if (firstSegment !== userId) {
      // Allow admins to upload anywhere.
      const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden: path must start with your user id" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const isVideo = (file.type || "").startsWith("video/") || bucket === "product-videos";
    const sizeLimit = isVideo ? 100 * 1024 * 1024 : 15 * 1024 * 1024;
    if (file.size > sizeLimit) {
      return new Response(JSON.stringify({ error: `File too large (max ${isVideo ? "100MB" : "15MB"})` }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    let key = `${bucket}/${rawPath}`;
    let contentType = file.type || "application/octet-stream";
    let body = new Uint8Array(await file.arrayBuffer());
    let converted = false;

    // Magic-byte sniff: reject files whose actual content doesn't match an
    // allowed image/video type. Defeats browsers that lie about MIME.
    const sniffed = sniffImageMime(body);
    if (!sniffed) {
      return new Response(JSON.stringify({ error: "Unsupported file type (magic-byte check failed)" }), {
        status: 415,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // If browser-declared type disagrees with magic bytes, trust the magic bytes.
    if (sniffed !== contentType) {
      contentType = sniffed;
    }

    // WebP guarantee: convert JPEG/PNG → WebP server-side when browser couldn't.
    // Pipeline files only (those matching `*-NNNw.<ext>`) — leaves raw
    // assets/originals untouched. Errors are non-fatal: fall back to original.
    // Skip entirely for videos.
    const isPipelinePath = /-\d+w\.(jpe?g|png|webp)$/i.test(rawPath);
    const needsConvert =
      !isVideo &&
      isPipelinePath &&
      contentType !== "image/webp" &&
      (contentType === "image/jpeg" || contentType === "image/png");

    // Callers that need near-lossless output (AI creatives, review photos)
    // can raise the WebP quality; clamped so nobody can push huge files.
    const rawQ = Number(form.get("webp_quality"));
    const webpQuality = Number.isFinite(rawQ) ? Math.min(95, Math.max(60, Math.round(rawQ))) : 80;

    if (needsConvert) {
      try {
        const imageData =
          contentType === "image/jpeg"
            ? await decodeJpeg(body)
            : await decodePng(body);
        const webpBuf = await encodeWebp(imageData, { quality: webpQuality });
        body = new Uint8Array(webpBuf);
        contentType = "image/webp";
        key = key.replace(/\.(jpe?g|png)$/i, ".webp");
        converted = true;
        console.log(
          `[r2-upload] Server WebP convert OK: ${rawPath} → ${(body.length / 1024).toFixed(1)}KB`,
        );
      } catch (convErr) {
        console.warn(
          `[r2-upload] WebP convert failed, uploading original: ${convErr instanceof Error ? convErr.message : convErr}`,
        );
      }
    }

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
      JSON.stringify({ publicUrl, path: key, converted }),
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
