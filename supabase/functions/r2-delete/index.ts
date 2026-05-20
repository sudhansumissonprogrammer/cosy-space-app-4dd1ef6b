/**
 * r2-delete — Deletes one or more objects from R2 (SigV4 DELETE).
 *
 * POST body: { urls: string[] }  // cdn.shopbanao.in URLs OR raw bucket-prefixed keys
 * Returns: { deleted: number, skipped: number, errors: string[] }
 *
 * Auth: JWT required. Caller must own each object (path must start with
 *       `<bucket>/<userId>/...`) OR be admin.
 *
 * Silently ignores non-R2 URLs (e.g. legacy supabase.co/storage URLs) so it
 * is safe to feed mixed lists from delete-store cleanup flows.
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
  "category-images",
  "media-library",
  "store-pages",
  "external",
]);

/** Pull "<bucket>/<path>" key out of a cdn URL or accept a raw key. */
function urlToKey(input: string): string | null {
  if (!input) return null;
  let key = input;
  if (R2_PUBLIC_URL && input.startsWith(R2_PUBLIC_URL + "/")) {
    key = input.slice(R2_PUBLIC_URL.length + 1);
  } else if (input.startsWith("https://cdn.shopbanao.in/")) {
    key = input.slice("https://cdn.shopbanao.in/".length);
  } else if (input.startsWith("http")) {
    // Not an R2 URL — skip
    return null;
  }
  // Strip query string
  key = key.split("?")[0];
  if (!key) return null;
  const bucket = key.split("/")[0];
  if (!ALLOWED_BUCKETS.has(bucket)) return null;
  return key;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    // Admin check (admins can delete anything; otherwise must own path)
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: roleData } = await admin
      .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    const isAdmin = !!roleData;

    let body: { urls?: string[] } = {};
    try { body = await req.json(); } catch { /* empty */ }
    const urls = Array.isArray(body.urls) ? body.urls : [];
    if (urls.length === 0) {
      return new Response(JSON.stringify({ deleted: 0, skipped: 0, errors: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (urls.length > 500) {
      return new Response(JSON.stringify({ error: "Too many urls (max 500)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let deleted = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const u of urls) {
      const key = urlToKey(u);
      if (!key) { skipped++; continue; }

      // Ownership check: key like "<bucket>/<userId>/..." unless admin
      if (!isAdmin) {
        const parts = key.split("/");
        if (parts.length < 3 || parts[1] !== userId) {
          skipped++;
          continue;
        }
      }

      try {
        const res = await r2.fetch(`${r2Endpoint}/${key}`, { method: "DELETE" });
        await res.text();
        if (res.ok || res.status === 204 || res.status === 404) deleted++;
        else errors.push(`${key}: ${res.status}`);
      } catch (e) {
        errors.push(`${key}: ${e instanceof Error ? e.message : "err"}`);
      }
    }

    return new Response(
      JSON.stringify({ deleted, skipped, errors: errors.slice(0, 20), error_count: errors.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[r2-delete] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
