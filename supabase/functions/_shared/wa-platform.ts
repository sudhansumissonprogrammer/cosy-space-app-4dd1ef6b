// Shared helpers for the platform WhatsApp pipeline.
// Imported by wa-platform-send, wa-cart-recovery-cron, wa-order-event, wa-campaign-runner.

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/[^\d]/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
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
  return data as PlatformWaConfig;
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

