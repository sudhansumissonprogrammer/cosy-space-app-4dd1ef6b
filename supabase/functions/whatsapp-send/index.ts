import { createClient } from "npm:@supabase/supabase-js@2";

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

    // Get store's WhatsApp config
    const { data: config, error: configErr } = await adminClient
      .from("whatsapp_config")
      .select("*")
      .eq("store_id", store_id)
      .maybeSingle();

    // Determine marketing mode and credentials
    const marketingMode = config?.marketing_mode || "shopbanao";
    let phoneNumberId: string;
    let accessToken: string;

    if (marketingMode === "own") {
      // Use store's own credentials
      if (!config?.is_active || !config?.access_token || !config?.phone_number_id) {
        return new Response(
          JSON.stringify({ error: "WhatsApp not configured for this store" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      phoneNumberId = config.phone_number_id;
      accessToken = config.access_token;
    } else {
      // ShopBanao mode: use platform credentials
      const { data: platformConfig } = await adminClient
        .from("platform_config")
        .select("wa_phone_number_id, wa_access_token")
        .limit(1)
        .single();

      if (!platformConfig?.wa_phone_number_id || !platformConfig?.wa_access_token) {
        return new Response(
          JSON.stringify({ error: "Platform WhatsApp not configured" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      phoneNumberId = platformConfig.wa_phone_number_id;
      accessToken = platformConfig.wa_access_token;
    }

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
    const metaResponse = await fetch(
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
