import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function csvEscape(v: any): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function rowsToCsv(headers: string[], rows: any[]): string {
  const lines = [headers.join(",")];
  for (const r of rows) lines.push(headers.map((h) => csvEscape(r[h])).join(","));
  return lines.join("\n");
}

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

    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", ud.user.id).eq("role", "admin").maybeSingle();
    const isAdmin = !!roleRow;

    let scopedPartnerId: string | null = null;
    if (!isAdmin) {
      const { data: p } = await admin.from("partners").select("id").eq("user_id", ud.user.id).maybeSingle();
      if (!p) return j({ error: "forbidden" }, 403);
      scopedPartnerId = p.id;
    }

    const url = new URL(req.url);
    const kind = url.searchParams.get("kind") ?? "commissions";
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const partnerId = url.searchParams.get("partner_id");
    const status = url.searchParams.get("status");
    const planId = url.searchParams.get("plan_id");

    const filterPartner = (q: any) => (scopedPartnerId ? q.eq("partner_id", scopedPartnerId) : (partnerId ? q.eq("partner_id", partnerId) : q));
    const filterDate = (q: any, col = "created_at") => {
      if (from) q = q.gte(col, from);
      if (to) q = q.lte(col, to);
      return q;
    };

    let csv = ""; let filename = `${kind}.csv`;

    if (kind === "commissions") {
      let q: any = admin.from("partner_commissions").select("id,partner_id,store_id,payment_id,amount_paid,percentage,commission_amount,status,created_at").order("created_at", { ascending: false }).limit(10000);
      q = filterPartner(q); q = filterDate(q);
      if (status) q = q.eq("status", status);
      const { data, error } = await q;
      if (error) return j({ error: error.message }, 400);
      csv = rowsToCsv(["id","partner_id","store_id","payment_id","amount_paid","percentage","commission_amount","status","created_at"], data ?? []);
    } else if (kind === "payouts") {
      let q: any = admin.from("partner_withdrawals").select("id,partner_id,amount,method,status,payout_ref,requested_at,processed_at,created_at").order("created_at", { ascending: false }).limit(10000);
      q = filterPartner(q); q = filterDate(q);
      if (status) q = q.eq("status", status);
      const { data, error } = await q;
      if (error) return j({ error: error.message }, 400);
      csv = rowsToCsv(["id","partner_id","amount","method","status","payout_ref","requested_at","processed_at","created_at"], data ?? []);
    } else if (kind === "partner-performance") {
      if (!isAdmin) return j({ error: "forbidden" }, 403);
      const { data: ps } = await admin.from("partners").select("id,partner_code,name,email,status,commission_percentage,total_earnings,created_at").limit(10000);
      csv = rowsToCsv(["id","partner_code","name","email","status","commission_percentage","total_earnings","created_at"], ps ?? []);
    } else if (kind === "subscriptions") {
      let refQ: any = admin.from("partner_referrals").select("partner_id,store_id,status,first_paid_at,created_at").limit(10000);
      refQ = filterPartner(refQ);
      const { data: refs } = await refQ;
      const storeIds = (refs ?? []).map((r: any) => r.store_id).filter(Boolean);
      const { data: assigns } = storeIds.length ? await admin.from("store_plan_assignments").select("store_id,plan_id,billing_status,custom_price").in("store_id", storeIds) : { data: [] as any[] };
      const map = new Map((assigns ?? []).map((a: any) => [a.store_id, a]));
      const rows = (refs ?? []).map((r: any) => {
        const a = map.get(r.store_id) ?? {};
        return { partner_id: r.partner_id, store_id: r.store_id, plan_id: a.plan_id, billing_status: a.billing_status, custom_price: a.custom_price, first_paid_at: r.first_paid_at, created_at: r.created_at };
      });
      csv = rowsToCsv(["partner_id","store_id","plan_id","billing_status","custom_price","first_paid_at","created_at"], rows);
    } else {
      return j({ error: "unknown kind" }, 400);
    }

    return new Response(csv, { status: 200, headers: { ...corsHeaders, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"` } });
  } catch (e) {
    return j({ error: String(e) }, 500);
  }
});
function j(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
