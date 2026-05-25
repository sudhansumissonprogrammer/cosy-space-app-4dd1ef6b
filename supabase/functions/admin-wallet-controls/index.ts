// Admin-only: switch billing mode + wallet adjustments + commission config
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const j = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return j({ error: "unauthorized" }, 401);

    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: ud } = await userClient.auth.getUser();
    if (!ud?.user) return j({ error: "unauthorized" }, 401);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: role } = await admin.from("user_roles").select("role")
      .eq("user_id", ud.user.id).eq("role", "admin").maybeSingle();
    if (!role) return j({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const { action, store_id } = body ?? {};
    if (!action || !store_id) return j({ error: "action and store_id required" }, 400);

    switch (action) {
      case "set_billing_mode": {
        const mode = String(body.mode || "");
        if (!["subscription", "commission"].includes(mode)) {
          return j({ error: "invalid mode" }, 400);
        }
        const { error } = await admin.rpc("admin_set_billing_mode", { _store_id: store_id, _mode: mode });
        if (error) return j({ error: error.message }, 400);
        return j({ ok: true });
      }
      case "update_config": {
        const { commission_percentage, min_recharge, low_balance_threshold } = body;
        const patch: any = {};
        if (commission_percentage != null) {
          const n = Number(commission_percentage);
          if (!(n >= 0 && n <= 100)) return j({ error: "percentage 0-100" }, 400);
          patch.commission_percentage = n;
        }
        if (min_recharge != null) {
          const n = Number(min_recharge);
          if (!(n >= 100 && n <= 100000)) return j({ error: "min_recharge 100-100000" }, 400);
          patch.min_recharge = n;
        }
        if (low_balance_threshold != null) {
          const n = Number(low_balance_threshold);
          if (n < 0) return j({ error: "invalid threshold" }, 400);
          patch.low_balance_threshold = n;
        }
        // upsert
        await admin.from("store_commission_config")
          .upsert({ store_id, ...patch }, { onConflict: "store_id" });
        return j({ ok: true });
      }
      case "wallet_adjust": {
        const { direction, amount, note } = body;
        // Run via userClient so auth.uid() is populated for the RPC's internal admin check
        const { data, error } = await userClient.rpc("wallet_adjust_store", {
          _store_id: store_id, _direction: direction, _amount: Number(amount), _note: note ?? null,
        });
        if (error) return j({ error: error.message }, 400);
        return j({ ok: true, new_balance: data });
      }
      case "get_summary": {
        const [w, c, l, r, s] = await Promise.all([
          admin.from("store_wallets").select("*").eq("store_id", store_id).maybeSingle(),
          admin.from("store_commission_config").select("*").eq("store_id", store_id).maybeSingle(),
          admin.from("store_wallet_ledger").select("*").eq("store_id", store_id).order("created_at", { ascending: false }).limit(100),
          admin.from("store_wallet_recharges").select("*").eq("store_id", store_id).order("created_at", { ascending: false }).limit(50),
          admin.from("stores").select("id, name, slug, billing_mode").eq("id", store_id).maybeSingle(),
        ]);
        return j({
          store: s.data, wallet: w.data, config: c.data,
          ledger: l.data ?? [], recharges: r.data ?? [],
        });
      }
      default:
        return j({ error: "unknown action" }, 400);
    }
  } catch (e) {
    return j({ error: String(e) }, 500);
  }
});
