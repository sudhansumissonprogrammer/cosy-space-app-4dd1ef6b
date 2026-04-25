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

/** Pretty display: "+91 98765 43210" */
export function formatPhoneDisplay(raw: string | null | undefined): string {
  const norm = normalizePhone(raw);
  const m = norm.match(/^\+91(\d{5})(\d{5})$/);
  if (m) return `+91 ${m[1]} ${m[2]}`;
  return norm;
}
