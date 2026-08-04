import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, range, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/**
 * Streams a WhatsApp media attachment (audio / image / video / document)
 * to an authenticated admin or the owning store's merchant.
 *
 * Meta media URLs are short-lived AND require a Bearer token, so they can
 * never be used directly in an <img>/<audio> src. This function resolves a
 * fresh URL from the stored media_id, downloads it server-side with the
 * right token, and pipes the bytes back.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const url = new URL(req.url);
    const messageId = url.searchParams.get("message_id");
    if (!messageId) return json({ error: "message_id required" }, 400);

    const { data: row } = await admin
      .from("whatsapp_messages")
      .select("id, store_id, media_id, media_url, media_type, sent_via")
      .eq("id", messageId)
      .maybeSingle();
    if (!row) return json({ error: "Message not found" }, 404);
    if (!row.media_id && !row.media_url) return json({ error: "No media on this message" }, 404);

    // Access: platform admin, or the owner of the store this message belongs to.
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) {
      if (!row.store_id) return json({ error: "Forbidden" }, 403);
      const { data: store } = await admin
        .from("stores").select("owner_id").eq("id", row.store_id).maybeSingle();
      if (!store || store.owner_id !== user.id) return json({ error: "Forbidden" }, 403);
    }

    // Resolve the token that can read this media.
    const { data: pcfg } = await admin
      .from("platform_config").select("wa_access_token").maybeSingle();
    let token: string | null =
      (pcfg as any)?.wa_access_token ?? Deno.env.get("WA_ACCESS_TOKEN") ?? null;

    if (row.sent_via !== "platform" && row.store_id) {
      const { data: cfg } = await admin
        .from("whatsapp_config").select("access_token").eq("store_id", row.store_id).maybeSingle();
      token = (cfg as any)?.access_token || token;
    }
    if (!token) return json({ error: "No WhatsApp access token configured" }, 500);

    // Prefer a freshly-resolved URL from media_id (stored URLs expire in ~5 min).
    let downloadUrl: string | null = null;
    if (row.media_id) {
      const metaResp = await fetch(`https://graph.facebook.com/v21.0/${row.media_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const meta = await metaResp.json().catch(() => null);
      downloadUrl = meta?.url || null;
    }
    if (!downloadUrl) downloadUrl = row.media_url;
    if (!downloadUrl) return json({ error: "Media expired on WhatsApp servers" }, 410);

    const binResp = await fetch(downloadUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!binResp.ok) {
      return json(
        { error: "Media unavailable", detail: `upstream ${binResp.status}`, code: "media_expired" },
        binResp.status === 404 || binResp.status === 400 ? 410 : 502,
      );
    }

    const contentType =
      binResp.headers.get("content-type") ||
      (row.media_type === "audio" ? "audio/ogg"
        : row.media_type === "image" ? "image/jpeg"
        : row.media_type === "video" ? "video/mp4"
        : "application/octet-stream");

    return new Response(binResp.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
