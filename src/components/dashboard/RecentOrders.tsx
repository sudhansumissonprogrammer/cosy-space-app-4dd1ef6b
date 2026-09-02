import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigateTransition } from "@/hooks/useNavigateTransition";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, MessageCircle } from "lucide-react";

interface RecentOrdersProps {
  storeId: string;
  storeSlug: string;
  currencySymbol: string;
  whatsappNumber?: string;
  storeName?: string;
}

import { orderStatusBadgeClass, orderStatusLabel } from "@/lib/orderStatus";
import { waPhoneNumber } from "@/lib/phoneUtils";

function buildWhatsAppUrl(phone: string, customerName: string, orderId: string, total: string, currencySymbol: string, storeName: string) {
  const phoneWithCode = waPhoneNumber(phone) ?? "";
  const orderShort = orderId.slice(0, 8).toUpperCase();
  const text = encodeURIComponent(
    `Hi ${customerName || "there"}! 👋\n\nThank you for your order #${orderShort} of ${currencySymbol}${total} from ${storeName}.\n\nYour order has been confirmed ✅\nWe'll update you once it ships.\n\nThank you for shopping with us! 🙏`
  );
  return `https://wa.me/${phoneWithCode}?text=${text}`;
}

const RecentOrders = React.forwardRef<HTMLDivElement, RecentOrdersProps>(function RecentOrders(
  { storeId, storeSlug, currencySymbol, whatsappNumber, storeName },
  ref
) {
  const { navigate } = useNavigateTransition();

  const { data: orders, isLoading } = useQuery({
    queryKey: ["recent-orders-dashboard", storeId],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, customer_name, customer_phone, total, status, created_at")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: !!storeId,
  });

  if (isLoading) {
    return (
      <Card className="border shadow-none">
        <CardContent className="p-3 space-y-2">
          <div className="h-3 w-24 rounded bg-muted animate-pulse" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-9 rounded bg-muted/60 animate-pulse" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <Card className="border shadow-none">
        <CardContent className="p-4 text-center">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Recent Orders</p>
          <p className="text-sm text-muted-foreground">
            No orders yet. Share your store link to get your first sale.
          </p>
        </CardContent>
      </Card>
    );
  }

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <Card className="border shadow-none">
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recent Orders</p>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] text-muted-foreground px-2"
            onClick={() => navigate(`/dashboard/stores/${storeSlug}/orders`)}
          >
            View all <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </div>
        <div className="space-y-2">
          {orders.map((order) => (
            <div
              key={order.id}
              className="flex w-full items-center gap-2 rounded-lg p-2 transition-colors hover:bg-accent/50"
            >
              <button
                onClick={() => navigate(`/dashboard/stores/${storeSlug}/orders`)}
                className="flex flex-1 items-center gap-3 text-left min-w-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {order.customer_name || order.customer_phone || "Guest"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{timeAgo(order.created_at)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-foreground">{currencySymbol}{Number(order.total).toFixed(0)}</p>
                  <Badge variant="secondary" className={`text-[9px] px-1.5 py-0 ${orderStatusBadgeClass(order.status)}`}>
                    {orderStatusLabel(order.status)}
                  </Badge>
                </div>
              </button>
              {/* Quick WhatsApp button */}
              {order.customer_phone && (
                <a
                  href={buildWhatsAppUrl(
                    order.customer_phone,
                    order.customer_name || "",
                    order.id,
                    Number(order.total).toFixed(0),
                    currencySymbol,
                    storeName || "our store"
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success/10 text-success hover:bg-success/20 transition-colors"
                  title="Message on WhatsApp"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
});

export default RecentOrders;
