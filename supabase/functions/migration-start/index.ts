/**
 * migration-start — Create a migration_jobs row and kick off the worker.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { assertSafePublicUrl } from "../_shared/migration/safe-fetch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supaUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: claims } = await supaUser.auth.getClaims(auth.replace("Bearer ", ""));
    const userId = claims?.claims?.sub as string | undefined;
    if (!userId) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const storeId = String(body.store_id || "");
    const platform = String(body.platform || "generic").toLowerCase();
    const sourceUrl = String(body.source_url || "").trim();
    const credentials = (body.credentials ?? {}) as Record<string, string>;
    const entities = Array.isArray(body.entities) && body.entities.length
      ? (body.entities as string[])
      : ["products"];

    if (!storeId || !platform || !sourceUrl) {
      return json({ error: "store_id, platform, and source_url are required" }, 400);
    }

    let normalized = "";
    try {
      normalized = assertSafePublicUrl(sourceUrl).toString();
    } catch {
      return json({ error: "Enter a valid store URL (e.g. mystore.myshopify.com)" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: store, error: storeErr } = await admin
      .from("stores")
      .select("id, owner_id")
      .eq("id", storeId)
      .maybeSingle();
    if (storeErr || !store) return json({ error: "Store not found" }, 404);

    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (store.owner_id !== userId && !isAdmin) {
      return json({ error: "Forbidden" }, 403);
    }

    const { data: existing } = await admin
      .from("migration_jobs")
      .select("id")
      .eq("store_id", storeId)
      .in("status", ["pending", "running"])
      .limit(1);
    if (existing && existing.length > 0) {
      return json({ error: "A migration is already running for this store." }, 409);
    }

    const { data: job, error: insErr } = await admin
      .from("migration_jobs")
      .insert({
        store_id: storeId,
        user_id: userId,
        source_platform: platform,
        source_url: normalized,
        detected_platform: body.detected_platform || platform,
        discovered_counts: body.discovered_counts || {},
        credentials,
        entities,
        status: "pending",
        progress: {},
        cursor: {},
      })
      .select("id")
      .single();
    if (insErr) return json({ error: insErr.message }, 500);

    const worker = fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/migration-worker`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ job_id: job.id }),
    }).catch((error) => console.error("[migration-start] worker launch failed", error));
    // Keep the invocation alive after returning the job ID to the owner.
    // A detached fetch can be cancelled when this isolate shuts down.
    // @ts-ignore EdgeRuntime is supplied by the hosted function runtime
    if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(worker);
    else await worker;

    return json({ job_id: job.id });
  } catch (err) {
    console.error("[migration-start] error:", err);
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
