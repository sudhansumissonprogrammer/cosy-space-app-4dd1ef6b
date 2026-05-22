// Verify a Meta CAPI access token + pixel by sending a TEST event.
// Returns { ok, events_received?, fbtrace_id?, error? } so the Setup Wizard
// can show real-time validation.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface Body {
  pixel_id?: string;
  access_token?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const pixelId = (body.pixel_id || "").trim();
    const accessToken = (body.access_token || "").trim();

    if (!pixelId || !/^\d{10,20}$/.test(pixelId)) {
      return json({ ok: false, error: "Invalid Pixel ID — must be 10–20 digits." }, 400);
    }
    if (!accessToken || accessToken.length < 30) {
      return json({ ok: false, error: "Access token looks too short." }, 400);
    }

    const testEvent = {
      data: [
        {
          event_name: "TestEvent",
          event_time: Math.floor(Date.now() / 1000),
          event_id: `sb-verify-${crypto.randomUUID()}`,
          action_source: "website",
          event_source_url: "https://shopbanao.in/verify",
          user_data: {
            client_user_agent: req.headers.get("user-agent") || "ShopBanao-Verify/1.0",
          },
        },
      ],
      test_event_code: "TEST12345",
    };

    const url = `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testEvent),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errMsg =
        data?.error?.error_user_msg ||
        data?.error?.message ||
        `Meta API returned ${res.status}`;
      return json({
        ok: false,
        error: errMsg,
        meta_code: data?.error?.code,
        fbtrace_id: data?.error?.fbtrace_id,
      });
    }

    return json({
      ok: true,
      events_received: data?.events_received ?? 1,
      fbtrace_id: data?.fbtrace_id,
    });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
