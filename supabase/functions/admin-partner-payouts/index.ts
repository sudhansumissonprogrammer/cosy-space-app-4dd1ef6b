// Returns the full withdrawal queue for admins, joined with partner info.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "unauthorized" }, 401);
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } }
    );
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json({ error: "unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: roleRow } = await admin.from("user_roles").select("role")
      .eq("user_id", userData.user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "forbidden" }, 403);

    const { data: rows } = await admin
      .from("partner_withdrawals")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    const partnerIds = Array.from(new Set((rows ?? []).map((r: any) => r.partner_id)));
    const { data: partners } = partnerIds.length
      ? await admin.from("partners").select("id,partner_code,name,email,mobile").in("id", partnerIds)
      : { data: [] as any[] };
    const pmap = new Map((partners ?? []).map((p: any) => [p.id, p]));

    const enriched = (rows ?? []).map((r: any) => ({ ...r, partner: pmap.get(r.partner_id) ?? null }));

    return json({ withdrawals: enriched });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
