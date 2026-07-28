/**
 * review-upload — public (anonymous) media upload for customer reviews.
 *
 * Shoppers are not logged in, so this endpoint is unauthenticated but tightly
 * scoped:
 *   - store must exist and not be suspended
 *   - magic-byte sniff (image/* or video/mp4|webm only)
 *   - image <= 8MB, video <= 40MB
 *   - IP rate limit: 20 uploads / hour (edge_rate_limits)
 *   - key is always review-media/<storeId>/<random>.<ext> (no caller-supplied path)
 *
 * POST multipart/form-data: { file, store_id }
 * Returns: { publicUrl, type: "image" | "video" }
 */
import { AwsClient } from "npm:aws4fetch@1.0.20";
import { createClient } from "npm:@supabase/supabase-js@2";
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

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME || !R2_PUBLIC_URL) {
      return json({ error: "Storage not configured" }, 500);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const form = await req.formData();
    const file = form.get("file");
    const storeId = String(form.get("store_id") || "");

    if (!(file instanceof File)) return json({ error: "Missing file" }, 400);
    if (!/^[0-9a-f-]{36}$/i.test(storeId)) return json({ error: "Invalid store" }, 400);

    // Store must exist and be live
    const { data: store } = await admin
      .from("stores")
      .select("id,is_suspended")
      .eq("id", storeId)
      .maybeSingle();
    if (!store || store.is_suspended) return json({ error: "Store unavailable" }, 403);

    // Rate limit per IP (20 uploads / hour)
    const ip =
      (req.headers.get("cf-connecting-ip") ||
        req.headers.get("x-forwarded-for") ||
        "unknown").split(",")[0].trim();
    const rlKey = `review-upload:${ip}`;
    const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: rl } = await admin
      .from("edge_rate_limits")
      .select("key,count,window_start")
      .eq("key", rlKey)
      .maybeSingle();
    if (rl && rl.window_start > windowStart) {
      if ((rl.count ?? 0) >= 20) return json({ error: "Too many uploads, try later" }, 429);
      await admin
        .from("edge_rate_limits")
        .update({ count: (rl.count ?? 0) + 1 })
        .eq("key", rlKey);
    } else {
      await admin
        .from("edge_rate_limits")
        .upsert({ key: rlKey, count: 1, window_start: new Date().toISOString() }, { onConflict: "key" });
    }

    const body = new Uint8Array(await file.arrayBuffer());
    const sniffed = sniffImageMime(body);
    if (!sniffed || !EXT[sniffed]) return json({ error: "Unsupported file type" }, 415);

    const isVideo = sniffed.startsWith("video/");
    const limit = isVideo ? 40 * 1024 * 1024 : 8 * 1024 * 1024;
    if (body.length > limit) {
      return json({ error: `File too large (max ${isVideo ? "40MB" : "8MB"})` }, 413);
    }

    const key = `review-media/${storeId}/${crypto.randomUUID()}.${EXT[sniffed]}`;
    const res = await r2.fetch(`${r2Endpoint}/${key}`, {
      method: "PUT",
      body,
      headers: {
        "Content-Type": sniffed,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
    if (!res.ok) {
      console.error("[review-upload] R2 PUT failed", res.status, await res.text());
      return json({ error: "Upload failed" }, 502);
    }
    await res.text();

    return json({ publicUrl: `${R2_PUBLIC_URL}/${key}`, type: isVideo ? "video" : "image" });
  } catch (err) {
    console.error("[review-upload] error", err);
    return json({ error: "Upload failed" }, 500);
  }
});
