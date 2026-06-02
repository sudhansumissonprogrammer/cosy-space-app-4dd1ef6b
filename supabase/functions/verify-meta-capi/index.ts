// Verify a Meta CAPI access token + pixel by sending a TEST event.
// Returns { ok, events_received?, fbtrace_id?, error? } so the Setup Wizard
// can show real-time validation.
//
// Sends realistic hashed dummy customer data so Meta's quality check passes
// instead of flagging the event as "too broad" — the token validity is what
// we're actually testing here.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface Body {
  pixel_id?: string;
  access_token?: string;
}

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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

    // Realistic hashed dummy data — passes Meta's "rich enough to match" check.
    // Values are clearly synthetic so they won't accidentally match a real user.
    const [em, ph, fn, ln, ct, st, zp, country, externalId] = await Promise.all([
      sha256Hex("shopbanao.verify@example.com"),
      sha256Hex("919999999999"),
      sha256Hex("test"),
      sha256Hex("user"),
      sha256Hex("mumbai"),
      sha256Hex("maharashtra"),
      sha256Hex("400001"),
      sha256Hex("in"),
      sha256Hex(`sb-verify-${pixelId}`),
    ]);

    const testEvent = {
      data: [
        {
          event_name: "TestEvent",
          event_time: Math.floor(Date.now() / 1000),
          event_id: `sb-verify-${crypto.randomUUID()}`,
          action_source: "website",
          event_source_url: "https://shopbanao.in/verify",
          user_data: {
            em: [em],
            ph: [ph],
            fn: [fn],
            ln: [ln],
            ct: [ct],
            st: [st],
            zp: [zp],
            country: [country],
            external_id: [externalId],
            client_user_agent:
              req.headers.get("user-agent") ||
              "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 ShopBanao-Verify/1.0",
            fbp: `fb.1.${Date.now()}.${Math.floor(Math.random() * 1e10)}`,
          },
          custom_data: {
            currency: "INR",
            value: 1,
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
