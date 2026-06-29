import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type WhatsAppMode = "platform_only" | "dual_mode" | "merchant_only";

export function useWhatsAppMode() {
  const { data, isLoading } = useQuery({
    queryKey: ["whatsapp-mode"],
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryFn: async (): Promise<WhatsAppMode> => {
      const { data, error } = await supabase.rpc("get_whatsapp_mode" as any);
      if (error || !data) return "platform_only";
      return (data as WhatsAppMode) ?? "platform_only";
    },
  });

  const mode: WhatsAppMode = (data as WhatsAppMode) ?? "platform_only";
  return {
    mode,
    isLoading,
    isPlatformOnly: mode === "platform_only",
    isMerchantUiHidden: mode === "platform_only",
    isMerchantOnly: mode === "merchant_only",
    isDualMode: mode === "dual_mode",
  };
}
