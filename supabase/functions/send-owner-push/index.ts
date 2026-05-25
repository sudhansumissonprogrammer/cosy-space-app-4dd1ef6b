// supabase/functions/send-owner-push/index.ts
// Sends a Web Push notification to a single user's devices (all enabled subscriptions).
//
// POST body:
//   { user_id: string, title: string, body: string, url?: string, data?: object,
//     image?: string, tag?: string, store_id?: string }
//
// Internal use: also callable by service-role from other edge functions (e.g., notify-order).

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:support@shopbanao.in";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      return new Response(
        JSON.stringify({ error: "VAPID keys not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const {
      user_id,
      store_id,
      title,
      body: msg,
      url,
      data,
      image,
      tag,
      icon,
    } = body || {};

    if (!user_id || !title) {
      return new Response(
        JSON.stringify({ error: "user_id and title are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: subs, error } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth, sound_enabled, enabled")
      .eq("user_id", user_id)
      .eq("enabled", true);

    if (error) throw error;
    if (!subs || subs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, reason: "no_subscriptions" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const payload = JSON.stringify({
      title,
      body: msg || "",
      url: url || "/dashboard",
      icon: icon || "/pwa-192x192.png",
      badge: "/pwa-192x192.png",
      image,
      tag,
      data: { ...(data || {}), store_id, user_id },
    });

    const expiredIds: string[] = [];
    const results = await Promise.allSettled(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
            { TTL: 60 * 60 * 24 }, // 24h
          );
          // Mark as used
          await supabase
            .from("push_subscriptions")
            .update({ last_used_at: new Date().toISOString() })
            .eq("id", s.id);
          return { id: s.id, ok: true };
        } catch (err: any) {
          const status = err?.statusCode;
          if (status === 404 || status === 410) {
            // Gone / Not Registered — remove dead subscription
            expiredIds.push(s.id);
          }
          return { id: s.id, ok: false, status, error: String(err?.message || err) };
        }
      }),
    );

    if (expiredIds.length > 0) {
      await supabase.from("push_subscriptions").delete().in("id", expiredIds);
    }

    const sent = results.filter(
      (r) => r.status === "fulfilled" && (r.value as any).ok,
    ).length;

    return new Response(
      JSON.stringify({
        success: true,
        sent,
        total: subs.length,
        removed_expired: expiredIds.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("send-owner-push error:", (err as Error).message);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
