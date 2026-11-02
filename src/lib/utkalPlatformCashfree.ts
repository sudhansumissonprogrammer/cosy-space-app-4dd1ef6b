import { canUsePlatformCashfree, PLATFORM_CASHFREE_PATH } from "../../supabase/functions/_shared/utkalPlatformCashfreePolicy";

// Explicit owner requirement: do not enable or test payments until requested.
export const UTKAL_PLATFORM_CASHFREE_ENABLED = false;

export function usesUtkalPlatformCashfree(storeId: string): boolean {
  return canUsePlatformCashfree(storeId, UTKAL_PLATFORM_CASHFREE_ENABLED);
}

export async function redirectToUtkalPlatformCashfree(storeId: string, orderId: string, checkoutToken: string): Promise<boolean> {
  if (!usesUtkalPlatformCashfree(storeId)) return false;
  const { supabase } = await import("@/integrations/supabase/client");
  const { data, error } = await supabase.functions.invoke("utkal-platform-cashfree", {
    body: { action: "handoff", store_id: storeId, order_id: orderId, checkout_token: checkoutToken },
  });
  if (error || !data?.token) throw new Error("Could not start secure payment. Please retry.");
  const url = new URL(PLATFORM_CASHFREE_PATH, "https://shopbanao.in");
  url.hash = new URLSearchParams({ handoff: data.token }).toString();
  window.location.assign(url.toString());
  return true;
}