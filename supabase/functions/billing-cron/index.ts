// Daily billing cron — runs trial expirations, grace periods, and suspensions.
// Should be invoked by a scheduled cron (pg_cron).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = new Date().toISOString();
    const graceEnd = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

    let trialExpired = 0;
    let activeExpired = 0;
    let suspended = 0;

    // Fetch all stores in commission billing mode — these skip subscription billing entirely
    const { data: commissionStores } = await supabase
      .from("stores")
      .select("id")
      .eq("billing_mode", "commission");
    const commissionStoreIds = new Set((commissionStores || []).map((s: any) => s.id));
    const isCommission = (storeId: string) => commissionStoreIds.has(storeId);

    // 1. Trialing → past_due (trial ended, no payment) — only for paid plans
    const { data: expiredTrials } = await supabase
      .from("store_plan_assignments")
      .select("id, store_id, plan_id, custom_price, is_free_lifetime, is_one_time, plans:plan_id(price)")
      .eq("billing_status", "trialing")
      .lt("trial_ends_at", now);

    for (const row of expiredTrials || []) {
      const r = row as any;
      if (isCommission(r.store_id)) continue;
      // Skip overridden plans
      if (r.is_free_lifetime) {
        await supabase.from("store_plan_assignments").update({ billing_status: "lifetime" }).eq("id", r.id);
        continue;
      }
      const price = Number(r.custom_price ?? r.plans?.price ?? 0);
      if (price <= 0) {
        // Free plan — extend indefinitely as active
        await supabase.from("store_plan_assignments")
          .update({ billing_status: "active", current_period_end: null })
          .eq("id", r.id);
        continue;
      }
      // Paid → enter grace period
      await supabase.from("store_plan_assignments")
        .update({ billing_status: "past_due", grace_period_ends_at: graceEnd })
        .eq("id", r.id);
      trialExpired++;
    }

    // 2. Active → past_due (period ended, no renewal)
    const { data: expiredActive } = await supabase
      .from("store_plan_assignments")
      .select("id, store_id, custom_price, is_free_lifetime, is_one_time, plans:plan_id(price)")
      .eq("billing_status", "active")
      .not("current_period_end", "is", null)
      .lt("current_period_end", now);

    for (const row of expiredActive || []) {
      const r = row as any;
      if (isCommission(r.store_id)) continue;
      if (r.is_free_lifetime || r.is_one_time) continue;
      const price = Number(r.custom_price ?? r.plans?.price ?? 0);
      if (price <= 0) continue;

      await supabase.from("store_plan_assignments")
        .update({ billing_status: "past_due", grace_period_ends_at: graceEnd })
        .eq("id", r.id);
      activeExpired++;
    }

    // 3. past_due → suspended (grace period ended)
    // NOTE: We do NOT touch stores.is_suspended — storefront stays live.
    // The dashboard paywall blocks merchant access until they pay.
    const { data: expiredGrace } = await supabase
      .from("store_plan_assignments")
      .select("id, store_id")
      .eq("billing_status", "past_due")
      .lt("grace_period_ends_at", now);

    for (const row of expiredGrace || []) {
      if (isCommission((row as any).store_id)) continue;
      await supabase.from("store_plan_assignments")
        .update({ billing_status: "suspended" })
        .eq("id", (row as any).id);
      suspended++;
    }

    return new Response(JSON.stringify({
      ok: true,
      trial_expired: trialExpired,
      active_expired: activeExpired,
      suspended,
      ran_at: now,
    }), { headers: { ...corsHeaders, "content-type": "application/json" } });
  } catch (err) {
    console.error("billing-cron error", err);
    return new Response(JSON.stringify({ error: String((err as any)?.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
