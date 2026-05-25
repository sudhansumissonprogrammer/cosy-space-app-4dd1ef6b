import { useNavigateTransition } from "@/hooks/useNavigateTransition";
import { Button } from "@/components/ui/button";
import { Share2, Palette, Settings, BarChart3, Wallet } from "lucide-react";
import ShareStoreDialog from "@/components/ShareStoreDialog";

interface QuickActionsProps {
  storeId: string;
  storeSlug: string;
  storeName?: string;
  isWhatsAppOnly?: boolean;
  showWallet?: boolean;
}

export default function QuickActions({ storeId, storeSlug, storeName, isWhatsAppOnly, showWallet }: QuickActionsProps) {
  const { navigate } = useNavigateTransition();

  const actions = [
    ...(showWallet ? [{ label: "Wallet", icon: Wallet, onClick: () => navigate(`/dashboard/stores/${storeSlug}/wallet`) }] : []),
    { label: "Theme", icon: Palette, onClick: () => navigate(`/dashboard/stores/${storeSlug}/theme`) },
    { label: "Settings", icon: Settings, onClick: () => navigate(`/dashboard/stores/${storeSlug}/settings`) },
    { label: "Analytics", icon: BarChart3, onClick: () => navigate(`/dashboard/analytics`) },
  ];

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {actions.map((action) => (
        <Button
          key={action.label}
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5 text-xs h-8"
          onClick={action.onClick}
        >
          <action.icon className="h-3.5 w-3.5" />
          {action.label}
        </Button>
      ))}
      {storeSlug && storeName && (
        <ShareStoreDialog
          storeSlug={storeSlug}
          storeName={storeName}
          trigger={
            <Button variant="outline" size="sm" className="shrink-0 gap-1.5 text-xs h-8">
              <Share2 className="h-3.5 w-3.5" />
              Share
            </Button>
          }
        />
      )}
    </div>
  );
}
