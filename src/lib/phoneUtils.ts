/**
 * Phone number normalization for India (+91).
 *
 * Rules:
 *  - Strips all non-digit characters except a leading "+".
 *  - 10-digit number starting with 6/7/8/9 -> prefixed with "+91".
 *  - 11-digit number starting with "0" -> drop the 0, prefix "+91".
 *  - 12-digit number starting with "91" -> prefix "+".
 *  - Already E.164 ("+...") -> kept as-is.
 *  - Anything else -> returned as best-effort digits with "+" prefix if length >= 10.
 */
export function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const trimmed = String(raw).trim();
  if (!trimmed) return "";

  // Preserve a leading + while stripping the rest of the non-digits
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";

  // Already E.164-ish
  if (hasPlus) return `+${digits}`;

  // 10 digits, valid Indian mobile prefix -> +91XXXXXXXXXX
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return `+91${digits}`;
  }

  // 11 digits with leading 0 (old STD style) -> drop 0, +91
  if (digits.length === 11 && digits.startsWith("0")) {
    return `+91${digits.slice(1)}`;
  }

  // 12 digits starting with 91 -> +91XXXXXXXXXX
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+${digits}`;
  }

  // 13 digits starting with 091 -> drop leading 0 -> +91...
  if (digits.length === 13 && digits.startsWith("091")) {
    return `+${digits.slice(1)}`;
  }

  // Fallback: if it's long enough to look international, prefix +
  if (digits.length >= 10) return `+${digits}`;

  return digits;
}

/**
 * Returns true if the value parses to a plausible Indian mobile number.
 * (10 digits starting 6-9, possibly with +91 / 91 / 0 prefix.)
 */
export function isValidIndianPhone(raw: string | null | undefined): boolean {
  const norm = normalizePhone(raw);
  return /^\+91[6-9]\d{9}$/.test(norm);
}

/** wa.me / WhatsApp click-to-chat expects digits only (no "+"). */
export function toWhatsappDigits(raw: string | null | undefined): string {
  return normalizePhone(raw).replace(/\D/g, "");
}

/**
 * Canonical wa.me phone builder — THE single place that decides how an
 * owner/customer-entered number becomes a WhatsApp-dialable number.
 *
 * Owners frequently save "98765 43210" (no country code) or "(+91) 98765-43210".
 * Without a country code WhatsApp shows "Couldn't look up this phone number".
 * Indian default: +91. Returns digits only (no "+"), or null when unusable.
 */
export function waPhoneNumber(raw?: string | null): string | null {
  if (!raw) return null;
  let d = String(raw).replace(/[^0-9]/g, "");
  if (!d) return null;
  if (d.startsWith("00")) d = d.slice(2);                    // 0091… → 91…
  if (d.length === 13 && d.startsWith("091")) d = d.slice(1); // 091XXXXXXXXXX
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);   // 09876543210
  if (d.length === 10) d = `91${d}`;                          // bare Indian mobile
  if (d.length < 11) return null;                             // too short to dial
  return d;
}


/** Pretty display: "+91 98765 43210" */
export function formatPhoneDisplay(raw: string | null | undefined): string {
  const norm = normalizePhone(raw);
  const m = norm.match(/^\+91(\d{5})(\d{5})$/);
  if (m) return `+91 ${m[1]} ${m[2]}`;
  return norm;
}

/**
 * Canonical 10-digit Indian mobile (e.g. "9692282485").
 *
 * This is the ONE format used across the whole stack as the primary
 * identity key for a customer:
 *  - auth.users.email  =  `<canonical>@phone.guest`
 *  - storefront_customers.phone  =  `<canonical>`
 *  - customer_leads.phone  =  `<canonical>`
 *  - orders.customer_phone  =  `<canonical>`
 *
 * Strips +91 / 91 / leading 0 / spaces / dashes / parens.
 * Returns "" if it can't produce a valid 10-digit number starting 6-9.
 *
 * NOTE: keep this function in lock-step with the same logic in
 * supabase/functions/create-guest-account/index.ts and phone-login/index.ts.
 * Divergence creates duplicate accounts for the same person.
 */
export function toCanonicalIndianPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return "";

  let local = digits;
  if (local.length === 13 && local.startsWith("091")) local = local.slice(3);
  else if (local.length === 12 && local.startsWith("91")) local = local.slice(2);
  else if (local.length === 11 && local.startsWith("0")) local = local.slice(1);

  if (local.length === 10 && /^[6-9]/.test(local)) return local;
  return "";
}
