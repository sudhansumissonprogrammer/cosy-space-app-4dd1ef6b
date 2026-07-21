// Shared helpers for shipping provider edge functions.
// Handles: CORS, auth check, provider config load, Shiprocket token cache.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

export { corsHeaders };

export function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

export async function authedUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data } = await supa.auth.getUser();
  return data.user ?? null;
}

export async function assertStoreOwner(userId: string, storeId: string) {
  const svc = serviceClient();
  const { data, error } = await svc
    .from("stores")
    .select("id, owner_id")
    .eq("id", storeId)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.owner_id !== userId) throw new Error("forbidden");
}

export async function loadProvider(storeId: string, provider: string) {
  const svc = serviceClient();
  const { data, error } = await svc
    .from("store_shipping_providers")
    .select("*")
    .eq("store_id", storeId)
    .eq("provider", provider)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`${provider} not configured for this store`);
  if (!data.is_enabled) throw new Error(`${provider} is disabled`);
  return data;
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Shiprocket auth: log in with email+password, cache the returned token (~10 days). */
export async function shiprocketToken(providerRow: any): Promise<string> {
  const now = Date.now();
  const exp = providerRow.token_expires_at
    ? new Date(providerRow.token_expires_at).getTime()
    : 0;
  if (providerRow.cached_token && exp - now > 30 * 60 * 1000) {
    return providerRow.cached_token;
  }
  const r = await fetch(
    "https://apiv2.shiprocket.in/v1/external/auth/login",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: providerRow.api_email,
        password: providerRow.api_password,
      }),
    },
  );
  const body = await r.json();
  if (!r.ok || !body.token) {
    throw new Error(`Shiprocket login failed: ${JSON.stringify(body)}`);
  }
  const svc = serviceClient();
  await svc
    .from("store_shipping_providers")
    .update({
      cached_token: body.token,
      token_expires_at: new Date(now + 9 * 24 * 3600 * 1000).toISOString(),
    })
    .eq("id", providerRow.id);
  return body.token;
}
