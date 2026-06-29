// Admin-triggered platform campaign runner.
// Reads platform_wa_campaigns row, expands audience (very basic in Phase 1:
// storefront_customers across all stores OR a single store_id filter),
// sends in chunks via wa-platform-send.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, normalizePhone, getCronSecret } from "../_shared/wa-platform.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);
  const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
  if (!isAdmin) return json({ error: "forbidden" }, 403);

  let body: { campaign_id: string };
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }

  const { data: camp } = await admin.from("platform_wa_campaigns").select("*").eq("id", body.campaign_id).maybeSingle();
  if (!camp) return json({ error: "not_found" }, 404);

  await admin.from("platform_wa_campaigns").update({ status: "running" } as any).eq("id", body.campaign_id);

  const filter = ((camp as any).audience_filter || {}) as { store_id?: string; all_stores?: boolean };
  let q = admin.from("storefront_customers").select("phone, name, store_id").not("phone", "is", null);
  if (filter.store_id) q = q.eq("store_id", filter.store_id);
  const { data: customers } = await q.limit(5000);

  let sent = 0, failed = 0;
  for (const c of customers ?? []) {
    const phone = normalizePhone((c as any).phone);
    if (!phone) { failed++; continue; }
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/wa-platform-send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": (await getCronSecret(admin)) || "",
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
      },
      body: JSON.stringify({
        mode: "automation",
        store_id: (c as any).store_id,
        recipient_phone: phone,
        recipient_name: (c as any).name,
        template_name: (camp as any).template_name,
        template_params: [(c as any).name || "there"],
        message_type: "campaign",
      }),
    });
    if (resp.ok) sent++; else failed++;
  }

  await admin
    .from("platform_wa_campaigns")
    .update({ status: "completed", sent_count: sent, failed_count: failed } as any)
    .eq("id", body.campaign_id);

  return json({ ok: true, sent, failed });
});

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
