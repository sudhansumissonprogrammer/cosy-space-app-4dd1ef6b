import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyMetaSignature } from "../_shared/security.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-hub-signature-256, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Load platform config once per request — used for mode detection + secret + routing.
  const { data: pcfg } = await adminClient
    .from("platform_config")
    .select("whatsapp_mode, wa_phone_number_id, wa_access_token, wa_app_secret")
    .maybeSingle();
  const isPlatformMode = (pcfg as any)?.whatsapp_mode === "platform_only";
  const platformPhoneId: string | null = (pcfg as any)?.wa_phone_number_id ?? null;
  const platformToken: string | null = (pcfg as any)?.wa_access_token ?? null;
  const platformAppSecret: string | null = (pcfg as any)?.wa_app_secret ?? null;

  // GET — Meta webhook subscription verification
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    const expected = Deno.env.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN");
    if (!expected) return new Response("Forbidden", { status: 403, headers: corsHeaders });
    if (mode === "subscribe" && token && token === expected) {
      return new Response(challenge, { status: 200, headers: corsHeaders });
    }
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    const sigHeader = req.headers.get("x-hub-signature-256");

    // Signature verification — MANDATORY in platform mode (we own the secret centrally).
    const envSecret = Deno.env.get("META_APP_SECRET") || Deno.env.get("WHATSAPP_APP_SECRET") || "";
    const appSecret = platformAppSecret || envSecret || "";

    if (isPlatformMode) {
      if (!appSecret) {
        console.error("whatsapp-webhook: app secret not configured but platform mode is active");
        return new Response(JSON.stringify({ error: "server_misconfigured" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const valid = await verifyMetaSignature(rawBody, sigHeader, appSecret);
      if (!valid) {
        console.warn("whatsapp-webhook: invalid signature (platform mode)");
        return new Response(JSON.stringify({ error: "invalid_signature" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (appSecret) {
      const valid = await verifyMetaSignature(rawBody, sigHeader, appSecret);
      if (!valid) {
        return new Response(JSON.stringify({ error: "invalid_signature" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = JSON.parse(rawBody);
    const entries = body?.entry || [];
    for (const entry of entries) {
      const changes = entry?.changes || [];
      for (const change of changes) {
        const value = change?.value;
        if (!value) continue;

        const phoneNumberId: string | null = value?.metadata?.phone_number_id || null;
        const isPlatformDelivery = !!phoneNumberId && phoneNumberId === platformPhoneId;

        // ── Outbound status updates (sent / delivered / read / failed) ──
        // Also capture conversation pricing for the cost ledger.
        // Meta INR rates per conversation (India), Nov-2024 published rates.
        const META_INR_RATES: Record<string, number> = {
          marketing: 0.7846,
          utility: 0.115,
          authentication: 0.115,
          service: 0,
        };
        const statuses = value?.statuses || [];
        for (const status of statuses) {
          const metaMessageId = status?.id;
          const statusValue = status?.status;
          const errorInfo = status?.errors?.[0];
          if (!metaMessageId || !statusValue) continue;

          const update: Record<string, any> = {
            status: statusValue,
            updated_at: new Date().toISOString(),
          };
          if (statusValue === "delivered") update.delivered_at = new Date().toISOString();
          if (statusValue === "read") update.read_at = new Date().toISOString();
          if (errorInfo) update.error_message = `${errorInfo.code}: ${errorInfo.title}`;

          await adminClient
            .from("whatsapp_messages")
            .update(update)
            .eq("meta_message_id", metaMessageId);

          // Conversation cost ledger — unique per conversation id (Meta only bills
          // once per 24h window per category).
          const conv = status?.conversation;
          const pricing = status?.pricing;
          if (conv?.id && pricing) {
            const category = String(pricing?.category || conv?.origin?.type || "service").toLowerCase();
            const billable = pricing?.billable !== false && category !== "service";
            const cost = billable ? (META_INR_RATES[category] ?? 0) : 0;
            // Resolve store_id from the outgoing message row
            const { data: msgRow } = await adminClient
              .from("whatsapp_messages").select("store_id").eq("meta_message_id", metaMessageId).maybeSingle();
            await adminClient.from("wa_conversation_costs").upsert({
              conversation_id: conv.id,
              recipient_phone: status?.recipient_id || "",
              message_id: metaMessageId,
              store_id: (msgRow as any)?.store_id || null,
              category,
              pricing_model: pricing?.pricing_model || null,
              billable,
              cost,
              currency: "INR",
              origin_type: conv?.origin?.type || null,
              raw: { pricing, conversation: conv },
            } as any, { onConflict: "conversation_id" });
          }
        }


        // ── Inbound messages from customers ──
        const messages = value?.messages || [];
        for (const msg of messages) {
          const from = msg?.from;
          const msgBody = (msg?.text?.body || "").trim();
          const msgType = msg?.type || "text";

          // Resolve access token used for media download:
          //   platform delivery → platform token
          //   per-merchant delivery → that store's whatsapp_config token
          let mediaToken: string | null = null;
          let storeId: string | null = null;
          let inferredStoreId: string | null = null;

          if (isPlatformDelivery) {
            mediaToken = platformToken;
            // Route inbound to the store the customer last interacted with on the shared number.
            const { data: routed } = await adminClient.rpc("wa_resolve_inbound_store", { _phone: from });
            inferredStoreId = (routed as any) || null;
            storeId = inferredStoreId; // primary key — falls back to NULL if unknown
          } else if (phoneNumberId) {
            const { data: config } = await adminClient
              .from("whatsapp_config")
              .select("store_id, access_token")
              .eq("phone_number_id", phoneNumberId)
              .maybeSingle();
            storeId = (config as any)?.store_id || null;
            mediaToken = (config as any)?.access_token || null;
          }

          // Media handling
          let mediaUrl: string | null = null;
          let mediaType: string | null = null;
          const mediaTypes = ["image", "video", "document", "audio"];
          if (mediaTypes.includes(msgType) && msg[msgType]) {
            const mediaId = msg[msgType]?.id;
            mediaType = msgType;
            if (mediaId && mediaToken) {
              try {
                const mediaResp = await fetch(
                  `https://graph.facebook.com/v21.0/${mediaId}`,
                  { headers: { Authorization: `Bearer ${mediaToken}` } },
                );
                const mediaData = await mediaResp.json();
                mediaUrl = mediaData?.url || null;
              } catch (e) {
                console.error("media url fetch failed:", (e as Error).message);
              }
            }
          }
          const caption = msg[msgType]?.caption || "";
          const finalBody = msgBody || caption || (mediaType ? `[${mediaType}]` : "");

          // Opt-out keywords
          const optOutKeywords = ["stop", "unsubscribe", "opt out", "optout", "cancel"];
          const isOptOut = optOutKeywords.some((kw) => finalBody.toLowerCase() === kw);

          if (!from) continue;

          // Idempotency via webhook_events
          let alreadyProcessed = false;
          if (msg?.id) {
            const { error: dedupeErr } = await adminClient
              .from("webhook_events")
              .insert({ provider: "whatsapp", event_id: msg.id });
            if (dedupeErr) alreadyProcessed = true;
          }

          if (!alreadyProcessed && (finalBody || mediaUrl)) {
            await adminClient.from("whatsapp_messages").insert({
              store_id: storeId,
              inferred_store_id: inferredStoreId,
              message_type: "incoming",
              recipient_phone: from,
              sender_phone: from,
              message_body: finalBody,
              status: "received",
              direction: "incoming",
              meta_message_id: msg?.id || null,
              media_url: mediaUrl,
              media_type: mediaType,
              sent_via: isPlatformDelivery ? "platform" : "merchant",
            });

            // Mark our most-recent outbound to this phone as "replied"
            await adminClient
              .from("whatsapp_messages")
              .update({ replied_at: new Date().toISOString() })
              .eq("direction", "outgoing")
              .eq("recipient_phone", from)
              .is("replied_at", null)
              .order("created_at", { ascending: false })
              .limit(1);
          }

          if (!alreadyProcessed && isOptOut) {
            // Global opt-out in platform mode (store_id NULL); per-store otherwise.
            const optoutRow: Record<string, any> = {
              phone: from,
              reason: "customer_reply_stop",
            };
            if (!isPlatformDelivery) optoutRow.store_id = storeId;
            await adminClient
              .from("whatsapp_optouts")
              .upsert(optoutRow, {
                onConflict: isPlatformDelivery ? "phone" : "store_id,phone",
              });
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("whatsapp-webhook error:", (error as Error).message);
    return new Response(JSON.stringify({ error: "internal" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
