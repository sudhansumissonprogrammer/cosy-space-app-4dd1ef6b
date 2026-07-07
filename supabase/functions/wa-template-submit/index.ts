// Admin-only edge function: create / edit / delete / refresh WhatsApp templates on Meta
// from inside /admin/whatsapp. Reads access token from platform_config, writes status back
// to platform_wa_templates, and audits every action.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GRAPH = "https://graph.facebook.com/v21.0";

type Btn =
  | { type: "URL"; text: string; url: string }
  | { type: "QUICK_REPLY"; text: string }
  | { type: "PHONE_NUMBER"; text: string; phone_number: string };

type Draft = {
  name: string;
  language: string;
  category: "UTILITY" | "MARKETING" | "AUTHENTICATION";
  header_type: "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
  header_text?: string | null;
  header_media_url?: string | null;
  body_text: string;
  footer_text?: string | null;
  buttons?: Btn[];
};

function extractVars(text: string): number[] {
  const found = new Set<number>();
  const re = /\{\{\s*(\d+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) found.add(Number(m[1]));
  return Array.from(found).sort((a, b) => a - b);
}

function buildBodySample(vars: number[]): string[][] {
  return vars.length ? [vars.map((_, i) => `Sample${i + 1}`)] : [];
}

function buttonExample(url: string): string[] | undefined {
  return extractVars(url).length ? ["sample-id"] : undefined;
}

function draftToComponents(d: Draft, headerHandle?: string | null): any[] {
  const components: any[] = [];
  if (d.header_type === "TEXT" && d.header_text) {
    const comp: any = { type: "HEADER", format: "TEXT", text: d.header_text };
    if (extractVars(d.header_text).length === 1) comp.example = { header_text: ["Sample"] };
    components.push(comp);
  } else if ((d.header_type === "IMAGE" || d.header_type === "VIDEO" || d.header_type === "DOCUMENT") && headerHandle) {
    components.push({
      type: "HEADER",
      format: d.header_type,
      example: { header_handle: [headerHandle] },
    });
  }
  const bodyVars = extractVars(d.body_text);
  const body: any = { type: "BODY", text: d.body_text };
  if (bodyVars.length) body.example = { body_text: buildBodySample(bodyVars) };
  components.push(body);
  if (d.footer_text) components.push({ type: "FOOTER", text: d.footer_text });
  const btns = (d.buttons || []).map((b) => {
    if (b.type === "URL") {
      const out: any = { type: "URL", text: b.text, url: b.url };
      const example = buttonExample(b.url);
      if (example) out.example = example;
      return out;
    }
    if (b.type === "PHONE_NUMBER") return { type: "PHONE_NUMBER", text: b.text, phone_number: b.phone_number };
    return { type: "QUICK_REPLY", text: b.text };
  });
  if (btns.length) components.push({ type: "BUTTONS", buttons: btns });
  return components;
}

// Meta Resumable Upload API — turns a public URL into a `h` handle usable as
// header_handle for IMAGE/VIDEO/DOCUMENT template samples.
async function uploadHeaderMedia(
  mediaUrl: string,
  headerType: "IMAGE" | "VIDEO" | "DOCUMENT",
  appId: string,
  token: string,
): Promise<string> {
  const mediaResp = await fetch(mediaUrl);
  if (!mediaResp.ok) throw new Error(`Header media fetch failed (${mediaResp.status}) — the URL must be publicly reachable`);
  const buf = new Uint8Array(await mediaResp.arrayBuffer());
  const fileLength = buf.byteLength;
  if (!fileLength) throw new Error("Header media is empty");
  const contentType =
    mediaResp.headers.get("content-type") ||
    (headerType === "IMAGE" ? "image/jpeg" : headerType === "VIDEO" ? "video/mp4" : "application/pdf");
  const fileName = mediaUrl.split("/").pop()?.split("?")[0] ||
    (headerType === "IMAGE" ? "sample.jpg" : headerType === "VIDEO" ? "sample.mp4" : "sample.pdf");

  const startUrl = `${GRAPH}/${appId}/uploads?file_name=${encodeURIComponent(fileName)}&file_length=${fileLength}&file_type=${encodeURIComponent(contentType)}&access_token=${encodeURIComponent(token)}`;
  const startResp = await fetch(startUrl, { method: "POST" });
  const startJson = await startResp.json();
  if (!startResp.ok || !startJson?.id) throw new Error(`Upload session failed: ${sanitizeError(startJson)}`);
  const sessionId: string = startJson.id;

  const putResp = await fetch(`${GRAPH}/${sessionId}`, {
    method: "POST",
    headers: {
      Authorization: `OAuth ${token}`,
      file_offset: "0",
      "Content-Type": contentType,
    },
    body: buf,
  });
  const putJson = await putResp.json();
  if (!putResp.ok || !putJson?.h) throw new Error(`Upload failed: ${sanitizeError(putJson)}`);
  return putJson.h as string;
}

function normalizeUrlButtonVars(buttons: Btn[] | undefined): Btn[] {
  return (buttons || []).map((b) => {
    if (b.type !== "URL") return b;
    // Meta scopes URL button placeholders separately from body placeholders.
    // A URL button with one dynamic suffix must be {{1}}, not {{5}} after body vars.
    let seen = false;
    const url = b.url.replace(/\{\{\s*\d+\s*\}\}/g, () => {
      if (seen) return "";
      seen = true;
      return "{{1}}";
    });
    return { ...b, url };
  });
}

// Meta rejects headers containing emoji, asterisks, or newlines. Strip them.
function cleanHeaderText(t: string | null | undefined): string | null | undefined {
  if (!t) return t;
  return t
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/gu, "")
    .replace(/[*\n\r]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Meta rejects button labels with emojis, variables, newlines, or formatting marks.
function cleanButtonText(t: string | null | undefined): string {
  const cleaned = String(t || "")
    .replace(/\{\{\s*\d+\s*\}\}/g, "")
    .replace(/[\u{1F1E6}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}\u{FE0E}\u{FE0F}\u{200D}]/gu, "")
    .replace(/[*_~`\n\r]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 25)
    .trim();
  return cleaned || "View";
}

function normalizeDraft(raw: Draft): Draft {
  return {
    ...raw,
    header_text: cleanHeaderText(raw.header_text) as any,
    buttons: normalizeUrlButtonVars(raw.buttons).map((button) => ({
      ...button,
      text: cleanButtonText(button.text),
    } as Btn)),
  };
}


function sanitizeError(s: any): string {
  if (typeof s === "string") return s.slice(0, 800);
  const err = s?.error || s;
  const parts = [
    err?.message,
    err?.error_user_title,
    err?.error_user_msg,
    err?.error_data?.details,
    err?.code ? `code=${err.code}` : null,
    err?.error_subcode ? `subcode=${err.error_subcode}` : null,
  ].filter(Boolean);
  const msg = parts.length ? parts.join(" · ") : JSON.stringify(s);
  return String(msg).slice(0, 800);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const j = (status: number, body: any) => {
    if (status >= 400) console.error("wa-template-submit reject", status, JSON.stringify(body));
    return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  };

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return j(401, { error: "Unauthorized" });

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: ud, error: userErr } = await userClient.auth.getUser();
    if (userErr || !ud?.user?.id) return j(401, { error: "Unauthorized" });
    const userId = ud.user.id;

    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) return j(403, { error: "Forbidden — admin only" });

    const body = await req.json();
    const action = String(body?.action || "");
    const templateName = String(body?.template_name || body?.name || "");

    // Rate limit: ≤ 20 template ops / hour / admin (Meta throttles aggressive submitters).
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recent } = await admin
      .from("wa_template_audit")
      .select("id", { count: "exact", head: true })
      .eq("actor", userId)
      .gte("created_at", since);
    if ((recent || 0) >= 20) return j(429, { error: "Rate limit: 20 template ops per hour. Try again later." });

    const { data: cfg } = await admin
      .from("platform_config")
      .select("wa_access_token, wa_waba_id, wa_app_id")
      .limit(1)
      .maybeSingle();
    const WABA_ID = (cfg as any)?.wa_waba_id || Deno.env.get("META_WABA_ID");
    const APP_ID = (cfg as any)?.wa_app_id || Deno.env.get("META_APP_ID");
    const TOKEN =
      (cfg as any)?.wa_access_token ||
      Deno.env.get("WA_ACCESS_TOKEN") ||
      Deno.env.get("META_WHATSAPP_TOKEN");

    if (!WABA_ID) return j(400, { error: "WABA ID not configured in platform_config.wa_waba_id" });
    if (!TOKEN) return j(400, { error: "WhatsApp access token not configured (WA_ACCESS_TOKEN secret or platform_config.wa_access_token)" });

    const audit = async (act: string, status: string | null, detail: any) =>
      admin.from("wa_template_audit").insert({ template_name: templateName || "(unknown)", action: act, actor: userId, meta_status: status, detail } as any);

    // -------- CREATE --------
    if (action === "create") {
      const draft = normalizeDraft(body as Draft);
      if (!draft.name || !draft.body_text || !draft.category || !draft.language) {
        return j(400, { error: "Missing required fields (name, body_text, category, language)" });
      }
      let headerHandle: string | null = null;
      if ((draft.header_type === "IMAGE" || draft.header_type === "VIDEO" || draft.header_type === "DOCUMENT") && draft.header_media_url) {
        if (!APP_ID) return j(400, { error: "Meta App ID not configured — set it in Admin → WhatsApp → Meta credentials before submitting media-header templates." });
        try { headerHandle = await uploadHeaderMedia(draft.header_media_url, draft.header_type, APP_ID, TOKEN); }
        catch (e: any) { await audit("create", "error", { error: sanitizeError(e.message) }); return j(400, { error: e.message }); }
      }
      const components = draftToComponents(draft, headerHandle);
      const resp = await fetch(`${GRAPH}/${WABA_ID}/message_templates`, {
        method: "POST",
        headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          language: draft.language,
          category: draft.category,
          components,
        }),
      });
      const out = await resp.json();
      if (!resp.ok) {
        await audit("create", "error", { error: sanitizeError(out) });
        return j(resp.status, { error: sanitizeError(out) });
      }
      const status = (out?.status as string) || "PENDING";
      await admin.from("platform_wa_templates").update({
        buttons: draft.buttons || [],
        meta_template_id: out?.id || null,
        meta_status: status,
        meta_rejected_reason: null,
        submitted_at: new Date().toISOString(),
        paused: false,
        pause_reason: null,
      }).eq("name", draft.name);
      await audit("create", status, { id: out?.id });
      return j(200, { ok: true, meta_id: out?.id, meta_status: status });
    }

    // -------- EDIT --------
    if (action === "edit") {
      const draft = normalizeDraft(body as Draft);
      const { data: row } = await admin
        .from("platform_wa_templates")
        .select("meta_template_id")
        .eq("name", templateName)
        .maybeSingle();
      const id = (row as any)?.meta_template_id;
      // Fallback: row exists in DB but was never submitted to Meta
      // (meta_template_id is null — only saved as draft before). Treat this
      // Save & Submit click as a first-time create instead of failing.
      if (!id) {
        if (!draft.name || !draft.body_text || !draft.category || !draft.language) {
          return j(400, { error: "Missing required fields (name, body_text, category, language)" });
        }
        let hh: string | null = null;
        if ((draft.header_type === "IMAGE" || draft.header_type === "VIDEO" || draft.header_type === "DOCUMENT") && draft.header_media_url) {
          if (!APP_ID) return j(400, { error: "Meta App ID not configured — set it in Admin → WhatsApp → Meta credentials before submitting media-header templates." });
          try { hh = await uploadHeaderMedia(draft.header_media_url, draft.header_type, APP_ID, TOKEN); }
          catch (e: any) { await audit("create", "error", { error: sanitizeError(e.message) }); return j(400, { error: e.message }); }
        }
        const comps = draftToComponents(draft, hh);
        const cResp = await fetch(`${GRAPH}/${WABA_ID}/message_templates`, {
          method: "POST",
          headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({ name: draft.name, language: draft.language, category: draft.category, components: comps }),
        });
        const cOut = await cResp.json();
        if (!cResp.ok) {
          await audit("create", "error", { error: sanitizeError(cOut) });
          return j(cResp.status, { error: sanitizeError(cOut) });
        }
        const cStatus = (cOut?.status as string) || "PENDING";
        await admin.from("platform_wa_templates").update({
          buttons: draft.buttons || [],
          meta_template_id: cOut?.id || null,
          meta_status: cStatus,
          meta_rejected_reason: null,
          submitted_at: new Date().toISOString(),
          paused: false,
          pause_reason: null,
        }).eq("name", draft.name);
        await audit("create", cStatus, { id: cOut?.id, via: "edit-fallback" });
        return j(200, { ok: true, meta_id: cOut?.id, meta_status: cStatus });
      }



      let headerHandle: string | null = null;
      if ((draft.header_type === "IMAGE" || draft.header_type === "VIDEO" || draft.header_type === "DOCUMENT") && draft.header_media_url) {
        if (!APP_ID) return j(400, { error: "Meta App ID not configured — set it in Admin → WhatsApp → Meta credentials before submitting media-header templates." });
        try { headerHandle = await uploadHeaderMedia(draft.header_media_url, draft.header_type, APP_ID, TOKEN); }
        catch (e: any) { await audit("edit", "error", { error: sanitizeError(e.message) }); return j(400, { error: e.message }); }
      }
      const components = draftToComponents(draft, headerHandle);
      const resp = await fetch(`${GRAPH}/${id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ components, category: draft.category }),
      });
      const out = await resp.json();
      if (!resp.ok) {
        await audit("edit", "error", { error: sanitizeError(out) });
        return j(resp.status, { error: sanitizeError(out) });
      }
      await admin.from("platform_wa_templates").update({
        buttons: draft.buttons || [],
        meta_status: "PENDING",
        meta_rejected_reason: null,
        submitted_at: new Date().toISOString(),
      }).eq("name", templateName);
      await audit("edit", "PENDING", { id });
      return j(200, { ok: true });
    }

    // -------- DELETE --------
    if (action === "delete") {
      const params = new URLSearchParams({ name: templateName });
      const { data: row } = await admin
        .from("platform_wa_templates")
        .select("meta_template_id")
        .eq("name", templateName)
        .maybeSingle();
      const id = (row as any)?.meta_template_id;
      if (id) params.set("hsm_id", id);

      const resp = await fetch(`${GRAPH}/${WABA_ID}/message_templates?${params}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      const out = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        await audit("delete", "error", { error: sanitizeError(out) });
        return j(resp.status, { error: sanitizeError(out) });
      }
      await admin.from("platform_wa_templates").update({
        is_active: false,
        meta_status: "DELETED",
      }).eq("name", templateName);
      await audit("delete", "DELETED", {});
      return j(200, { ok: true });
    }

    // -------- REFRESH (single template status) --------
    if (action === "refresh") {
      // Fetch by name filter
      const url = `${GRAPH}/${WABA_ID}/message_templates?name=${encodeURIComponent(templateName)}&fields=name,status,id,category,language,quality_score,rejected_reason`;
      const resp = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
      const out = await resp.json();
      if (!resp.ok) {
        await audit("refresh", "error", { error: sanitizeError(out) });
        return j(resp.status, { error: sanitizeError(out) });
      }
      const row = (out?.data || []).find((r: any) => r?.name === templateName) || out?.data?.[0];
      if (!row) return j(404, { error: "Template not found on Meta" });
      const status = row.status || null;
      await admin.from("platform_wa_templates").update({
        meta_template_id: row.id || null,
        meta_status: status,
        meta_rejected_reason: row.rejected_reason || null,
        quality_score: row.quality_score?.score || row.quality_score || null,
        last_synced_at: new Date().toISOString(),
        paused: status === "REJECTED" || status === "PAUSED",
        pause_reason: status === "REJECTED" ? (row.rejected_reason || "rejected by meta") : null,
      }).eq("name", templateName);
      await audit("refresh", status, { id: row.id, rejected_reason: row.rejected_reason || null });
      return j(200, { ok: true, meta_status: status, meta_id: row.id, rejected_reason: row.rejected_reason || null });
    }

    return j(400, { error: `Unknown action: ${action}` });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: sanitizeError(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
