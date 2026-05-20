/**
 * r2-migrate-images — Admin-only batch migration of Supabase Storage → R2.
 *
 * For each batch:
 *   1. Find rows with image URLs still on supabase.co/storage
 *   2. Download from Supabase, PUT to R2 at the same key path
 *   3. Update DB row with new cdn.shopbanao.in URL
 *
 * POST body: { batch_size?: number (default 25), dry_run?: boolean }
 * Returns: { migrated, skipped, errors, remaining }
 *
 * Idempotent — safe to re-run until `remaining` = 0.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { AwsClient } from "npm:aws4fetch@1.0.20";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

/** Tables + columns that hold image URLs. order_array=true → text[] column. */
const TARGETS: Array<{ table: string; col: string; isArray?: boolean }> = [
  { table: "products", col: "image_url" },
  { table: "product_images", col: "image_url" },
  { table: "categories", col: "image_url" },
  { table: "stores", col: "logo_url" },
  { table: "stores", col: "banner_url" },
  { table: "stores", col: "mobile_hero_url" },
  { table: "stores", col: "og_image_url" },
  { table: "stores", col: "about_us_image_url" },
  { table: "stores", col: "mobile_hero_images", isArray: true },
  { table: "store_pages", col: "image_url" },
  { table: "media_library", col: "file_url" },
];

function isSupabaseStorageUrl(u: string | null | undefined): boolean {
  if (!u) return false;
  return u.includes("supabase.co/storage/v1/object/") || u.includes(SUPABASE_URL + "/storage/");
}

/** Extract bucket + path from a Supabase Storage URL. */
function parseSupabaseUrl(u: string): { bucket: string; path: string } | null {
  // .../storage/v1/object/public/<bucket>/<path>
  // .../storage/v1/render/image/public/<bucket>/<path>?...
  const m = u.match(/\/storage\/v1\/(?:object|render\/image)\/public\/([^/]+)\/(.+?)(?:\?|$)/);
  if (!m) return null;
  return { bucket: m[1], path: decodeURIComponent(m[2]) };
}

async function r2Put(key: string, body: Uint8Array, contentType: string): Promise<string> {
  const res = await r2.fetch(`${r2Endpoint}/${key}`, {
    method: "PUT",
    body,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`R2 PUT failed (${res.status}): ${text}`);
  }
  await res.text();
  return `${R2_PUBLIC_URL}/${key}`;
}

/** Migrate one URL: download from supabase, upload to R2. Returns new URL or null if skipped. */
async function migrateUrl(supabaseClient: ReturnType<typeof createClient>, originalUrl: string): Promise<string | null> {
  const parsed = parseSupabaseUrl(originalUrl);
  if (!parsed) return null;

  // Download via service-role storage API (bypasses RLS, handles private buckets too)
  const { data: blob, error: dlErr } = await supabaseClient.storage
    .from(parsed.bucket)
    .download(parsed.path);
  if (dlErr || !blob) {
    // Fall back to public HTTP fetch
    const res = await fetch(originalUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`Download failed: ${dlErr?.message || res.status}`);
    const ab = await res.arrayBuffer();
    const ct = res.headers.get("content-type") || "image/jpeg";
    const key = `${parsed.bucket}/${parsed.path}`;
    return await r2Put(key, new Uint8Array(ab), ct);
  }

  const ab = await blob.arrayBuffer();
  const ct = blob.type || "image/jpeg";
  const key = `${parsed.bucket}/${parsed.path}`;
  return await r2Put(key, new Uint8Array(ab), ct);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth: admin only
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: roleData } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let batchSize = 25;
    let dryRun = false;
    let action: "migrate" | "copy-demo-assets" = "migrate";
    if (req.headers.get("content-type")?.includes("application/json")) {
      try {
        const body = await req.json();
        if (typeof body.batch_size === "number") batchSize = Math.min(100, Math.max(1, body.batch_size));
        if (body.dry_run === true) dryRun = true;
        if (body.action === "copy-demo-assets") action = "copy-demo-assets";
      } catch { /* ignore */ }
    }

    // ── One-shot: copy the 7 hardcoded demo seed images to R2 ─────
    if (action === "copy-demo-assets") {
      const SUP = `${SUPABASE_URL}/storage/v1/object/public/product-images/demo`;
      const files = [
        "product-1.jpg", "product-2.jpg", "product-3.jpg", "product-4.jpg",
        "category-fashion.jpg", "category-electronics.jpg", "category-accessories.jpg",
      ];
      const copied: string[] = [];
      const failed: string[] = [];
      for (const f of files) {
        try {
          const newU = await migrateUrl(admin, `${SUP}/${f}`);
          if (newU) copied.push(newU); else failed.push(f);
        } catch (e) {
          failed.push(`${f}: ${e instanceof Error ? e.message : "err"}`);
        }
      }
      return new Response(
        JSON.stringify({ success: true, action, copied, failed }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }


    const T0 = Date.now();
    const TIME_BUDGET_MS = 110_000; // Hard stop before 150s edge timeout
    const overBudget = () => (Date.now() - T0) > TIME_BUDGET_MS;
    let migrated = 0;
    let skipped = 0;
    const errors: string[] = [];
    let remaining = 0;

    for (const tgt of TARGETS) {
      // Build filter: contains "supabase.co/storage"
      // For arrays, we filter rows where ANY element matches.
      let q;
      if (tgt.isArray) {
        // Can't easily filter array text contents server-side; fetch a window and filter client-side.
        q = admin.from(tgt.table).select(`id, ${tgt.col}`).not(tgt.col, "is", null).limit(500);
      } else {
        q = admin.from(tgt.table).select(`id, ${tgt.col}`).ilike(tgt.col, "%supabase.co/storage%").limit(batchSize);
      }
      const { data: rows, error } = await q;
      if (error) {
        errors.push(`${tgt.table}.${tgt.col}: ${error.message}`);
        continue;
      }
      if (!rows?.length) continue;

      for (const row of rows) {
        if (overBudget()) break;
        const val = (row as Record<string, unknown>)[tgt.col];

        if (tgt.isArray && Array.isArray(val)) {
          const arr = val as string[];
          const needsMigration = arr.some((u) => isSupabaseStorageUrl(u));
          if (!needsMigration) continue;
          remaining++;
          if (remaining > batchSize) break;
          if (dryRun) continue;
          const newArr: string[] = [];
          let touched = false;
          for (const u of arr) {
            if (isSupabaseStorageUrl(u)) {
              try {
                const newU = await migrateUrl(admin, u);
                if (newU) {
                  newArr.push(newU);
                  touched = true;
                  migrated++;
                } else {
                  newArr.push(u);
                  skipped++;
                }
              } catch (e) {
                newArr.push(u);
                errors.push(`${tgt.table}#${(row as { id: string }).id}: ${e instanceof Error ? e.message : "err"}`);
              }
            } else {
              newArr.push(u);
            }
          }
          if (touched) {
            const { error: upErr } = await admin
              .from(tgt.table)
              .update({ [tgt.col]: newArr })
              .eq("id", (row as { id: string }).id);
            if (upErr) errors.push(`update ${tgt.table}: ${upErr.message}`);
          }
        } else if (typeof val === "string" && isSupabaseStorageUrl(val)) {
          remaining++;
          if (dryRun) continue;
          try {
            const newU = await migrateUrl(admin, val);
            if (!newU) {
              skipped++;
              continue;
            }
            const { error: upErr } = await admin
              .from(tgt.table)
              .update({ [tgt.col]: newU })
              .eq("id", (row as { id: string }).id);
            if (upErr) {
              errors.push(`update ${tgt.table}#${(row as { id: string }).id}: ${upErr.message}`);
            } else {
              migrated++;
            }
          } catch (e) {
            errors.push(`${tgt.table}#${(row as { id: string }).id}: ${e instanceof Error ? e.message : "err"}`);
          }
        }
      }

      // Stop early if we've hit the batch limit or the time budget
      if (overBudget()) break;
      if (migrated + errors.length >= batchSize) break;
    }

    // Quick total-remaining estimate (sum of all non-array tables)
    let totalRemaining = 0;
    for (const tgt of TARGETS) {
      if (tgt.isArray) continue;
      const { count } = await admin
        .from(tgt.table)
        .select("id", { count: "exact", head: true })
        .ilike(tgt.col, "%supabase.co/storage%");
      totalRemaining += count || 0;
    }

    return new Response(
      JSON.stringify({
        success: true,
        dry_run: dryRun,
        migrated,
        skipped,
        errors: errors.slice(0, 20),
        error_count: errors.length,
        total_remaining: totalRemaining,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[r2-migrate-images] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
