import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyMetaSignature } from "../_shared/security.ts";
import { handleCodReply } from "../_shared/wa-cod-confirm.ts";
import { handleStoreOnboarding } from "../_shared/wa-store-onboarding.ts";
import { sendStoreSupportRedirect } from "../_shared/wa-support-redirect.ts";
import { parseIncomingMessage, persistIncomingMessage } from "../_shared/wa-incoming.ts";

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
  const platformToken: string | null =
    (pcfg as any)?.wa_access_token ?? Deno.env.get("WA_ACCESS_TOKEN") ?? null;
  const platformAppSecret: string | null =
    (pcfg as any)?.wa_app_secret ?? Deno.env.get("WA_APP_SECRET") ?? null;

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
    const envSecret = Deno.env.get("META_APP_SECRET") || Deno.env.get("WHATSAPP_APP_SECRET") || Deno.env.get("WA_APP_SECRET") || "";
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

          // Never silently replace a requested parcel-photo shipment with the
          // text template. Keep the image failure visible so the owner can
          // upload a fresh parcel photo and explicitly resend it.
          if (statusValue === "failed" && String(errorInfo?.code || "") === "131053") {
            const { data: sentQueue } = await adminClient
              .from("wa_send_queue")
              .select("id,template_name,message_type,template_vars")
              .eq("sent_message_id", metaMessageId)
              .maybeSingle();
            if (sentQueue?.message_type === "order_shipped" && sentQueue.template_name === "order_shipped_v3_img") {
              const { error: imageFailureError } = await adminClient
                .from("wa_send_queue")
                .update({
                  status: "failed",
                  last_error: "parcel_photo_failed_131053_reupload_required",
                  last_error_class: "permanent",
                  locked_until: null,
                })
                .eq("id", sentQueue.id)
                .eq("status", "sent")
                .eq("template_name", "order_shipped_v3_img");
              if (imageFailureError) console.error("shipment image failure update failed", imageFailureError.message, { metaMessageId });
            }
          }

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

            // Track the 24h conversation window so we can estimate next campaign cost.
            const expiration = status?.conversation?.expiration_timestamp
              ? new Date(Number(status.conversation.expiration_timestamp) * 1000).toISOString()
              : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
            await adminClient.from("wa_active_conversations").upsert({
              recipient_phone: status?.recipient_id || "",
              category,
              opened_at: new Date().toISOString(),
              expires_at: expiration,
              last_conversation_id: conv.id,
              cost,
            } as any, { onConflict: "recipient_phone,category" });
          }
        }

        // ── account_update: Meta quality rating + messaging tier changes ──
        const accountUpdate = value?.event === "FLOW_STATUS_CHANGE" ? null : value;
        if (value?.event && (value.event === "PHONE_NUMBER_QUALITY_UPDATE" || value.event === "PHONE_NUMBER_NAME_UPDATE" || value.event === "ACCOUNT_UPDATE")) {
          const quality = String(value?.current_limit || value?.quality_update?.current_quality || value?.quality_rating || "").toUpperCase();
          const tier = String(value?.messaging_limit_tier || value?.current_tier || "").toUpperCase();
          const update: Record<string, any> = { wa_quality_updated_at: new Date().toISOString() };
          if (quality) update.wa_quality_rating = quality;
          if (tier) update.wa_messaging_tier = tier;
          // Auto-throttle marketing when quality drops to YELLOW or RED.
          if (quality === "YELLOW" || quality === "RED") update.wa_throttle_marketing = true;
          if (quality === "GREEN" || quality === "HIGH") update.wa_throttle_marketing = false;
          await adminClient.from("platform_config").update(update).not("id", "is", null);
        }

        // ── message_template_status_update: auto-pause rejected/paused templates ──
        if (value?.event === "TEMPLATE_STATUS_UPDATE" || change?.field === "message_template_status_update") {
          const tplName = value?.message_template_name || value?.template_name;
          const newStatus = String(value?.event_type || value?.new_status || value?.status || "").toUpperCase();
          const reason = value?.reason || value?.disable_info?.disable_date || null;
          if (tplName && newStatus) {
            const paused = ["REJECTED", "PAUSED", "DISABLED", "FLAGGED", "APPEAL_REQUESTED"].includes(newStatus);
            await adminClient.from("platform_wa_templates").update({
              meta_status: newStatus,
              paused,
              pause_reason: paused ? (reason || newStatus) : null,
              last_synced_at: new Date().toISOString(),
            }).eq("name", tplName);
          }
        }




        // ── Inbound messages from customers ──
        const messages = value?.messages || [];
        for (const msg of messages) {
          const from = msg?.from;
          if (!from) continue;
          const msgType = msg?.type || "text";
          const parsed = parseIncomingMessage(msg);
          const msgBody = parsed.text;

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
          const mediaType = parsed.mediaType;
          const mediaIdStored = parsed.mediaId;
          // wa-media resolves the authenticated URL only when the attachment
          // is opened; inbox persistence must not wait on a Meta media fetch.
          const caption = msg[msgType]?.caption || "";
          const finalBody = parsed.body;

          // Opt-out keywords — exact whole-word match (avoids false positives like
          // "cancel my order"). Short message + exact keyword = opt-out intent.
          const STOP_WORDS = new Set([
            "stop", "unsubscribe", "optout",
            "remove", "बंद", "रोको", "हटाओ",
          ]);
          const STOP_PHRASES = ["opt out", "remove me", "do not message", "dont message", "don't message", "no more", "बंद करो", "मत भेजो"];
          const lowered = finalBody.toLowerCase().trim();
          const tokens = lowered.split(/\s+/);
          const isOptOut = (tokens.length <= 4 && tokens.some((t) => STOP_WORDS.has(t)))
            || STOP_PHRASES.some((p) => lowered.includes(p));



          // Commit the inbox row first. The existing unique Meta message ID
          // makes retries safe even if an earlier pre-insert marker was saved.
          const stored = await persistIncomingMessage(adminClient, {
              store_id: storeId,
              inferred_store_id: inferredStoreId,
              message_type: "incoming",
              recipient_phone: from,
              sender_phone: from,
              recipient_name: value?.contacts?.find((contact: any) => contact?.wa_id === from)?.profile?.name || null,
              message_body: finalBody,
              status: "received",
              direction: "incoming",
              meta_message_id: msg?.id || null,
              media_url: mediaUrl,
              media_type: mediaType,
              media_id: mediaIdStored,
              sent_via: isPlatformDelivery ? "platform" : "merchant",
          });
          const alreadyProcessed = !stored;

          if (stored) {

            // Mark our most-recent outbound to this phone as "replied".
            // Background: never delay the customer's button reply for analytics.
            const repliedWork = Promise.resolve(adminClient
              .from("whatsapp_messages")
              .update({ replied_at: new Date().toISOString() })
              .eq("direction", "outgoing")
              .eq("recipient_phone", from)
              .is("replied_at", null)
              .order("created_at", { ascending: false })
              .limit(1)).catch((e: Error) => console.error("replied_at update failed:", e?.message));
            // @ts-ignore EdgeRuntime is provided by the Supabase runtime
            if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(repliedWork); else await repliedWork;
          }

          // ── 🏪 WhatsApp store-creation agent (shared number only) ──
          // Only claims messages that start/continue an onboarding chat.
          // Runs in the background so Meta gets its 200 within 5 seconds.
          let onboardingHandled = false;
          let onboardingAttempted = false;
          if (!alreadyProcessed && !isOptOut && isPlatformDelivery && platformPhoneId && platformToken) {
            const buttonId: string | null =
              msg?.interactive?.button_reply?.id || msg?.interactive?.list_reply?.id ||
              msg?.button?.payload || null;
            const { data: obSession } = await adminClient
              .from("wa_onboarding_sessions").select("status").eq("phone", from).maybeSingle();
            const looksLikeTrigger = buttonId === "CREATE_STORE" ||
              /(store|shop|dukaan|dukan|website|ecommerce|e-commerce|shopbanao|स्टोर|दुकान|वेबसाइट)/i.test(finalBody);
            if ((obSession && ["active", "creating"].includes((obSession as any).status)) || looksLikeTrigger) {
              onboardingAttempted = true;
              const work = handleStoreOnboarding(
                { admin: adminClient, phoneNumberId: platformPhoneId, token: platformToken },
                { phone: from, text: msgBody || caption, buttonId, msgType, mediaId: mediaIdStored, contextId: msg?.context?.id || null },
              ).catch((e) => { console.error("onboarding failed:", (e as Error).message); return false; });
              if (obSession && ["active", "creating"].includes((obSession as any).status)) onboardingHandled = true;
              // @ts-ignore EdgeRuntime is provided by the Supabase runtime
              if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(work); else await work;
            }
          }

          // ── 🧾 COD order confirmation buttons / replies ──
          // Runs before opt-out handling: "Confirm Order" must never be read
          // as anything else. Best-effort — inbox storage already happened.
          let codHandled = false;
          if (!alreadyProcessed && !isOptOut && !onboardingHandled && finalBody) {
            try {
              const direct = isPlatformDelivery && platformPhoneId && platformToken;
              let cronSecret = Deno.env.get("CRON_SECRET") || "";
              if (!direct) {
                const { data: cronRow } = await adminClient
                  .from("cron_auth").select("secret").eq("id", true).maybeSingle();
                cronSecret = (cronRow as any)?.secret || cronSecret;
              }
              if (direct || cronSecret) {
                codHandled = await handleCodReply(adminClient, {
                  cronSecret,
                  phoneNumberId: direct ? platformPhoneId : null,
                  token: direct ? platformToken : null,
                  background: (p) => {
                    // @ts-ignore EdgeRuntime is provided by the Supabase runtime
                    if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(p);
                  },
                }, {
                  phone: from,
                  text: finalBody,
                  contextId: msg?.context?.id || null,
                });
              }
            } catch (e) {
              console.error("cod reply handling failed:", (e as Error).message);
            }
          }

          // ── ☎️ Point shoppers at the store's own WhatsApp contact ──
          // Shared number only; skipped for store-creation chats, COD actions and opt-outs.
          if (!alreadyProcessed && !isOptOut && !onboardingHandled && !onboardingAttempted && !codHandled &&
              isPlatformDelivery && platformPhoneId && platformToken) {
            const { data: obNow } = await adminClient
              .from("wa_onboarding_sessions").select("status").eq("phone", from).maybeSingle();
            if (!obNow || !["active", "creating"].includes((obNow as any).status)) {
              const work = sendStoreSupportRedirect(adminClient, {
                phone: from, contextId: msg?.context?.id || null,
                platformPhoneId, platformToken,
                sharedDisplayPhone: value?.metadata?.display_phone_number || null,
              }).catch((e) => console.error("support redirect failed:", (e as Error).message));
              // @ts-ignore EdgeRuntime is provided by the Supabase runtime
              if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(work); else await work;
            }
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
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
