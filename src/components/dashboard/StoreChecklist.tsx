import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Check, ChevronRight } from "lucide-react";

interface StoreChecklistProps {
  storeId: string;
}

interface CheckItem {
  label: string;
  done: boolean;
  url: string;
}

export default function StoreChecklist({ storeId }: StoreChecklistProps) {
  const navigate = useNavigate();

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
        { label: "Add store logo", done: !!store?.logo_url, url: `/dashboard/stores/${storeId}/settings` },
        { label: "Add store description", done: !!store?.description, url: `/dashboard/stores/${storeId}/settings` },
        { label: "Add your first product", done: (productsRes.count ?? 0) > 0, url: `/dashboard/stores/${storeId}/products/create` },
        // Only show payment/shipping setup for website orders
        ...(!isWhatsAppOnly ? [
          { label: "Set up payments", done: !!paymentsRes.data, url: `/dashboard/stores/${storeId}/payments` },
          { label: "Set up shipping", done: !!shippingRes.data, url: `/dashboard/stores/${storeId}/shipping` },
        ] : []),
        { label: "Customize theme", done: !!themeRes.data, url: `/dashboard/stores/${storeId}/theme` },
        { label: "Add WhatsApp number", done: !!store?.whatsapp_number, url: `/dashboard/stores/${storeId}/settings` },
      ];
      return items;
    },
    enabled: !!storeId,
  });

  if (!checks) return null;

  const doneCount = checks.filter((c) => c.done).length;
  const allDone = doneCount === checks.length;
  const progress = Math.round((doneCount / checks.length) * 100);

  // Hide if everything is complete
  if (allDone) return null;

  return (
    <Card className="border shadow-none">
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Store Setup</p>
          <span className="text-[10px] font-medium text-muted-foreground">{doneCount}/{checks.length}</span>
        </div>
        <Progress value={progress} className="h-1.5 mb-3" />
        <div className="space-y-1">
          {checks.map((item) => (
            <button
              key={item.label}
              onClick={() => !item.done && navigate(item.url)}
              disabled={item.done}
              className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                item.done
                  ? "text-muted-foreground opacity-60"
                  : "text-foreground hover:bg-accent/50"
              }`}
            >
              <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                item.done ? "bg-emerald-100 text-emerald-600" : "border border-muted-foreground/30"
              }`}>
                {item.done && <Check className="h-3 w-3" />}
              </div>
              <span className={`flex-1 ${item.done ? "line-through" : ""}`}>{item.label}</span>
              {!item.done && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
