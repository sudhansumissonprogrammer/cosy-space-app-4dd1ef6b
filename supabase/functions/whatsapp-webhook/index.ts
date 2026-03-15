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

  // Meta webhook verification (GET)
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    // Use a simple verify token - store owners configure this in Meta dashboard
    if (mode === "subscribe" && token === "storivo_webhook_verify") {
      return new Response(challenge, { status: 200, headers: corsHeaders });
    }
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Process webhook entries
    const entries = body?.entry || [];
    for (const entry of entries) {
      const changes = entry?.changes || [];
      for (const change of changes) {
        const value = change?.value;
        if (!value) continue;

        // Process message status updates (sent, delivered, read, failed)
        const statuses = value?.statuses || [];
        for (const status of statuses) {
          const metaMessageId = status?.id;
          const statusValue = status?.status; // sent, delivered, read, failed
          const errorInfo = status?.errors?.[0];

          if (metaMessageId && statusValue) {
            const update: Record<string, string> = {
              status: statusValue,
              updated_at: new Date().toISOString(),
            };
            if (errorInfo) {
              update.error_message = `${errorInfo.code}: ${errorInfo.title}`;
            }

            await adminClient
              .from("whatsapp_messages")
              .update(update)
              .eq("meta_message_id", metaMessageId);
          }
        }

        // Process incoming messages - check for STOP/opt-out
        const messages = value?.messages || [];
        const phoneNumberId = value?.metadata?.phone_number_id;

        for (const msg of messages) {
          const from = msg?.from; // customer phone
          const msgBody = (msg?.text?.body || "").trim().toLowerCase();

          // Check for opt-out keywords
          const optOutKeywords = ["stop", "unsubscribe", "opt out", "optout", "cancel"];
          const isOptOut = optOutKeywords.some((kw) => msgBody === kw);

          if (isOptOut && from && phoneNumberId) {
            // Find the store by phone_number_id
            const { data: config } = await adminClient
              .from("whatsapp_config")
              .select("store_id")
              .eq("phone_number_id", phoneNumberId)
              .maybeSingle();

            if (config?.store_id) {
              // Insert opt-out record
              await adminClient
                .from("whatsapp_optouts")
                .upsert(
                  {
                    store_id: config.store_id,
                    phone: from,
                    reason: "customer_reply_stop",
                  },
                  { onConflict: "store_id,phone" }
                );
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 200, // Meta expects 200 even on errors
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
