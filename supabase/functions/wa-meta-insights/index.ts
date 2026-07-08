// Fetches phone-number quality/limits + template count directly from Meta Graph API.
// Admin-only. Falls back gracefully if credentials are missing.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { metaFetch } from "../_shared/wa-platform.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") || "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // AuthN: verify caller is an admin
    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json({ error: "unauthorized" }, 401);
    const admin = createClient(url, service);
    const { data: roleData } = await admin
      .from("user_roles").select("role").eq("user_id", userData.user.id).eq("role", "admin").maybeSingle();
    if (!roleData) return json({ error: "forbidden" }, 403);

    // Resolve creds: DB first, secrets fallback
    const { data: cfg } = await admin
      .from("platform_config")
      .select("wa_phone_number_id, wa_waba_id, wa_access_token")
      .limit(1).maybeSingle();

    const phoneId = cfg?.wa_phone_number_id || Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
    const wabaId  = cfg?.wa_waba_id         || Deno.env.get("WHATSAPP_BUSINESS_ACCOUNT_ID");
    const token   = cfg?.wa_access_token    || Deno.env.get("WHATSAPP_ACCESS_TOKEN") || Deno.env.get("WA_ACCESS_TOKEN");

    if (!phoneId || !token) return json({ error: "missing_credentials" }, 400);

    const H = { Authorization: `Bearer ${token}` };
    const V = "v21.0";

    // Phone number details (quality, name status, throughput, verified name, limits)
    const phoneRes = await metaFetch(admin,
      `https://graph.facebook.com/${V}/${phoneId}?fields=verified_name,display_phone_number,quality_rating,name_status,platform_type,throughput,messaging_limit_tier,code_verification_status`,
      { headers: H },
      { source: "wa-meta-insights:phone" },
    );
    const phone = phoneRes.body;

    let templates: any = null;
    let waba: any = null;
    if (wabaId) {
      const [tRes, wRes] = await Promise.all([
        metaFetch(admin, `https://graph.facebook.com/${V}/${wabaId}/message_templates?fields=name,status,category,language&limit=200`, { headers: H }, { source: "wa-meta-insights:templates" }),
        metaFetch(admin, `https://graph.facebook.com/${V}/${wabaId}?fields=name,timezone_id,message_template_namespace,on_behalf_of_business_info`, { headers: H }, { source: "wa-meta-insights:waba" }),
      ]);
      templates = tRes.body;
      waba = wRes.body;
    }

    // Persist quality rating for platform_config so UI shows fresh number
    if (phone?.quality_rating) {
      await admin.from("platform_config").update({
        wa_quality_rating: phone.quality_rating,
        wa_quality_updated_at: new Date().toISOString(),
        wa_messaging_tier: phone.messaging_limit_tier ?? null,
      }).eq("id", (await admin.from("platform_config").select("id").limit(1).maybeSingle()).data?.id);
    }

    const tplStats = Array.isArray(templates?.data)
      ? templates.data.reduce((acc: any, t: any) => {
          acc.total++;
          acc.by_status[t.status] = (acc.by_status[t.status] || 0) + 1;
          acc.by_category[t.category] = (acc.by_category[t.category] || 0) + 1;
          return acc;
        }, { total: 0, by_status: {}, by_category: {} })
      : null;

    return json({
      phone: phone?.error ? { error: phone.error } : phone,
      waba:  waba?.error  ? { error: waba.error  } : waba,
      templates: tplStats,
      fetched_at: new Date().toISOString(),
    });
  } catch (e: any) {
    return json({ error: e?.message || "internal_error" }, 500);
  }
});
