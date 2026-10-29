// Utkal Watch-only bulk WhatsApp campaigns from an uploaded customer list.
// Enqueues into wa_send_queue; wa-queue-worker delivers through wa-platform-send,
// which keeps opt-out, daily/weekly marketing caps and recent-buyer guards.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, normalizePhone } from "../_shared/wa-platform.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const UTKAL_SLUG = "utkalwatches";
const MAX_RECIPIENTS = 10000;

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const { data: store } = await admin.from("stores").select("id, owner_id").eq("slug", UTKAL_SLUG).maybeSingle();
    if (!store) return json({ error: "store_not_found" }, 404);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if ((store as any).owner_id !== user.id && isAdmin !== true) return json({ error: "forbidden" }, 403);
    const storeId = (store as any).id as string;

    let body: any;
    try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
    const action = String(body?.action || "");

    const ownCampaign = async (id: unknown) => {
      if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return null;
      const { data } = await admin.from("platform_wa_campaigns").select("*").eq("id", id).maybeSingle();
      if (!data || (data as any).audience_filter?.upload_store_id !== storeId) return null;
      return data as any;
    };

    if (action === "templates") {
      const { data, error } = await admin.from("platform_wa_templates")
        .select("name, language, category, header_type, header_media_url, body_text, footer_text, buttons, meta_status")
        .ilike("name", "utkal%").eq("meta_status", "APPROVED").order("name");
      if (error) return json({ error: error.message }, 500);
      return json({ templates: data || [] });
    }

    if (action === "campaigns") {
      const { data, error } = await admin.from("platform_wa_campaigns")
        .select("id, name, template_name, status, audience_size, queued_count, created_at, started_at")
        .contains("audience_filter", { upload_store_id: storeId })
        .order("created_at", { ascending: false }).limit(30);
      if (error) return json({ error: error.message }, 500);
      return json({ campaigns: data || [] });
    }

    if (action === "stats") {
      const camp = await ownCampaign(body.campaign_id);
      if (!camp) return json({ error: "not_found" }, 404);
      const { data, error } = await admin.rpc("wa_campaign_upload_stats" as any, { _campaign_id: camp.id });
      if (error) return json({ error: error.message }, 500);
      const s = data as any;
      if (camp.status === "queued" && s.total > 0 && s.pending === 0) {
        await admin.from("platform_wa_campaigns").update({ status: "completed", sent_count: s.accepted, failed_count: s.failed + s.not_delivered } as any).eq("id", camp.id);
        camp.status = "completed";
      }
      return json({ campaign: { id: camp.id, name: camp.name, template_name: camp.template_name, status: camp.status, created_at: camp.created_at, audience_size: camp.audience_size, upload: camp.audience_filter }, stats: s });
    }

    if (action === "pause" || action === "resume" || action === "cancel") {
      const camp = await ownCampaign(body.campaign_id);
      if (!camp) return json({ error: "not_found" }, 404);
      const status = action === "pause" ? "paused" : action === "resume" ? "queued" : "cancelled";
      await admin.from("platform_wa_campaigns").update({ status } as any).eq("id", camp.id);
      if (action === "cancel") {
        await admin.from("wa_send_queue").update({ status: "skipped", last_error: "campaign_cancelled" } as any)
          .eq("campaign_id", camp.id).eq("status", "pending");
      }
      return json({ ok: true, status });
    }

    if (action === "create") {
      const name = String(body.name || "").trim().slice(0, 120);
      const templateName = String(body.template_name || "");
      const raw: unknown[] = Array.isArray(body.phones) ? body.phones : [];
      if (!name) return json({ error: "Campaign name is required" }, 400);
      if (!raw.length) return json({ error: "No numbers uploaded" }, 400);
      if (raw.length > 50000) return json({ error: "File too large" }, 400);

      const { data: tpl } = await admin.from("platform_wa_templates").select("name, meta_status")
        .eq("name", templateName).ilike("name", "utkal%").maybeSingle();
      if (!tpl || (tpl as any).meta_status !== "APPROVED") return json({ error: "Template is not approved" }, 400);

      const seen = new Set<string>();
      let invalid = 0, duplicates = 0;
      for (const r of raw) {
        const p = normalizePhone(String(r ?? ""));
        if (!p) { invalid++; continue; }
        if (seen.has(p)) { duplicates++; continue; }
        seen.add(p);
      }
      let phones = [...seen];
      // Opt-outs (store-scoped or global rows).
      const optedOut = new Set<string>();
      for (let i = 0; i < phones.length; i += 500) {
        const chunk = phones.slice(i, i + 500);
        const { data } = await admin.from("whatsapp_optouts").select("phone").in("phone", chunk);
        (data || []).forEach((o: any) => optedOut.add(o.phone));
      }
      phones = phones.filter((p) => !optedOut.has(p));
      if (phones.length > MAX_RECIPIENTS) return json({ error: `Maximum ${MAX_RECIPIENTS} numbers per campaign (got ${phones.length})` }, 400);
      if (!phones.length) return json({ error: "No valid numbers left after cleaning" }, 400);

      const upload = { upload_store_id: storeId, source: "upload", uploaded: raw.length, invalid, duplicates, opted_out: optedOut.size };
      const { data: camp, error: cErr } = await admin.from("platform_wa_campaigns").insert({
        name, template_name: templateName, audience_filter: upload, status: "draft",
        created_by: user.id, audience_size: phones.length, template_vars: {},
      } as any).select("id").single();
      if (cErr) return json({ error: cErr.message }, 500);
      const campId = (camp as any).id;

      const now = new Date().toISOString();
      let enqueued = 0;
      for (let i = 0; i < phones.length; i += 500) {
        const rows = phones.slice(i, i + 500).map((p) => ({
          store_id: storeId, recipient_phone: p, template_name: templateName, message_type: "campaign",
          params: [], template_vars: {}, priority: 7, scheduled_at: now, campaign_id: campId,
        }));
        const { error } = await admin.from("wa_send_queue").insert(rows as any);
        if (error) {
          await admin.from("wa_send_queue").delete().eq("campaign_id", campId);
          await admin.from("platform_wa_campaigns").update({ status: "failed", failed_reason: error.message } as any).eq("id", campId);
          return json({ error: `Could not queue messages: ${error.message}` }, 500);
        }
        enqueued += rows.length;
      }
      await admin.from("platform_wa_campaigns").update({ status: "queued", queued_count: enqueued, started_at: now } as any).eq("id", campId);
      return json({ ok: true, campaign_id: campId, enqueued, ...upload });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error("utkal-wa-bulk error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
