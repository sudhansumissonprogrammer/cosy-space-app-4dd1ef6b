import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigateTransition } from "@/hooks/useNavigateTransition";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Check, ChevronRight, Image, FileText, Package, CreditCard, Truck, Palette, Phone } from "lucide-react";

interface StoreChecklistProps {
  storeId: string;
  storeSlug: string;
}

interface CheckItem {
  label: string;
  hint: string;
  done: boolean;
  url: string;
  icon: React.ElementType;
}

const StoreChecklist = React.forwardRef<HTMLDivElement, StoreChecklistProps>(function StoreChecklist({ storeId, storeSlug }, ref) {
  const { navigate } = useNavigateTransition();

  const { data: checks } = useQuery({
    queryKey: ["store-checklist", storeId],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [storeRes, productsRes, paymentsRes, shippingRes, themeRes] = await Promise.all([
        supabase.from("stores").select("logo_url, banner_url, whatsapp_number, description, order_mode").eq("id", storeId).single(),
        supabase.from("products").select("id", { count: "exact", head: true }).eq("store_id", storeId),
        supabase.from("store_payment_config").select("id").eq("store_id", storeId).maybeSingle(),
        supabase.from("store_shipping_config").select("id").eq("store_id", storeId).maybeSingle(),
        supabase.from("store_theme_config").select("id").eq("store_id", storeId).maybeSingle(),
      ]);

      const store = storeRes.data;
      const isWhatsAppOnly = store?.order_mode === "whatsapp";

      const items: CheckItem[] = [
        {
          label: "Add store logo",
          hint: "Go to Settings → Media section",
          done: !!store?.logo_url,
          url: `/dashboard/stores/${storeSlug}/settings`,
          icon: Image,
        },
        {
          label: "Add store description",
          hint: "Go to Settings → Basic Info",
          done: !!store?.description,
          url: `/dashboard/stores/${storeSlug}/settings`,
          icon: FileText,
        },
        {
          label: "Add your first product",
          hint: "Products → Create Product",
          done: (productsRes.count ?? 0) > 0,
          url: `/dashboard/stores/${storeSlug}/products/create`,
          icon: Package,
        },
        ...(!isWhatsAppOnly ? [
          {
            label: "Set up payments",
            hint: "Payments page in sidebar",
            done: !!paymentsRes.data || store?.order_mode === 'both',
            url: `/dashboard/stores/${storeSlug}/payments`,
            icon: CreditCard,
          },
          {
            label: "Set up shipping",
            hint: "Shipping page in sidebar",
            done: !!shippingRes.data,
            url: `/dashboard/stores/${storeSlug}/shipping`,
            icon: Truck,
          },
        ] : []),
        {
          label: "Customize theme",
          hint: "Theme page in sidebar",
          done: !!themeRes.data,
          url: `/dashboard/stores/${storeSlug}/theme`,
          icon: Palette,
        },
        {
          label: "Add WhatsApp number",
          hint: "Go to Settings → Basic Info",
          done: !!store?.whatsapp_number,
          url: `/dashboard/stores/${storeSlug}/settings`,
          icon: Phone,
        },
      ];
      return items;
    },
    enabled: !!storeId,
  });

  if (!checks) return null;

  const doneCount = checks.filter((c) => c.done).length;
  const allDone = doneCount === checks.length;
  const progress = Math.round((doneCount / checks.length) * 100);

  if (allDone) return null;

  return (
    <Card className="border shadow-none">
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Store Setup</p>
          <span className="text-[10px] font-medium text-primary bg-primary/10 rounded-full px-2 py-0.5">
            {doneCount}/{checks.length} done
          </span>
        </div>
        <Progress value={progress} className="h-1.5 mb-3" />
        <div className="space-y-0.5">
          {checks.map((item) => (
            <button
              key={item.label}
              onClick={() => !item.done && navigate(item.url)}
              disabled={item.done}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors ${
                item.done
                  ? "text-muted-foreground opacity-60"
                  : "text-foreground hover:bg-accent/50"
              }`}
            >
              <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                item.done ? "bg-emerald-100 text-emerald-600" : "border border-muted-foreground/30 text-muted-foreground"
              }`}>
                {item.done ? <Check className="h-3 w-3" /> : <item.icon className="h-3 w-3" />}
              </div>
              <div className="flex-1 min-w-0">
                <span className={`text-sm block ${item.done ? "line-through" : "font-medium"}`}>{item.label}</span>
                {!item.done && (
                  <span className="text-[10px] text-muted-foreground block">{item.hint}</span>
                )}
              </div>
              {!item.done && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
});

export default StoreChecklist;
