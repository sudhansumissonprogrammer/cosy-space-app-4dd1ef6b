import { useState, useEffect } from "react";
import { useStoreSlugParam } from "@/hooks/useStoreSlugParam";
import { useStorePurge } from "@/hooks/useStorePurge";
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
  ChevronDown, ExternalLink, ShieldCheck, Layers, IndianRupee, Percent, Zap,
} from "lucide-react";

type OrderMode = "whatsapp" | "website" | "both";
type OnlineGateway = "none" | "razorpay" | "cashfree";

export default function StorePayments() {
  const { storeId } = useStoreSlugParam();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const purgeStore = useStorePurge(storeId);

  const [orderMode, setOrderMode] = useState<OrderMode>("whatsapp");
  const [codEnabled, setCodEnabled] = useState(true);

  // Mutually-exclusive online gateway selection
  const [onlineGateway, setOnlineGateway] = useState<OnlineGateway>("none");

  // Razorpay creds
  const [razorpayKeyId, setRazorpayKeyId] = useState("");
  const [razorpayKeySecret, setRazorpayKeySecret] = useState("");
  const [razorpayOpen, setRazorpayOpen] = useState(false);

  // Cashfree creds
  const [cashfreeAppId, setCashfreeAppId] = useState("");
  const [cashfreeSecretKey, setCashfreeSecretKey] = useState("");
  const [cashfreeEnv, setCashfreeEnv] = useState<"production" | "sandbox">("production");
  const [cashfreeOpen, setCashfreeOpen] = useState(false);

  // Partial payment defaults
  const [partialEnabled, setPartialEnabled] = useState(false);
  const [partialType, setPartialType] = useState<"percentage" | "fixed">("percentage");
  const [partialValue, setPartialValue] = useState("");

  const { data: store, isLoading: storeLoading } = useStoreData(storeId);

  useEffect(() => {
    if (store) {
      setPartialEnabled((store as any).partial_payment_enabled ?? false);
      setPartialType((store as any).partial_payment_type || "percentage");
      setPartialValue((store as any).partial_payment_value ? String((store as any).partial_payment_value) : "");
    }
  }, [store]);

  const { data: paymentConfig, isLoading: configLoading } = useQuery({
    queryKey: ["payment-config", storeId],
    // Always re-fetch on mount so the form reflects the latest saved state
    // (avoids showing stale "None" when DB has a gateway configured).
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: "always",
    queryFn: async () => {
      // Use SECURITY DEFINER RPC so the SELECT works for store owners
      // even if RLS edge cases (admin view, multi-store) get in the way.
      const [configRes, rzpSecretRes, cfSecretRes] = await Promise.all([
        supabase.rpc("get_store_payment_config" as any, { _store_id: storeId! }),
        supabase.rpc("get_own_payment_secret", { _store_id: storeId! }),
        supabase.rpc("get_own_cashfree_secret" as any, { _store_id: storeId! }),
      ]);
      if (configRes.error) throw configRes.error;
      const cfg = configRes.data as any;
      if (!cfg) return null;
      return {
        ...cfg,
        razorpay_key_secret: (rzpSecretRes.data as string) || null,
        cashfree_secret_key: (cfSecretRes.data as string) || null,
      };
    },
    enabled: !!storeId,
  });

  const isCommission = (store as any)?.billing_mode === "commission";

  useEffect(() => {
    if (store) {
      // Commission-based stores can only use Website Checkout — WhatsApp ordering is disabled.
      if ((store as any).billing_mode === "commission") {
        setOrderMode("website");
      } else {
        setOrderMode((store.order_mode as OrderMode) || "whatsapp");
      }
    }
  }, [store]);

  useEffect(() => {
    if (paymentConfig) {
      const methods: string[] = paymentConfig.payment_methods || ["cod"];
      setCodEnabled(methods.includes("cod"));

      if (methods.includes("razorpay")) {
        setOnlineGateway("razorpay");
        setRazorpayOpen(true);
      } else if (methods.includes("cashfree")) {
        setOnlineGateway("cashfree");
        setCashfreeOpen(true);
      } else {
        setOnlineGateway("none");
      }

      setRazorpayKeyId(paymentConfig.razorpay_key_id || "");
      setRazorpayKeySecret(paymentConfig.razorpay_key_secret || "");
      setCashfreeAppId(paymentConfig.cashfree_app_id || "");
      setCashfreeSecretKey(paymentConfig.cashfree_secret_key || "");
      setCashfreeEnv((paymentConfig.cashfree_env as any) || "production");
    }
  }, [paymentConfig]);

  const showPaymentConfig = orderMode === "website" || orderMode === "both";
  const onlineEnabled = onlineGateway !== "none";

  // Mutually exclusive switch handler
  const switchGateway = (next: OnlineGateway) => {
    setOnlineGateway(next);
    if (next === "razorpay") {
      setRazorpayOpen(true);
      setCashfreeOpen(false);
    } else if (next === "cashfree") {
      setCashfreeOpen(true);
      setRazorpayOpen(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const partialUpdate: Record<string, any> = {
        order_mode: orderMode,
        partial_payment_enabled: partialEnabled && onlineEnabled,
        partial_payment_type: partialType,
        partial_payment_value: partialEnabled && partialValue ? Number(partialValue) : null,
      };

      if (partialEnabled && onlineEnabled && partialValue) {
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

      if (showPaymentConfig) {
        const methods: string[] = [];
        if (codEnabled) methods.push("cod");
        if (onlineGateway === "razorpay") methods.push("razorpay");
        if (onlineGateway === "cashfree") methods.push("cashfree");
        if (methods.length === 0) {
          throw new Error("At least one payment method must be enabled");
        }
        if (onlineGateway === "razorpay") {
          if (!razorpayKeyId.trim()) throw new Error("Razorpay Key ID is required");
          if (!razorpayKeySecret.trim()) throw new Error("Razorpay Key Secret is required");
        }
        if (onlineGateway === "cashfree") {
          if (!cashfreeAppId.trim()) throw new Error("Cashfree App ID is required");
          if (!cashfreeSecretKey.trim()) throw new Error("Cashfree Secret Key is required");
        }

        // Persist BOTH sets of credentials so the merchant can flip between gateways
        // without re-typing — but only the active gateway is in `payment_methods`.
        const payload: Record<string, any> = {
          store_id: storeId!,
          payment_methods: methods,
          razorpay_key_id: razorpayKeyId.trim() || null,
          razorpay_key_secret: razorpayKeySecret.trim() || null,
          cashfree_app_id: cashfreeAppId.trim() || null,
          cashfree_secret_key: cashfreeSecretKey.trim() || null,
          cashfree_env: cashfreeEnv,
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
      queryClient.invalidateQueries({ queryKey: ["store-payment-config"] });
      toast.success("Payment settings saved!");
      // Auto-purge edge cache so storefront reflects changes instantly
      purgeStore();
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
          {isCommission && (
            <div className="mb-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs text-foreground">
              Your store is on the <strong>commission plan</strong>, so orders must go through Website Checkout (so commission can be tracked on each order). WhatsApp ordering is disabled.
            </div>
          )}
          <RadioGroup
            value={orderMode}
            onValueChange={(v) => { if (!isCommission) setOrderMode(v as OrderMode); }}
            className="grid gap-3"
          >
            {!isCommission && (
              <label className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition-all ${orderMode === "whatsapp" ? "border-primary bg-primary/5" : "border-input hover:border-primary/30"}`}>
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
            )}

            <label className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition-all ${orderMode === "website" ? "border-primary bg-primary/5" : "border-input hover:border-primary/30"}`}>
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

            {!isCommission && (
              <label className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition-all ${orderMode === "both" ? "border-primary bg-primary/5" : "border-input hover:border-primary/30"}`}>
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
            )}
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
              Configure payment options for website checkout. You can enable COD and one online gateway.
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

            {/* Online gateway selector */}
            <div className="rounded-xl border p-4 space-y-3">
              <div>
                <p className="text-sm font-medium text-foreground">Online Payment Gateway</p>
                <p className="text-xs text-muted-foreground">
                  Choose one. Only the selected gateway will be used at checkout.
                </p>
              </div>
              <RadioGroup
                value={onlineGateway}
                onValueChange={(v) => switchGateway(v as OnlineGateway)}
                className="grid gap-2 sm:grid-cols-3"
              >
                <label className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 px-3 py-2.5 transition-all ${onlineGateway === "none" ? "border-primary bg-primary/5" : "border-input"}`}>
                  <RadioGroupItem value="none" />
                  <span className="text-sm font-medium">None</span>
                </label>
                <label className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 px-3 py-2.5 transition-all ${onlineGateway === "razorpay" ? "border-primary bg-primary/5" : "border-input"}`}>
                  <RadioGroupItem value="razorpay" />
                  <CreditCard className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium">Razorpay</span>
                </label>
                <label className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 px-3 py-2.5 transition-all ${onlineGateway === "cashfree" ? "border-primary bg-primary/5" : "border-input"}`}>
                  <RadioGroupItem value="cashfree" />
                  <Zap className="h-4 w-4 text-violet-600" />
                  <span className="text-sm font-medium">Cashfree</span>
                </label>
              </RadioGroup>
            </div>

            {/* Razorpay creds */}
            {onlineGateway === "razorpay" && (
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
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ChevronDown className={`h-4 w-4 transition-transform ${razorpayOpen ? "rotate-180" : ""}`} />
                      </Button>
                    </CollapsibleTrigger>
                  </div>

                  <CollapsibleContent>
                    <div className="border-t px-4 pb-4 pt-3 space-y-4">
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
                          name="rzp-key-id"
                          placeholder="rzp_live_xxxxxxxxxxxxx"
                          value={razorpayKeyId}
                          onChange={(e) => setRazorpayKeyId(e.target.value)}
                          maxLength={50}
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck={false}
                          data-lpignore="true"
                          data-form-type="other"
                          data-1p-ignore="true"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="rzp-secret">Razorpay Key Secret *</Label>
                        <Input
                          id="rzp-secret"
                          name="rzp-key-secret"
                          type="password"
                          placeholder="••••••••••••••••••••"
                          value={razorpayKeySecret}
                          onChange={(e) => setRazorpayKeySecret(e.target.value)}
                          maxLength={100}
                          autoComplete="new-password"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck={false}
                          data-lpignore="true"
                          data-form-type="other"
                          data-1p-ignore="true"
                        />
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            )}

            {/* Cashfree creds */}
            {onlineGateway === "cashfree" && (
              <Collapsible open={cashfreeOpen} onOpenChange={setCashfreeOpen}>
                <div className="rounded-xl border">
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-950">
                        <Zap className="h-5 w-5 text-violet-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Cashfree</p>
                        <p className="text-xs text-muted-foreground">
                          UPI, Cards, Net Banking, Wallets, Pay Later • Lower fees
                        </p>
                      </div>
                    </div>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ChevronDown className={`h-4 w-4 transition-transform ${cashfreeOpen ? "rotate-180" : ""}`} />
                      </Button>
                    </CollapsibleTrigger>
                  </div>

                  <CollapsibleContent>
                    <div className="border-t px-4 pb-4 pt-3 space-y-4">
                      <div className="rounded-lg bg-accent/50 p-3 text-xs text-muted-foreground space-y-1">
                        <p className="font-medium text-foreground flex items-center gap-1.5">
                          <ShieldCheck className="h-3.5 w-3.5" /> Get your Cashfree API Keys
                        </p>
                        <ol className="list-decimal list-inside space-y-0.5 pl-1">
                          <li>
                            Go to{" "}
                            <a
                              href="https://merchant.cashfree.com/merchants/pg/developers/api"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary underline inline-flex items-center gap-0.5"
                            >
                              Cashfree Dashboard <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          </li>
                          <li>Navigate to Developers → API Keys</li>
                          <li>Copy your App ID and Secret Key (use Production for live, Sandbox for testing)</li>
                        </ol>
                      </div>

                      <div className="space-y-1.5">
                        <Label>Environment *</Label>
                        <RadioGroup
                          value={cashfreeEnv}
                          onValueChange={(v) => setCashfreeEnv(v as "production" | "sandbox")}
                          className="flex gap-4"
                        >
                          <label className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 px-4 py-2 transition-all ${cashfreeEnv === "production" ? "border-primary bg-primary/5" : "border-input"}`}>
                            <RadioGroupItem value="production" />
                            <span className="text-sm font-medium">Production (Live)</span>
                          </label>
                          <label className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 px-4 py-2 transition-all ${cashfreeEnv === "sandbox" ? "border-primary bg-primary/5" : "border-input"}`}>
                            <RadioGroupItem value="sandbox" />
                            <span className="text-sm font-medium">Sandbox (Test)</span>
                          </label>
                        </RadioGroup>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="cf-id">Cashfree App ID *</Label>
                        <Input
                          id="cf-id"
                          name="cf-app-id"
                          placeholder="TEST… or production App ID"
                          value={cashfreeAppId}
                          onChange={(e) => setCashfreeAppId(e.target.value)}
                          maxLength={100}
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck={false}
                          data-lpignore="true"
                          data-form-type="other"
                          data-1p-ignore="true"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="cf-secret">Cashfree Secret Key *</Label>
                        <Input
                          id="cf-secret"
                          name="cf-secret-key"
                          type="password"
                          placeholder="••••••••••••••••••••"
                          value={cashfreeSecretKey}
                          onChange={(e) => setCashfreeSecretKey(e.target.value)}
                          maxLength={200}
                          autoComplete="new-password"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck={false}
                          data-lpignore="true"
                          data-form-type="other"
                          data-1p-ignore="true"
                        />
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            )}
          </CardContent>
        </Card>
      )}

      {/* Section 3: Partial Payment Defaults — visible whenever website checkout is on */}
      {showPaymentConfig && (
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
            {!onlineEnabled && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                Select an online gateway (Razorpay or Cashfree) above for partial payment to take effect at checkout.
              </div>
            )}
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
                    <label className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 px-4 py-2.5 transition-all ${partialType === "percentage" ? "border-primary bg-primary/5" : "border-input"}`}>
                      <RadioGroupItem value="percentage" />
                      <Percent className="h-4 w-4" />
                      <span className="text-sm font-medium">Percentage</span>
                    </label>
                    <label className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 px-4 py-2.5 transition-all ${partialType === "fixed" ? "border-primary bg-primary/5" : "border-input"}`}>
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
