import { isKalingaStore } from "@/lib/kalingaStore";
import { isUtkalContentStore } from "../../supabase/functions/_shared/utkalContent";

/** Presentation only: payment processing and tenant routing remain unchanged. */
export function hidesPlatformBranding(store?: { id?: string | null; slug?: string | null } | null): boolean {
  return !!store && (isKalingaStore(store) || isUtkalContentStore(store));
}