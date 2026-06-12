/**
 * r2-convert-jpegs — Admin one-shot tool: re-encodes existing JPEG/PNG product
 * images on R2 to WebP and rewrites products.image_url / product_images.image_url.
 *
 * Designed to clean up the ~10% of legacy JPEGs uploaded before the server-side
 * WebP fallback existed. Idempotent: skips anything already .webp. Processes
 * in small batches (default 25) so the function stays well under CPU limits.
 *
 * POST body:
 *   { store_id?: string, limit?: number }   // admin-only
 *
 * Auth: requires caller to be a platform admin (has_role(uid, 'admin')).
 */
import { AwsClient } from "npm:aws4fetch@1.0.20";
import { createClient } from "npm:@supabase/supabase-js@2";
import encodeWebp from "npm:@jsquash/webp@1.4.0/encode.js";
import decodeJpeg from "npm:@jsquash/jpeg@1.5.0/decode.js";
import decodePng from "npm:@jsquash/png@3.1.0/decode.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

function urlToKey(publicUrl: string): string | null {
  if (!publicUrl.startsWith(R2_PUBLIC_URL + "/")) return null;
  return publicUrl.slice(R2_PUBLIC_URL.length + 1);
}

async function convertOne(publicUrl: string): Promise<string | null> {
  const key = urlToKey(publicUrl);
  if (!key) return null;
  if (/\.webp$/i.test(key)) return null;
  if (!/\.(jpe?g|png)$/i.test(key)) return null;

  // GET original bytes
  const getRes = await fetch(publicUrl);
  if (!getRes.ok) {
    console.warn(`[convert] fetch failed ${publicUrl}: ${getRes.status}`);
    return null;
  }
  const buf = new Uint8Array(await getRes.arrayBuffer());
  const ct = getRes.headers.get("content-type") || "";

  // Decode → encode WebP
  const imageData = ct.includes("png")
    ? await decodePng(buf)
    : await decodeJpeg(buf);
  const webpBuf = await encodeWebp(imageData, { quality: 80 });

  // PUT new .webp object (keep original — non-destructive)
  const newKey = key.replace(/\.(jpe?g|png)$/i, ".webp");
  const putRes = await r2.fetch(`${r2Endpoint}/${newKey}`, {
    method: "PUT",
    body: new Uint8Array(webpBuf),
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
  if (!putRes.ok) {
    console.warn(`[convert] PUT failed ${newKey}: ${putRes.status}`);
    return null;
  }
  await putRes.text();
  return `${R2_PUBLIC_URL}/${newKey}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_PUBLIC_URL) {
      return new Response(JSON.stringify({ error: "R2 not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey);

    // Allow: (a) service-role calls, (b) platform admins, (c) store owners for their own store.
    const isServiceRole = token === serviceRoleKey;
    let callerUid: string | null = null;
    if (!isServiceRole) {
      const { data: claims } = await supabase.auth.getClaims(token);
      callerUid = claims?.claims?.sub || null;
      if (!callerUid) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = await req.json().catch(() => ({}));
    const storeId: string | undefined = body.store_id;
    const limit: number = Math.min(Math.max(Number(body.limit) || 25, 1), 100);

    if (!isServiceRole && callerUid) {
      const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: callerUid, _role: "admin" });
      if (!isAdmin) {
        if (!storeId) {
          return new Response(JSON.stringify({ error: "store_id required for non-admin callers" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { data: store } = await supabase
          .from("stores").select("owner_id").eq("id", storeId).maybeSingle();
        if (!store || store.owner_id !== callerUid) {
          return new Response(JSON.stringify({ error: "Not store owner" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // Find JPEG/PNG product rows on cdn.shopbanao.in

    let q = supabase
      .from("products")
      .select("id, image_url, store_id")
      .or("image_url.ilike.%.jpg,image_url.ilike.%.jpeg,image_url.ilike.%.png")
      .like("image_url", `${R2_PUBLIC_URL}/%`)
      .limit(limit);
    if (storeId) q = q.eq("store_id", storeId);

    const { data: rows, error } = await q;
    if (error) throw error;

    let converted = 0, skipped = 0, failed = 0;
    const results: Array<{ id: string; from: string; to?: string; err?: string }> = [];

    for (const row of rows || []) {
      try {
        const newUrl = await convertOne(row.image_url);
        if (!newUrl) {
          skipped++;
          continue;
        }
        const { error: updErr } = await supabase
          .from("products")
          .update({ image_url: newUrl })
          .eq("id", row.id);
        if (updErr) {
          failed++;
          results.push({ id: row.id, from: row.image_url, err: updErr.message });
          continue;
        }
        converted++;
        results.push({ id: row.id, from: row.image_url, to: newUrl });
      } catch (e) {
        failed++;
        results.push({ id: row.id, from: row.image_url, err: String(e) });
      }
    }

    return new Response(
      JSON.stringify({
        scanned: rows?.length || 0,
        converted,
        skipped,
        failed,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[r2-convert-jpegs]", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
