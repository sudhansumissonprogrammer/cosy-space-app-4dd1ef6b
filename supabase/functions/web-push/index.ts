import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@storivo.in";

// Configure web-push with VAPID keys
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const url = new URL(req.url);
    const action = url.pathname.split("/").pop();

    // GET /web-push/vapid-key — return public VAPID key
    if (req.method === "GET" || action === "vapid-key") {
      return new Response(
        JSON.stringify({ vapidPublicKey: VAPID_PUBLIC_KEY }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();

    // POST with action: "subscribe"
    if (body.action === "subscribe") {
      const { store_id, subscription } = body;
      if (!store_id || !subscription?.endpoint || !subscription?.keys) {
        return new Response(
          JSON.stringify({ error: "Missing subscription data" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Upsert subscription
      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          store_id,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
        { onConflict: "store_id,endpoint" }
      );

      if (error) {
        console.error("[web-push] Subscribe error:", error);
      }

      return new Response(
        JSON.stringify({ ok: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST with action: "send" — send push to all subscribers of a store
    if (body.action === "send") {
      const { store_id, title, message, url: linkUrl } = body;
      console.log("[web-push] Sending to store:", store_id, "title:", title);

      // Get all subscriptions for this store
      const { data: subscriptions, error } = await supabase
        .from("push_subscriptions")
        .select("*")
        .eq("store_id", store_id);

      if (error) {
        console.error("[web-push] DB error:", error);
        throw error;
      }

      console.log("[web-push] Found", subscriptions?.length || 0, "subscriptions");

      const payload = JSON.stringify({
        title: title || "Notification",
        body: message || "",
        url: linkUrl || "/",
        icon: "/pwa-192x192.png",
      });

      let sent = 0;
      let failed = 0;
      const expiredEndpoints: string[] = [];

      for (const sub of subscriptions || []) {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        try {
          await webpush.sendNotification(pushSubscription, payload);
          sent++;
          console.log("[web-push] Sent OK to:", sub.endpoint.substring(0, 60));
        } catch (err: any) {
          failed++;
          console.error("[web-push] Failed:", err.statusCode, err.body || err.message);
          // 404 or 410 means subscription expired
          if (err.statusCode === 410 || err.statusCode === 404) {
            expiredEndpoints.push(sub.endpoint);
          }
        }
      }

      // Clean up expired subscriptions
      if (expiredEndpoints.length > 0) {
        console.log("[web-push] Cleaning", expiredEndpoints.length, "expired subscriptions");
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("store_id", store_id)
          .in("endpoint", expiredEndpoints);
      }

      console.log("[web-push] Result:", { sent, failed, total: subscriptions?.length || 0 });

      return new Response(
        JSON.stringify({ sent, failed, total: subscriptions?.length || 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[web-push] Error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
