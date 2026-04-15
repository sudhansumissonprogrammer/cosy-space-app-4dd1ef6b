import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Package, Search, Truck, CheckCircle2, Clock, MapPin, Phone,
  Loader2, AlertCircle, ArrowRight,
} from "lucide-react";
import { format } from "date-fns";

const STATUS_STEPS = [
  { key: "confirmed", label: "Confirmed", icon: CheckCircle2 },
  { key: "shipped", label: "Shipped", icon: Truck },
  { key: "delivered", label: "Delivered", icon: CheckCircle2 },
];

function StatusTimeline({ status }: { status: string }) {
  const currentIdx = STATUS_STEPS.findIndex((s) => s.key === status);
  const isCancelled = status === "cancelled";

  return (
    <div className="flex items-center justify-between w-full py-4">
      {STATUS_STEPS.map((step, i) => {
        const isActive = i <= currentIdx && !isCancelled;
        const isCurrent = i === currentIdx && !isCancelled;
        const Icon = step.icon;

        return (
          <div key={step.key} className="flex flex-col items-center flex-1 relative">
            {i > 0 && (
              <div
                className={`absolute top-5 -left-1/2 w-full h-0.5 ${
                  isActive ? "bg-primary" : "bg-muted"
                }`}
                style={{ zIndex: 0 }}
              />
            )}
            <div
              className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all ${
                isCurrent
                  ? "border-primary bg-primary text-primary-foreground scale-110"
                  : isActive
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-muted bg-background text-muted-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
            </div>
            <span
              className={`text-[11px] mt-1.5 text-center ${
                isActive ? "font-medium text-foreground" : "text-muted-foreground"
              }`}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function OrderTrackingPage() {
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("id") || "");
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  const searchOrder = useCallback(async (searchQuery?: string) => {
    const q = (searchQuery || query).trim();
    if (!q) return;
    setLoading(true);
    setError("");
    setOrder(null);
    setOrderItems([]);
    setSearched(true);

    try {
      let { data, error: err } = await supabase
        .from("orders")
          .select("id, order_number, status, total, currency, customer_name, customer_phone, created_at, updated_at, tracking_number, tracking_url, street_address, city, state, pincode, payment_method")
        .or(`id.eq.${q},customer_phone.eq.${q}`)
        .order("created_at", { ascending: false })
        .limit(1);

      if (err) throw err;

      if (!data?.length) {
        const { data: partialData } = await supabase
          .from("orders")
          .select("id, order_number, status, total, currency, customer_name, customer_phone, created_at, updated_at, tracking_number, tracking_url, street_address, city, state, pincode, payment_method")
          .ilike("id", `${q}%`)
          .order("created_at", { ascending: false })
          .limit(1);

        data = partialData;
      }

      if (!data?.length) {
        setError("No order found. Check your order ID or phone number.");
        return;
      }

      setOrder(data[0]);

      const { data: items } = await supabase
        .from("order_items")
        .select("product_name, quantity, unit_price, total")
        .eq("order_id", data[0].id);

      setOrderItems(items || []);
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [query]);

  // Auto-search when page loads with an id parameter
  useEffect(() => {
    const id = searchParams.get("id");
    if (id) {
      searchOrder(id);
    }
  }, []);

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    confirmed: "bg-blue-100 text-blue-800 border-blue-200",
    shipped: "bg-purple-100 text-purple-800 border-purple-200",
    delivered: "bg-green-100 text-green-800 border-green-200",
    cancelled: "bg-red-100 text-red-800 border-red-200",
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        <div className="text-center">
          <Package className="h-10 w-10 text-primary mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-foreground">Track Your Order</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enter your order ID or phone number to check status
          </p>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="space-y-2">
              <Label>Order ID or Phone Number</Label>
              <div className="flex gap-2">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="e.g. A1B2C3D4 or +919876543210"
                  onKeyDown={(e) => e.key === "Enter" && searchOrder()}
                />
                <Button onClick={searchOrder} disabled={loading || !query.trim()}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error */}
        {error && (
          <Card className="border-destructive/30">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Order Result */}
        {order && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Status Header */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">
                      Order {order.order_number ? `#${1000 + order.order_number}` : `#${order.id.slice(0, 8).toUpperCase()}`}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {format(new Date(order.created_at), "dd MMM yyyy, hh:mm a")}
                    </CardDescription>
                  </div>
                  <Badge className={statusColors[order.status] || ""}>
                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {order.status !== "cancelled" ? (
                  <StatusTimeline status={order.status} />
                ) : (
                  <div className="py-4 text-center text-sm text-destructive">
                    This order has been cancelled.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tracking Info */}
            {order.tracking_number && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Truck className="h-4 w-4 text-primary" />
                    <span className="font-medium">Tracking:</span>
                    <span className="text-muted-foreground">{order.tracking_number}</span>
                  </div>
                  {order.tracking_url && (
                    <a
                      href={order.tracking_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      Track Package <ArrowRight className="h-3 w-3" />
                    </a>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Items */}
            {orderItems.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Order Items</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {orderItems.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div>
                        <span>{item.product_name}</span>
                        <span className="text-muted-foreground"> × {item.quantity}</span>
                      </div>
                      <span className="font-medium">
                        {order.currency === "INR" ? "₹" : order.currency}{item.total}
                      </span>
                    </div>
                  ))}
                  <Separator />
                  <div className="flex items-center justify-between font-medium">
                    <span>Total</span>
                    <span>{order.currency === "INR" ? "₹" : order.currency}{order.total}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Delivery Info */}
            {(order.street_address || order.city) && (
              <Card>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {[order.street_address, order.city, order.state, order.pincode]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  </div>
                  {order.customer_phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{order.customer_phone}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Empty state */}
        {searched && !order && !error && !loading && (
          <div className="text-center py-8">
            <Search className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">No results found</p>
          </div>
        )}
      </div>
    </div>
  );
}
