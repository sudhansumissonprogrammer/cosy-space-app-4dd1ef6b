// Scheduled sync for active shipments. Runs every 15 minutes.
// Picks only shipments whose next_sync_at has passed, so courier APIs are
// never hit on customer page loads.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BATCH = 200;
const MAX_AGE_DAYS = 30;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Retire stale shipments so they stop consuming courier quota.
  const cutoff = new Date(Date.now() - MAX_AGE_DAYS * 86400_000).toISOString();
  await admin.from("order_shipments")
    .update({ is_active: false, next_sync_at: null })
    .lt("created_at", cutoff).eq("is_active", true);

  const { data: due, error } = await admin
    .from("order_shipments")
    .select("id")
    .eq("is_active", true)
    .not("next_sync_at", "is", null)
    .lte("next_sync_at", new Date().toISOString())
    .order("next_sync_at", { ascending: true })
    .limit(BATCH);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let ok = 0, failed = 0;
  // Small concurrency so one slow courier doesn't stall the batch.
  const queue = [...(due ?? [])];
  const workers = Array.from({ length: 5 }, async () => {
    while (queue.length) {
      const row = queue.shift();
      if (!row) break;
      try {
        const r = await fetch(`${SUPABASE_URL}/functions/v1/shipment-track`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
          body: JSON.stringify({ shipment_id: row.id, internal: true }),
        });
        r.ok ? ok++ : failed++;
      } catch { failed++; }
    }
  });
  await Promise.all(workers);

  return new Response(JSON.stringify({ processed: (due ?? []).length, ok, failed }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
