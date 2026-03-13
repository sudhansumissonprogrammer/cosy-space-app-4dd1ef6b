import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus, ShoppingBag, Share2, Palette, Eye } from "lucide-react";
import ShareStoreDialog from "@/components/ShareStoreDialog";

interface QuickActionsProps {
  storeId: string;
  storeSlug?: string;
  storeName?: string;
  isWhatsAppOnly?: boolean;
}

export default function QuickActions({ storeId, storeSlug, storeName, isWhatsAppOnly }: QuickActionsProps) {
  const navigate = useNavigate();

  const actions = [
    { label: "Add Product", icon: Plus, onClick: () => navigate(`/dashboard/stores/${storeId}/products/create`) },
    ...(!isWhatsAppOnly ? [{ label: "Orders", icon: ShoppingBag, onClick: () => navigate(`/dashboard/stores/${storeId}/orders`) }] : []),
    { label: "Theme", icon: Palette, onClick: () => navigate(`/dashboard/stores/${storeId}/theme`) },
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
              Share Store
            </Button>
          }
        />
      )}
    </div>
  );
}
