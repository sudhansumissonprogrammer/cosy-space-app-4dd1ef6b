import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return j({ error: "unauthorized" }, 401);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: ud } = await userClient.auth.getUser();
    if (!ud?.user) return j({ error: "unauthorized" }, 401);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: roleRow } = await admin.from("user_roles").select("role")
      .eq("user_id", ud.user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return j({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const { action, partner_id, ...args } = body ?? {};
    if (!action || !partner_id) return j({ error: "action and partner_id required" }, 400);

    switch (action) {
      case "set_partner_status": {
        const { status, note } = args;
        if (!["active", "suspended", "banned", "rejected", "pending"].includes(status))
          return j({ error: "invalid status" }, 400);
        const { data: oldP } = await admin.from("partners").select("status").eq("id", partner_id).maybeSingle();
        const { error } = await admin.from("partners").update({ status, updated_at: new Date().toISOString() }).eq("id", partner_id);
        if (error) return j({ error: error.message }, 400);
        await admin.rpc("log_partner_audit", {
          _action: "set_partner_status", _target_type: "partner", _target_id: partner_id,
          _old: oldP, _new: { status }, _note: note ?? null,
        });
        return j({ ok: true });
      }
      case "pause_payouts":
      case "resume_payouts": {
        const paused = action === "pause_payouts";
        const { error } = await admin.from("partners").update({ payouts_paused: paused, updated_at: new Date().toISOString() }).eq("id", partner_id);
        if (error) return j({ error: error.message }, 400);
        await admin.rpc("log_partner_audit", {
          _action: action, _target_type: "partner", _target_id: partner_id,
          _old: null, _new: { payouts_paused: paused }, _note: args.note ?? null,
        });
        return j({ ok: true });
      }
      case "wallet_adjustment": {
        const { direction, bucket, amount, note } = args;
        const { error } = await admin.rpc("wallet_adjust", {
          _partner_id: partner_id, _direction: direction, _bucket: bucket,
          _amount: Number(amount), _note: note ?? null,
        });
        if (error) return j({ error: error.message }, 400);
        return j({ ok: true });
      }
      case "set_commission_percentage": {
        const { percentage, note } = args;
        const pct = Number(percentage);
        if (!Number.isFinite(pct) || pct < 0 || pct > 100) return j({ error: "invalid percentage" }, 400);
        const { data: oldP } = await admin.from("partners").select("commission_percentage").eq("id", partner_id).maybeSingle();
        const { error } = await admin.from("partners").update({ commission_percentage: pct, updated_at: new Date().toISOString() }).eq("id", partner_id);
        if (error) return j({ error: error.message }, 400);
        await admin.rpc("log_partner_audit", {
          _action: "set_commission_percentage", _target_type: "partner", _target_id: partner_id,
          _old: oldP, _new: { commission_percentage: pct }, _note: note ?? null,
        });
        return j({ ok: true });
      }
      default:
        return j({ error: "unknown action" }, 400);
    }
  } catch (e) {
    return j({ error: String(e) }, 500);
  }
});
function j(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
