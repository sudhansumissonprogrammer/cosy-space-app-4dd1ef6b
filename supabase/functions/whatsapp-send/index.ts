import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const { data: claims, error: claimsError } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claims?.claims) {
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
    } = body;

    if (!store_id || !recipient_phone) {
      return new Response(
        JSON.stringify({ error: "store_id and recipient_phone required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get store's WhatsApp config
    const { data: config, error: configErr } = await supabase
      .from("whatsapp_config")
      .select("*")
      .eq("store_id", store_id)
      .eq("is_active", true)
      .maybeSingle();

    if (configErr || !config) {
      return new Response(
        JSON.stringify({ error: "WhatsApp not configured for this store" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format phone number (remove + and spaces)
    const phone = recipient_phone.replace(/[\s+\-()]/g, "");

    let metaPayload: any;

    if (template_name) {
      // Send template message
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
    } else {
      // Send plain text message
      metaPayload = {
        messaging_product: "whatsapp",
        to: phone,
        type: "text",
        text: { body: message_body || "Hello from our store!" },
      };
    }

    // Call Meta WhatsApp Cloud API
    const metaResponse = await fetch(
      `https://graph.facebook.com/v21.0/${config.phone_number_id}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.access_token}`,
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
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    await adminClient.from("whatsapp_messages").insert({
      store_id,
      message_type: message_type || "manual",
      recipient_phone: phone,
      recipient_name: recipient_name || null,
      message_body: message_body || template_name || "",
      meta_message_id: metaMessageId,
      status: messageStatus,
      error_message: errorMessage,
      order_id: order_id || null,
      abandoned_cart_id: abandoned_cart_id || null,
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
