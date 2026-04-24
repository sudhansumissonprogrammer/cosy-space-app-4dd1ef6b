import { Badge } from "@/components/ui/badge";
import { MessageSquare, Clock, ShoppingCart, Users, TrendingUp } from "lucide-react";

// ─── Coming Soon Lock Screen ────────────────────────────────────────
// Note: Full WhatsApp Marketing implementation (8 tabs: Setup, Chat,
// Bulk, Automations, Templates, Segments, Schedule, Opt-Out, Analytics
// + ShopBanao/Own mode dashboards) was previously bundled here but
// never rendered. It has been removed to reduce bundle size. The git
// history retains the implementation if/when the feature ships.
function WhatsAppComingSoon() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="relative mb-6">
        <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/30 dark:to-green-800/20 flex items-center justify-center">
          <MessageSquare className="h-10 w-10 text-green-600 dark:text-green-400" />
        </div>
        <div className="absolute -top-2 -right-2 bg-amber-100 dark:bg-amber-900/50 rounded-full p-1.5">
          <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        </div>
      </div>
      <h1 className="text-2xl font-bold text-foreground mb-2">WhatsApp Marketing</h1>
      <Badge variant="outline" className="mb-4 border-amber-300 text-amber-600 dark:border-amber-500 dark:text-amber-400 text-sm px-3 py-1">
        Coming Soon
      </Badge>
      <p className="text-muted-foreground max-w-md mb-6 leading-relaxed">
        Automated order notifications, abandoned cart recovery, bulk campaigns, and more — all via WhatsApp.
        We're putting the finishing touches on this feature.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg w-full">
        {[
          { icon: ShoppingCart, label: "Order Notifications" },
          { icon: Users, label: "Bulk Campaigns" },
          { icon: TrendingUp, label: "Cart Recovery" },
        ].map(({ icon: Icon, label }) => (
          <div key={label} className="flex flex-col items-center gap-2 p-4 rounded-xl border bg-card">
            <Icon className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function WhatsAppMarketing() {
  return <WhatsAppComingSoon />;
}
