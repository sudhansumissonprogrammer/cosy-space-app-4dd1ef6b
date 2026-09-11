// Verify a Meta CAPI access token + pixel by sending a TEST event.
// Returns { ok, events_received?, fbtrace_id?, error? } so the Setup Wizard
// can show real-time validation.
//
// Sends realistic hashed dummy customer data so Meta's quality check passes
// instead of flagging the event as "too broad" — the token validity is what
// we're actually testing here.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { META_GRAPH_URL } from "../_shared/metaGraph.ts";

interface Body {
  store_id?: string;
  pixel_id?: string;
  access_token?: string;
}

const RL_WINDOW_MS = 60_000;
const RL_MAX = 6;
const rlMap = new Map<string, { count: number; resetAt: number }>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const entry = rlMap.get(key);
  if (!entry || entry.resetAt < now) {
    rlMap.set(key, { count: 1, resetAt: now + RL_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RL_MAX;
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
    const storeId = (body.store_id || "").trim();
    const pixelId = (body.pixel_id || "").trim();
    const accessToken = (body.access_token || "").trim();

    if (!storeId || !/^[0-9a-f-]{36}$/i.test(storeId)) {
      return json({ ok: false, error: "Store is required." }, 400);
    }

    const authHeader = req.headers.get("authorization") || "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return json({ ok: false, error: "Sign in required." }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser();
    if (userErr || !userData.user) {
      return json({ ok: false, error: "Sign in required." }, 401);
    }

    const rlKey = `${userData.user.id}:${storeId}`;
    if (rateLimited(rlKey)) return json({ ok: false, error: "Too many tests. Please wait a minute." }, 429);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: store } = await admin
      .from("stores")
      .select("owner_id, slug, custom_domain")
      .eq("id", storeId)
      .maybeSingle();
    if (!store || store.owner_id !== userData.user.id) {
      return json({ ok: false, error: "Store access denied." }, 403);
    }

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

    // Use the calling site's Origin as event_source_url when available — the
    // old hardcoded "shopbanao.in/verify" path doesn't exist and Meta logs
    // it as a 404 in the URL hygiene check. Fall back to graph.facebook.com.
    const sourceUrl = store.custom_domain
      ? `https://${String(store.custom_domain).replace(/^www\./, "")}/`
      : `https://${String(store.slug).toLowerCase()}.shopbanao.in/`;

    // BAN-FIX B6: env-configurable test_event_code + dedicated custom event
    // name. The pixel-verify button must NEVER pollute a merchant's real
    // Purchase / PageView analytics — using a fake PageView made verify runs
    // show up in the merchant's dashboard as ghost pageviews. TestPixelVerify
    // is scoped to Meta Events Manager's Test Events tab only.
    const testEventCode = Deno.env.get("META_TEST_EVENT_CODE") || "TEST12345";
    const testEvent = {
      data: [
        {
          event_name: "TestPixelVerify",
          event_time: Math.floor(Date.now() / 1000),
          event_id: `sb-verify-${crypto.randomUUID()}`,
          action_source: "website",
          event_source_url: sourceUrl,
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
          },
        },
      ],
      test_event_code: testEventCode,
    };
    // Belt-and-suspenders: never send a verify event without test_event_code.
    if (!testEvent.test_event_code) {
      return json({ ok: false, error: "Test verification is temporarily unavailable." }, 500);
    }

    // Graph API v21.0 — v19.0 is past Meta's 2-year deprecation window and
    // returns deprecation warnings in fbtrace responses.
    const url = `${META_GRAPH_URL}/${pixelId}/events`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
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
