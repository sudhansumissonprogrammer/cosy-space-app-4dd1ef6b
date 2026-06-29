import { ReactNode } from "react";
import { useWhatsAppMode } from "@/hooks/useWhatsAppMode";

/**
 * Renders `platform` when WHATSAPP_MODE is `platform_only`, otherwise `merchant`.
 * Both children are JSX (already lazy-imported by the caller), so this is just
 * a conditional render — nothing is deleted, only one branch shows at a time.
 */
export function WhatsAppGate({
  platform,
  merchant,
}: {
  platform: ReactNode;
  merchant: ReactNode;
}) {
  const { isPlatformOnly, isLoading } = useWhatsAppMode();
  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  return <>{isPlatformOnly ? platform : merchant}</>;
}
