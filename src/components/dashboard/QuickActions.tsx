import { useNavigateTransition } from "@/hooks/useNavigateTransition";
import { Button } from "@/components/ui/button";
import { Share2, Plus, ShoppingBag, Wallet } from "lucide-react";
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

  // Only *actions* here — Theme/Settings/Analytics already live in the sidebar,
  // repeating them made this row feel like a second menu.
  const actions = [
    { label: "Add product", icon: Plus, onClick: () => navigate(`/dashboard/stores/${storeSlug}/products/new`) },
    { label: "View orders", icon: ShoppingBag, onClick: () => navigate(`/dashboard/stores/${storeSlug}/orders`) },
    ...(showWallet ? [{ label: "Wallet", icon: Wallet, onClick: () => navigate(`/dashboard/stores/${storeSlug}/wallet`) }] : []),
  ];


  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {actions.map((action) => (
        <Button
          key={action.label}
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5 text-xs h-9"
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
            <Button variant="outline" size="sm" className="shrink-0 gap-1.5 text-xs h-9">
              <Share2 className="h-3.5 w-3.5" />
              Share
            </Button>
          }
        />
      )}
    </div>
  );
}
