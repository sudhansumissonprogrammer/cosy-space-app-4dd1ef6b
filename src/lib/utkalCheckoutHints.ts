import { isUtkalContentStore } from "../../supabase/functions/_shared/utkalContent";

type StoreRef = { id?: string | null; slug?: string | null };
export function utkalDeliveryHint(store: StoreRef, mode: "full" | "partial"): string | null {
  if (!isUtkalContentStore(store)) return null;
  return mode === "full"
    ? "Get delivered under 3 days with air shipping"
    : "Get delivered under 3 days";
}
export function utkalCodHint(store: StoreRef): string | null {
  return isUtkalContentStore(store)
    ? "70% of our customers choose prepaid — get discount & faster delivery"
    : null;
}