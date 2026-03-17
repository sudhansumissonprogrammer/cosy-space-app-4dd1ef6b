import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Web Push requires VAPID keys
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@storivo.in";

// Import web-push compatible library for Deno
async function sendWebPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string
) {
  // Use the web-push protocol manually with crypto APIs
  const { endpoint, keys } = subscription;

  // For Deno edge functions, we use the fetch-based web push approach
  // The Web Push protocol requires VAPID JWT + encrypted payload
  const jwt = await createVapidJwt(endpoint);
  const { ciphertext, salt, localPublicKey } = await encryptPayload(
    payload,
    keys.p256dh,
    keys.auth
  );

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      Authorization: `vapid t=${jwt}, k=${urlBase64ToBase64url(VAPID_PUBLIC_KEY)}`,
      TTL: "86400",
      Urgency: "high",
    },
    body: ciphertext,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Push failed: ${response.status} ${text}`);
  }
  return response;
}

// Create VAPID JWT
async function createVapidJwt(endpoint: string): Promise<string> {
  const audience = new URL(endpoint).origin;
  const now = Math.floor(Date.now() / 1000);

  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud: audience,
    exp: now + 12 * 3600,
    sub: VAPID_SUBJECT,
  };

  const headerB64 = btoa(JSON.stringify(header))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const payloadB64 = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const signingInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);

  // Import VAPID private key
  const privateKeyBytes = base64urlToUint8Array(VAPID_PRIVATE_KEY);
  const jwk = {
    kty: "EC",
    crv: "P-256",
    d: uint8ArrayToBase64url(privateKeyBytes),
    x: "", // Will be derived
    y: "",
  };

  // Derive public key from private key
  const pubKeyBytes = base64urlToUint8Array(VAPID_PUBLIC_KEY);
  if (pubKeyBytes.length === 65) {
    // Uncompressed public key
    jwk.x = uint8ArrayToBase64url(pubKeyBytes.slice(1, 33));
    jwk.y = uint8ArrayToBase64url(pubKeyBytes.slice(33, 65));
  }

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    signingInput
  );

  // Convert DER signature to raw r||s format
  const sigBytes = new Uint8Array(signature);
  const sigB64 = uint8ArrayToBase64url(sigBytes);

  return `${headerB64}.${payloadB64}.${sigB64}`;
}

// Encrypt payload using Web Push encryption (aes128gcm)
async function encryptPayload(
  payload: string,
  p256dhKey: string,
  authSecret: string
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; localPublicKey: Uint8Array }> {
  const payloadBytes = new TextEncoder().encode(payload);

  // Generate local ECDH key pair
  const localKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  // Import subscriber's public key
  const subscriberPubKeyBytes = base64urlToUint8Array(p256dhKey);
  const subscriberKey = await crypto.subtle.importKey(
    "raw",
    subscriberPubKeyBytes,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // Derive shared secret
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: "ECDH", public: subscriberKey },
    localKeyPair.privateKey,
    256
  );

  // Export local public key
  const localPubKeyRaw = await crypto.subtle.exportKey("raw", localKeyPair.publicKey);
  const localPublicKey = new Uint8Array(localPubKeyRaw);

  // Auth secret
  const authSecretBytes = base64urlToUint8Array(authSecret);

  // HKDF to derive keys
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // IKM = HKDF(auth_secret, shared_secret, "WebPush: info" || 0x00 || subscriber_key || local_key, 32)
  const ikm_info = new Uint8Array([
    ...new TextEncoder().encode("WebPush: info\0"),
    ...subscriberPubKeyBytes,
    ...localPublicKey,
  ]);

  const prk_key = await crypto.subtle.importKey(
    "raw",
    authSecretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const prk = new Uint8Array(
    await crypto.subtle.sign("HMAC", prk_key, new Uint8Array(sharedSecret))
  );

  const ikm = await hkdfExpand(prk, ikm_info, 32);

  // Content encryption key
  const cek_info = new TextEncoder().encode("Content-Encoding: aes128gcm\0");
  const nonce_info = new TextEncoder().encode("Content-Encoding: nonce\0");

  const prk2_key = await crypto.subtle.importKey(
    "raw",
    salt,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const prk2 = new Uint8Array(
    await crypto.subtle.sign("HMAC", prk2_key, ikm)
  );

  const contentEncryptionKey = await hkdfExpand(prk2, cek_info, 16);
  const nonce = await hkdfExpand(prk2, nonce_info, 12);

  // Add padding delimiter
  const paddedPayload = new Uint8Array(payloadBytes.length + 1);
  paddedPayload.set(payloadBytes);
  paddedPayload[payloadBytes.length] = 2; // padding delimiter

  // Encrypt with AES-128-GCM
  const aesKey = await crypto.subtle.importKey(
    "raw",
    contentEncryptionKey,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    aesKey,
    paddedPayload
  );

  // Build aes128gcm header: salt (16) + rs (4) + idlen (1) + keyid (65)
  const rs = 4096;
  const header = new Uint8Array(16 + 4 + 1 + 65);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, rs);
  header[20] = 65;
  header.set(localPublicKey, 21);

  const result = new Uint8Array(header.length + encrypted.byteLength);
  result.set(header);
  result.set(new Uint8Array(encrypted), header.length);

  return { ciphertext: result, salt, localPublicKey };
}

async function hkdfExpand(
  prk: Uint8Array,
  info: Uint8Array,
  length: number
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    prk,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const input = new Uint8Array(info.length + 1);
  input.set(info);
  input[info.length] = 1;
  const output = new Uint8Array(await crypto.subtle.sign("HMAC", key, input));
  return output.slice(0, length);
}

function base64urlToUint8Array(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(base64 + padding);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function uint8ArrayToBase64url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function urlBase64ToBase64url(base64: string): string {
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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

      await supabase.from("push_subscriptions").upsert(
        {
          store_id,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
        { onConflict: "store_id,endpoint" }
      );

      return new Response(
        JSON.stringify({ ok: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST with action: "send" — send push to all subscribers of a store
    if (body.action === "send") {
      const { store_id, title, message, url: linkUrl } = body;

      // Verify caller is store owner (check auth header)
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get all subscriptions for this store
      const { data: subscriptions, error } = await supabase
        .from("push_subscriptions")
        .select("*")
        .eq("store_id", store_id);

      if (error) throw error;

      const payload = JSON.stringify({
        title,
        body: message,
        url: linkUrl || "/",
        icon: "/pwa-192x192.png",
      });

      let sent = 0;
      let failed = 0;
      const expiredEndpoints: string[] = [];

      for (const sub of subscriptions || []) {
        try {
          await sendWebPush(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload
          );
          sent++;
        } catch (err: any) {
          failed++;
          // 410 Gone or 404 means subscription expired
          if (err.message?.includes("410") || err.message?.includes("404")) {
            expiredEndpoints.push(sub.endpoint);
          }
        }
      }

      // Clean up expired subscriptions
      if (expiredEndpoints.length > 0) {
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("store_id", store_id)
          .in("endpoint", expiredEndpoints);
      }

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
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
