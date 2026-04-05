import { useState, useEffect } from "react";
import { useStoreSlugParam } from "@/hooks/useStoreSlugParam";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useStoreData } from "@/hooks/useStoreData";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import {
  Loader2, MessageCircle, Globe, CreditCard, Banknote,
  ChevronDown, ExternalLink, ShieldCheck, Layers, IndianRupee, Percent,
} from "lucide-react";

type OrderMode = "whatsapp" | "website" | "both";

export default function StorePayments() {
  const { storeId } = useStoreSlugParam();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [orderMode, setOrderMode] = useState<OrderMode>("whatsapp");
  const [codEnabled, setCodEnabled] = useState(true);
  const [razorpayEnabled, setRazorpayEnabled] = useState(false);
  const [razorpayKeyId, setRazorpayKeyId] = useState("");
  const [razorpayKeySecret, setRazorpayKeySecret] = useState("");
  const [razorpayOpen, setRazorpayOpen] = useState(false);

  // Partial payment defaults
  const [partialEnabled, setPartialEnabled] = useState(false);
  const [partialType, setPartialType] = useState<"percentage" | "fixed">("percentage");
  const [partialValue, setPartialValue] = useState("");

  const { data: store, isLoading: storeLoading } = useStoreData(storeId);

  // Initialize partial payment from store
  useEffect(() => {
    if (store) {
      setPartialEnabled((store as any).partial_payment_enabled ?? false);
      setPartialType((store as any).partial_payment_type || "percentage");
      setPartialValue((store as any).partial_payment_value ? String((store as any).partial_payment_value) : "");
    }
  }, [store]);

  const { data: paymentConfig, isLoading: configLoading } = useQuery({
    queryKey: ["payment-config", storeId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("store_payment_config")
        .select("*")
        .eq("store_id", storeId!)
        .maybeSingle();
      if (error) throw error;
      return data as {
        id: string;
        store_id: string;
        payment_methods: string[];
        razorpay_key_id: string | null;
        razorpay_key_secret: string | null;
      } | null;
    },
    enabled: !!storeId,
  });

  useEffect(() => {
    if (store) {
      setOrderMode((store.order_mode as OrderMode) || "whatsapp");
    }
  }, [store]);

  useEffect(() => {
    if (paymentConfig) {
      const methods: string[] = paymentConfig.payment_methods || ["cod"];
      setCodEnabled(methods.includes("cod"));
      setRazorpayEnabled(methods.includes("razorpay"));
      setRazorpayKeyId(paymentConfig.razorpay_key_id || "");
      setRazorpayKeySecret(paymentConfig.razorpay_key_secret || "");
      if (methods.includes("razorpay")) setRazorpayOpen(true);
    }
  }, [paymentConfig]);

  const showPaymentConfig = orderMode === "website" || orderMode === "both";

  const saveMutation = useMutation({
    mutationFn: async () => {
      // 1. Update order_mode + partial payment on store
      const partialUpdate: Record<string, any> = {
        order_mode: orderMode,
        partial_payment_enabled: partialEnabled && razorpayEnabled,
        partial_payment_type: partialType,
        partial_payment_value: partialEnabled && partialValue ? Number(partialValue) : null,
      };
      
      // Validate partial payment values
      if (partialEnabled && razorpayEnabled && partialValue) {
        const val = Number(partialValue);
        if (partialType === "percentage" && (val < 10 || val > 80)) {
          throw new Error("Percentage must be between 10% and 80%");
        }
        if (partialType === "fixed" && val < 50) {
          throw new Error("Fixed amount must be at least ₹50");
        }
      }
      
      const { error: storeErr } = await (supabase as any)
        .from("stores")
        .update(partialUpdate)
        .eq("id", storeId!);
      if (storeErr) throw storeErr;

      // 2. Upsert payment config if website/both
      if (showPaymentConfig) {
        const methods: string[] = [];
        if (codEnabled) methods.push("cod");
        if (razorpayEnabled) methods.push("razorpay");
        if (methods.length === 0) {
          throw new Error("At least one payment method must be enabled");
        }
        if (razorpayEnabled && !razorpayKeyId.trim()) {
          throw new Error("Razorpay Key ID is required");
        }
        if (razorpayEnabled && !razorpayKeySecret.trim()) {
          throw new Error("Razorpay Key Secret is required");
        }

        const payload = {
          store_id: storeId!,
          payment_methods: methods,
          razorpay_key_id: razorpayEnabled ? razorpayKeyId.trim() : null,
          razorpay_key_secret: razorpayEnabled ? razorpayKeySecret.trim() : null,
        };

        if (paymentConfig) {
          const { error } = await (supabase as any)
            .from("store_payment_config")
            .update(payload)
            .eq("id", paymentConfig.id);
          if (error) throw error;
        } else {
          const { error } = await (supabase as any)
            .from("store_payment_config")
            .insert(payload);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store", storeId] });
      queryClient.invalidateQueries({ queryKey: ["payment-config", storeId] });
      queryClient.invalidateQueries({ queryKey: ["my-store"] });
      toast.success("Payment settings saved!");
    },
    onError: (err: any) => toast.error(err.message || "Failed to save"),
  });

  if (storeLoading || configLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Orders & Payments</h1>
        <p className="text-sm text-muted-foreground">
          Configure how customers place orders and pay
        </p>
      </div>

      {/* Section 1: Order Mode */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Layers className="h-5 w-5" /> Order Mode
          </CardTitle>
          <CardDescription>Choose how customers can place orders</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={orderMode}
            onValueChange={(v) => setOrderMode(v as OrderMode)}
            className="grid gap-3"
          >
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition-all ${
                orderMode === "whatsapp"
                  ? "border-primary bg-primary/5"
                  : "border-input hover:border-primary/30"
              }`}
            >
              <RadioGroupItem value="whatsapp" className="mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <MessageCircle className="h-4 w-4 text-green-600" /> WhatsApp Orders
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Customers order via WhatsApp message. No online payment needed.
                </p>
              </div>
            </label>

            <label
              className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition-all ${
                orderMode === "website"
                  ? "border-primary bg-primary/5"
                  : "border-input hover:border-primary/30"
              }`}
            >
              <RadioGroupItem value="website" className="mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <Globe className="h-4 w-4 text-blue-600" /> Website Checkout
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Customers checkout on your website with Buy Now button.
                </p>
              </div>
            </label>

            <label
              className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition-all ${
                orderMode === "both"
                  ? "border-primary bg-primary/5"
                  : "border-input hover:border-primary/30"
              }`}
            >
              <RadioGroupItem value="both" className="mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-purple-600" /> Both
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Customers can choose WhatsApp or Website checkout.
                </p>
              </div>
            </label>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Section 2: Payment Configuration */}
      {showPaymentConfig && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CreditCard className="h-5 w-5" /> Payment Methods
            </CardTitle>
            <CardDescription>
              Configure payment options for website checkout
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* COD */}
            <div className="flex items-center justify-between rounded-xl border p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                  <Banknote className="h-5 w-5 text-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Cash on Delivery</p>
                  <p className="text-xs text-muted-foreground">
                    Customers pay when order is delivered
                  </p>
                </div>
              </div>
              <Switch checked={codEnabled} onCheckedChange={setCodEnabled} />
            </div>

            {/* Razorpay */}
            <Collapsible open={razorpayOpen} onOpenChange={setRazorpayOpen}>
              <div className="rounded-xl border">
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950">
                      <CreditCard className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Razorpay</p>
                      <p className="text-xs text-muted-foreground">
                        Cards, UPI, Net Banking, Wallets • 2% per transaction
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={razorpayEnabled}
                      onCheckedChange={(v) => {
                        setRazorpayEnabled(v);
                        if (v) setRazorpayOpen(true);
                      }}
                    />
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ChevronDown className={`h-4 w-4 transition-transform ${razorpayOpen ? "rotate-180" : ""}`} />
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                </div>

                <CollapsibleContent>
                  <div className="border-t px-4 pb-4 pt-3 space-y-4">
                    {/* Instructions */}
                    <div className="rounded-lg bg-accent/50 p-3 text-xs text-muted-foreground space-y-1">
                      <p className="font-medium text-foreground flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5" /> Get your Razorpay API Keys
                      </p>
                      <ol className="list-decimal list-inside space-y-0.5 pl-1">
                        <li>
                          Go to{" "}
                          <a
                            href="https://dashboard.razorpay.com/app/keys"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline inline-flex items-center gap-0.5"
                          >
                            Razorpay Dashboard <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        </li>
                        <li>Navigate to Settings → API Keys</li>
                        <li>Generate or copy your Key ID and Key Secret</li>
                      </ol>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="rzp-key">Razorpay Key ID *</Label>
                      <Input
                        id="rzp-key"
                        placeholder="rzp_live_xxxxxxxxxxxxx"
                        value={razorpayKeyId}
                        onChange={(e) => setRazorpayKeyId(e.target.value)}
                        maxLength={50}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="rzp-secret">Razorpay Key Secret *</Label>
                      <Input
                        id="rzp-secret"
                        type="password"
                        placeholder="••••••••••••••••••••"
                        value={razorpayKeySecret}
                        onChange={(e) => setRazorpayKeySecret(e.target.value)}
                        maxLength={100}
                      />
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          </CardContent>
        </Card>
      )}

      {/* Section 3: Partial Payment Defaults */}
      {showPaymentConfig && razorpayEnabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <IndianRupee className="h-5 w-5" /> Partial Payment (Advance + COD)
            </CardTitle>
            <CardDescription>
              Set default advance payment for all products. Customers pay a portion online and the rest on delivery.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Enable Partial Payment</p>
                <p className="text-xs text-muted-foreground">Require advance payment on all products</p>
              </div>
              <Switch checked={partialEnabled} onCheckedChange={setPartialEnabled} />
            </div>

            {partialEnabled && (
              <>
                <div className="space-y-2">
                  <Label className="text-sm">Advance Type</Label>
                  <RadioGroup
                    value={partialType}
                    onValueChange={(v) => setPartialType(v as "percentage" | "fixed")}
                    className="flex gap-4"
                  >
                    <label className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 px-4 py-2.5 transition-all ${
                      partialType === "percentage" ? "border-primary bg-primary/5" : "border-input"
                    }`}>
                      <RadioGroupItem value="percentage" />
                      <Percent className="h-4 w-4" />
                      <span className="text-sm font-medium">Percentage</span>
                    </label>
                    <label className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 px-4 py-2.5 transition-all ${
                      partialType === "fixed" ? "border-primary bg-primary/5" : "border-input"
                    }`}>
                      <RadioGroupItem value="fixed" />
                      <IndianRupee className="h-4 w-4" />
                      <span className="text-sm font-medium">Fixed ₹</span>
                    </label>
                  </RadioGroup>
                </div>

                <div className="space-y-1.5">
                  <Label>
                    {partialType === "percentage" ? "Advance Percentage (%)" : "Advance Amount (₹)"}
                  </Label>
                  <Input
                    type="number"
                    placeholder={partialType === "percentage" ? "e.g. 30" : "e.g. 200"}
                    value={partialValue}
                    onChange={(e) => setPartialValue(e.target.value)}
                    min={partialType === "percentage" ? 10 : 50}
                    max={partialType === "percentage" ? 80 : undefined}
                  />
                  <p className="text-xs text-muted-foreground">
                    {partialType === "percentage"
                      ? "Min 10%, Max 80%. Customer pays this % online, rest as COD."
                      : "Min ₹50. Customer pays this fixed amount online, rest as COD."}
                  </p>
                </div>

                {/* Preview */}
                {partialValue && Number(partialValue) > 0 && (
                  <div className="rounded-lg border bg-accent/30 p-3">
                    <p className="text-xs font-medium text-foreground mb-1">Preview (for ₹1,000 product):</p>
                    <p className="text-sm text-foreground">
                      {partialType === "percentage"
                        ? `Pay ₹${Math.round(1000 * Number(partialValue) / 100)} now, ₹${1000 - Math.round(1000 * Number(partialValue) / 100)} on delivery`
                        : `Pay ₹${Math.min(Number(partialValue), 1000)} now, ₹${Math.max(1000 - Number(partialValue), 0)} on delivery`}
                    </p>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  This setting applies to all products in your store. Click "Save Settings" below to apply.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Button
        className="w-full"
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
      >
        {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save Settings
      </Button>
    </div>
  );
}
