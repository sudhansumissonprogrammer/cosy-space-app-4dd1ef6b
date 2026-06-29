import { createClient } from "npm:@supabase/supabase-js@2";
import { fetchWithTimeout } from "../_shared/http.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      store_id,
      recipient_phone,
      recipient_name,
      message_body,
      message_type,
      order_id,
      abandoned_cart_id,
      template_name,
      template_params,
      media_url,
      media_type,
    } = body;

    if (!store_id || !recipient_phone) {
      return new Response(
        JSON.stringify({ error: "store_id and recipient_phone required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Admin client for reading platform config and logging
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Ownership check — caller must own the store OR be an admin.
    const { data: storeRow, error: storeErr } = await adminClient
      .from("stores")
      .select("owner_id")
      .eq("id", store_id)
      .maybeSingle();
    if (storeErr || !storeRow) {
      return new Response(JSON.stringify({ error: "Store not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (storeRow.owner_id !== user.id) {
      const { data: isAdmin } = await adminClient.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden: not store owner" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Phase 1 gate: if platform_only, merchant per-store sender is disabled.
    // The merchant code path below is preserved for Phase 2 (dual_mode / merchant_only).
    const { data: pcfg } = await adminClient
      .from("platform_config")
      .select("whatsapp_mode")
      .maybeSingle();
    if ((pcfg as any)?.whatsapp_mode === "platform_only") {
      return new Response(
        JSON.stringify({ error: "Merchant WhatsApp is disabled in Phase 1", code: "merchant_wa_disabled" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get store's WhatsApp config
    const { data: config, error: configErr } = await adminClient
      .from("whatsapp_config")
      .select("*")
      .eq("store_id", store_id)
      .maybeSingle();

    // SECURITY / POLICY: WhatsApp messaging is GATED until the store has
    // configured and verified its OWN Meta WhatsApp Cloud credentials.
    // The shared "shopbanao" platform fallback is disabled to prevent
    // unintended marketing/automation traffic and credential reuse.
    if (
      configErr ||
      !config ||
      !config.is_active ||
      !config.access_token ||
      !config.phone_number_id
    ) {
      return new Response(
        JSON.stringify({
          error: "WhatsApp is not configured for this store",
          code: "whatsapp_disabled",
          hint: "Add your Meta WhatsApp Cloud Phone Number ID + Access Token in Store Settings → WhatsApp, then mark it active.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const phoneNumberId: string = config.phone_number_id;
    const accessToken: string = config.access_token;

    // Format phone number (remove + and spaces)
    const phone = recipient_phone.replace(/[\s+\-()]/g, "");

    let metaPayload: any;

    if (template_name) {
      metaPayload = {
        messaging_product: "whatsapp",
        to: phone,
        type: "template",
        template: {
          name: template_name,
          language: { code: "en" },
          components: template_params
            ? [
                {
                  type: "body",
                  parameters: template_params.map((p: string) => ({
                    type: "text",
                    text: p,
                  })),
                },
              ]
            : [],
        },
      };
    } else if (media_url && media_type) {
      const metaMediaType = media_type === "image" ? "image" :
                            media_type === "video" ? "video" : "document";

      metaPayload = {
        messaging_product: "whatsapp",
        to: phone,
        type: metaMediaType,
        [metaMediaType]: {
          link: media_url,
          ...(message_body ? { caption: message_body } : {}),
          ...(metaMediaType === "document" ? { filename: media_url.split("/").pop() || "file" } : {}),
        },
      };
    } else {
      metaPayload = {
        messaging_product: "whatsapp",
        to: phone,
        type: "text",
        text: { body: message_body || "Hello from our store!" },
      };
    }

    // Call Meta WhatsApp Cloud API
    const metaResponse = await fetchWithTimeout(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(metaPayload),
      }
    );

    const metaData = await metaResponse.json();

    const messageStatus = metaResponse.ok ? "sent" : "failed";
    const metaMessageId = metaData?.messages?.[0]?.id || null;
    const errorMessage = !metaResponse.ok
      ? JSON.stringify(metaData?.error || metaData)
      : null;

    // Log message
    await adminClient.from("whatsapp_messages").insert({
      store_id,
      message_type: message_type || "manual",
      recipient_phone: phone,
      recipient_name: recipient_name || null,
      message_body: message_body || template_name || (media_type ? `[${media_type}]` : ""),
      meta_message_id: metaMessageId,
      status: messageStatus,
      error_message: errorMessage,
      order_id: order_id || null,
      abandoned_cart_id: abandoned_cart_id || null,
      media_url: media_url || null,
      media_type: media_type || null,
      direction: "outgoing",
    });

    if (!metaResponse.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to send WhatsApp message", details: metaData }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message_id: metaMessageId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("WhatsApp send error:", error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
