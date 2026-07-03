// Shared helpers for the platform WhatsApp pipeline.
// Imported by wa-platform-send, wa-cart-recovery-cron, wa-order-event, wa-campaign-runner.

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

// Normalize to E.164 digits-only (no '+'). Bare 10-digit Indian numbers get '91' prefix.
// Reject anything that can't be coerced to a plausible international number.
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = String(raw).replace(/[^\d]/g, "");
  // Strip Indian trunk prefix '0' if 11 digits like 0XXXXXXXXXX
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  // Default to India country code when caller passed a bare 10-digit mobile
  if (digits.length === 10 && /^[6-9]/.test(digits)) digits = "91" + digits;
  if (digits.length < 11 || digits.length > 15) return null;
  return digits;
}

export type PlatformWaConfig = {
  whatsapp_mode: string;
  wa_enabled: boolean;
  wa_phone_number_id: string | null;
  wa_access_token: string | null;
  wa_default_lang: string;
  wa_min_cart_age_minutes: number;
  wa_max_cart_age_hours: number;
  wa_daily_cap_per_phone: number;
};

export async function loadPlatformConfig(admin: any): Promise<PlatformWaConfig | null> {
  const { data, error } = await admin
    .from("platform_config")
    .select(
      "whatsapp_mode, wa_enabled, wa_phone_number_id, wa_access_token, wa_default_lang, wa_min_cart_age_minutes, wa_max_cart_age_hours, wa_daily_cap_per_phone"
    )
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const cfg = data as PlatformWaConfig;
  // Env fallback: use WA_ACCESS_TOKEN secret when the DB column is unset.
  if (!cfg.wa_access_token) {
    const envTok = Deno.env.get("WA_ACCESS_TOKEN") || Deno.env.get("META_WHATSAPP_TOKEN") || null;
    if (envTok) cfg.wa_access_token = envTok;
  }
  return cfg;
}

export function platformConfigUsable(cfg: PlatformWaConfig | null): boolean {
  return !!cfg && cfg.wa_enabled && !!cfg.wa_phone_number_id && !!cfg.wa_access_token;
}

let _cronSecretCache: { v: string | null; at: number } = { v: null, at: 0 };
export async function getCronSecret(admin: any): Promise<string | null> {
  // Cache 5 min to avoid extra DB lookups
  if (_cronSecretCache.v && Date.now() - _cronSecretCache.at < 5 * 60 * 1000) {
    return _cronSecretCache.v;
  }
  const fromEnv = Deno.env.get("CRON_SECRET") || null;
  const { data } = await admin.from("cron_auth").select("secret").eq("id", true).maybeSingle();
  const fromDb = (data as any)?.secret || null;
  // Prefer DB value (pg_cron uses it); env value is acceptable fallback for ops.
  _cronSecretCache = { v: fromDb || fromEnv, at: Date.now() };
  return _cronSecretCache.v;
}

export async function isValidCronHeader(admin: any, headerValue: string): Promise<boolean> {
  if (!headerValue) return false;
  const fromEnv = Deno.env.get("CRON_SECRET") || "";
  if (fromEnv && headerValue === fromEnv) return true;
  const dbSecret = await getCronSecret(admin);
  return !!dbSecret && headerValue === dbSecret;
}

