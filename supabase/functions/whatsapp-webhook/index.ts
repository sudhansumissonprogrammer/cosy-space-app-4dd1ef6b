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

  // Meta webhook verification (GET)
  // Verify token is read from secret WHATSAPP_WEBHOOK_VERIFY_TOKEN.
  // Falls back to the legacy literal so existing Meta subscriptions keep
  // working until the secret is configured and the token is rotated in
  // the Meta Business dashboard.
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    const expected =
      Deno.env.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN") ||
      "shopbanao_webhook_verify";

    if (mode === "subscribe" && token && token === expected) {
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

    const entries = body?.entry || [];
    for (const entry of entries) {
      const changes = entry?.changes || [];
      for (const change of changes) {
        const value = change?.value;
        if (!value) continue;

        const phoneNumberId = value?.metadata?.phone_number_id;

        // Process message status updates (sent, delivered, read, failed)
        const statuses = value?.statuses || [];
        for (const status of statuses) {
          const metaMessageId = status?.id;
          const statusValue = status?.status;
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

        // Process incoming messages
        const messages = value?.messages || [];
        for (const msg of messages) {
          const from = msg?.from; // customer phone number
          const msgBody = (msg?.text?.body || "").trim();
          const msgType = msg?.type || "text";
          const timestamp = msg?.timestamp;

          // Handle media messages
          let mediaUrl: string | null = null;
          let mediaType: string | null = null;
          const mediaTypes = ["image", "video", "document", "audio"];
          if (mediaTypes.includes(msgType) && msg[msgType]) {
            const mediaId = msg[msgType]?.id;
            mediaType = msgType;

            // Download media URL from Meta
            if (mediaId && phoneNumberId) {
              try {
                const { data: configData } = await adminClient
                  .from("whatsapp_config")
                  .select("access_token")
                  .eq("phone_number_id", phoneNumberId)
                  .maybeSingle();

                if (configData?.access_token) {
                  const mediaResp = await fetch(
                    `https://graph.facebook.com/v21.0/${mediaId}`,
                    { headers: { Authorization: `Bearer ${configData.access_token}` } }
                  );
                  const mediaData = await mediaResp.json();
                  mediaUrl = mediaData?.url || null;
                }
              } catch (e) {
                console.error("Failed to fetch media URL:", e);
              }
            }
          }

          // Get caption for media messages
          const caption = msg[msgType]?.caption || "";
          const finalBody = msgBody || caption || (mediaType ? `[${mediaType}]` : "");

          // Check for opt-out keywords
          const optOutKeywords = ["stop", "unsubscribe", "opt out", "optout", "cancel"];
          const isOptOut = optOutKeywords.some((kw) => finalBody.toLowerCase() === kw);

          // Find the store by phone_number_id
          let storeId: string | null = null;
          if (phoneNumberId) {
            const { data: config } = await adminClient
              .from("whatsapp_config")
              .select("store_id")
              .eq("phone_number_id", phoneNumberId)
              .maybeSingle();
            storeId = config?.store_id || null;
          }

          if (storeId && from) {
            // Save incoming message to DB
            if (finalBody || mediaUrl) {
              await adminClient.from("whatsapp_messages").insert({
                store_id: storeId,
                message_type: "incoming",
                recipient_phone: from,
                sender_phone: from,
                message_body: finalBody,
                status: "received",
                direction: "incoming",
                meta_message_id: msg?.id || null,
                media_url: mediaUrl,
                media_type: mediaType,
              });
            }

            // Handle opt-out
            if (isOptOut) {
              await adminClient
                .from("whatsapp_optouts")
                .upsert(
                  {
                    store_id: storeId,
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
