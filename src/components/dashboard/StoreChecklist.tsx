import React from "react";
import { useNavigateTransition } from "@/hooks/useNavigateTransition";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Check, ChevronRight, Image, FileText, Package, CreditCard, Truck, Palette, Phone, UserRound } from "lucide-react";

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

  // Shares the dashboard-stats query — the setup flags and product count now
  // come from that single RPC instead of five separate reads.
  const { data: stats } = useDashboardStats(storeId);

  const checks = React.useMemo<CheckItem[] | null>(() => {
    if (!stats) return null;
    const store = stats.setup;
    const isWhatsAppOnly = false;

    const items: CheckItem[] = [
        {
          label: "Add store logo",
          hint: "Store Settings → Logo & Images",
          done: !!store?.logo_url,
          url: `/dashboard/stores/${storeSlug}/settings`,
          icon: Image,
        },
        {
          label: "Add owner / founder name",
          hint: "Store Settings → Basics (shows “Founded by …” on About)",
          done: !!store.owner_name,
          url: `/dashboard/stores/${storeSlug}/settings`,
          icon: UserRound,
        },
        {
          label: "Add store description",
          hint: "Store Settings → Basics",
          done: !!store?.description,
          url: `/dashboard/stores/${storeSlug}/settings`,
          icon: FileText,
        },
        {
          label: "Add your first product",
          hint: "Catalog → Products → Create",
          done: stats.total_products > 0,
          url: `/dashboard/stores/${storeSlug}/products/create`,
          icon: Package,
        },
        ...(!isWhatsAppOnly ? [
          {
            label: "Set up payments",
            hint: "Payments & Shipping → Payments",
            done: store.has_payments || store.order_mode === 'both',
            url: `/dashboard/stores/${storeSlug}/payments`,
            icon: CreditCard,
          },
          {
            label: "Set up shipping",
            hint: "Payments & Shipping → Shipping Rates",
            done: store.has_shipping,
            url: `/dashboard/stores/${storeSlug}/shipping`,
            icon: Truck,
          },
        ] : []),
        {
          label: "Customize theme",
          hint: "Store Setup → Theme & Design",
          done: store.has_theme,
          url: `/dashboard/stores/${storeSlug}/theme`,
          icon: Palette,
        },
        {
          label: "Add WhatsApp number",
          hint: "Store Settings → Basics",
          done: !!store.whatsapp_number,
          url: `/dashboard/stores/${storeSlug}/settings`,
          icon: Phone,
        },
    ];
    return items;
  }, [stats, storeSlug]);

  if (!checks) return null;

  const doneCount = checks.filter((c) => c.done).length;
  const allDone = doneCount === checks.length;
  const progress = Math.round((doneCount / checks.length) * 100);

  if (allDone) return null;

  // Highlight strongly when progress is < 60% (new store) — softer when nearly done.
  const isEarly = progress < 60;

  return (
    <Card
      ref={ref}
      className={
        isEarly
          ? "border-primary/40 bg-gradient-to-br from-primary/8 via-primary/4 to-transparent shadow-sm"
          : "border shadow-none hover:shadow-md transition-shadow duration-200"
      }
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <p className={`text-[11px] font-bold uppercase tracking-[0.1em] ${isEarly ? "text-primary" : "text-muted-foreground"}`}>
              {isEarly ? "🚀 Finish Setup" : "Store Setup"}
            </p>
          </div>
          <span className={`text-[10px] font-bold rounded-full px-2.5 py-0.5 ${isEarly ? "bg-primary text-primary-foreground" : "text-primary bg-primary/10"}`}>
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
                item.done ? "bg-success/15 text-success" : "border border-muted-foreground/30 text-muted-foreground"
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
