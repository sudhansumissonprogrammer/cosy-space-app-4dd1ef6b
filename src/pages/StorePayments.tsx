import { useState, useEffect } from "react";
import { useStoreSlugParam } from "@/hooks/useStoreSlugParam";
import { useStorePurge } from "@/hooks/useStorePurge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
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
type OnlineGateway = "none" | "razorpay" | "cashfree" | "payu";

export default function StorePayments() {
  const { storeId, isAdminView } = useStoreSlugParam();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const purgeStore = useStorePurge(storeId);

  const [orderMode, setOrderMode] = useState<OrderMode>("website");
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

  // PayU creds
  const [payuMerchantKey, setPayuMerchantKey] = useState("");
  const [payuMerchantSalt, setPayuMerchantSalt] = useState("");
  const [payuEnv, setPayuEnv] = useState<"production" | "sandbox">("production");
  const [payuOpen, setPayuOpen] = useState(false);

  // Partial payment defaults
  const [partialEnabled, setPartialEnabled] = useState(false);
  const [partialType, setPartialType] = useState<"percentage" | "fixed">("percentage");
  const [partialValue, setPartialValue] = useState("");

  // Prepaid (full online payment) discount
  const [prepaidDiscountEnabled, setPrepaidDiscountEnabled] = useState(false);
  const [prepaidDiscountType, setPrepaidDiscountType] = useState<"fixed" | "percentage">("fixed");
  const [prepaidDiscountValue, setPrepaidDiscountValue] = useState("");
  // Tier-2: bigger flat discount above a spend threshold (e.g. ₹200 off above ₹3000).
  // Only applies when Discount Type = Fixed. Leave blank to disable the tier.
  const [prepaidDiscountTier2Min, setPrepaidDiscountTier2Min] = useState("");
  const [prepaidDiscountTier2Value, setPrepaidDiscountTier2Value] = useState("");

  // Checkout V2 (GoKwik-style one-page UPI intent checkout) — off by default
  const [checkoutV2Enabled, setCheckoutV2Enabled] = useState(false);

  // WhatsApp OTP verification at checkout — strictly opt-in, off by default.
  const [checkoutOtpEnabled, setCheckoutOtpEnabled] = useState(false);

  const { data: store, isLoading: storeLoading } = useQuery({
    queryKey: ["payment-store-settings", storeId, isAdminView],
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: "always",
    queryFn: async () => {
      if (isAdminView) {
        const { data, error } = await supabase.rpc("get_store_as_admin", { _slug: storeId! });
        if (error) throw error;
        return data as any;
      }

      const [storeResult, otpResult] = await Promise.all([
        (supabase as any)
          .from("stores")
          .select("id, owner_id, name, slug, order_mode, billing_mode, partial_payment_enabled, partial_payment_type, partial_payment_value, checkout_v2_enabled")
          .eq("id", storeId!)
          .eq("owner_id", user!.id)
          .maybeSingle(),
        (supabase as any).rpc("get_own_store_checkout_otp", { _store_id: storeId! }),
      ]);
      if (storeResult.error) throw storeResult.error;
      if (otpResult.error) throw otpResult.error;
      return storeResult.data
        ? { ...storeResult.data, checkout_otp_enabled: otpResult.data ?? false }
        : null;
    },
    enabled: !!storeId && (isAdminView || !!user),
  });

  // Payment settings must always reflect the live backend row — never a stale
  // dashboard/admin cache. Clear sibling cache keys on entry so other dashboard
  // components also re-sync after this page opens.
  useEffect(() => {
    if (!storeId) return;
    // Invalidate BOTH keys: ["store", id] is what useStoreData reads, but in
    // admin-view mode useAdminStoreView re-seeds that key from its own cached
    // ["admin-store-view", slug] row. If we only invalidate ["store", id],
    // React Query refetches → useAdminStoreView's effect immediately overwrites
    // with the 5-min-stale admin row → toggles (Partial Payment, Fast Checkout,
    // Prepaid Discount) render OFF even though DB says ON.
    queryClient.invalidateQueries({ queryKey: ["store", storeId] });
    queryClient.invalidateQueries({ queryKey: ["admin-store-view"] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  useEffect(() => {
    if (store) {
      setPartialEnabled((store as any).partial_payment_enabled ?? false);
      setPartialType((store as any).partial_payment_type || "percentage");
      setPartialValue((store as any).partial_payment_value ? String((store as any).partial_payment_value) : "");
      setCheckoutV2Enabled((store as any).checkout_v2_enabled ?? false);
      setCheckoutOtpEnabled((store as any).checkout_otp_enabled ?? false);
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
      const [configRes, rzpSecretRes, cfSecretRes, payuSecretRes] = await Promise.all([
        supabase.rpc("get_store_payment_config" as any, { _store_id: storeId! }),
        supabase.rpc("get_own_payment_secret", { _store_id: storeId! }),
        supabase.rpc("get_own_cashfree_secret" as any, { _store_id: storeId! }),
        supabase.rpc("get_own_payu_secret" as any, { _store_id: storeId! }),
      ]);
      if (configRes.error) throw configRes.error;
      const cfg = configRes.data as any;
      if (!cfg) return null;
      return {
        ...cfg,
        razorpay_key_secret: (rzpSecretRes.data as string) || null,
        cashfree_secret_key: (cfSecretRes.data as string) || null,
        payu_merchant_salt: (payuSecretRes.data as string) || null,
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
      } else if (methods.includes("payu")) {
        setOnlineGateway("payu");
        setPayuOpen(true);
      } else {
        setOnlineGateway("none");
      }

      setRazorpayKeyId(paymentConfig.razorpay_key_id || "");
      setRazorpayKeySecret(paymentConfig.razorpay_key_secret || "");
      setCashfreeAppId(paymentConfig.cashfree_app_id || "");
      setCashfreeSecretKey(paymentConfig.cashfree_secret_key || "");
      setCashfreeEnv((paymentConfig.cashfree_env as any) || "production");
      setPayuMerchantKey(paymentConfig.payu_merchant_key || "");
      setPayuMerchantSalt(paymentConfig.payu_merchant_salt || "");
      setPayuEnv((paymentConfig.payu_env as any) || "production");

      setPrepaidDiscountEnabled(!!(paymentConfig as any).prepaid_discount_enabled);
      setPrepaidDiscountType(((paymentConfig as any).prepaid_discount_type as any) || "fixed");
      const pdv = (paymentConfig as any).prepaid_discount_value;
      // Default the base amount to ₹100 when the discount is turned on for the first time.
      setPrepaidDiscountValue(pdv != null && Number(pdv) > 0 ? String(pdv) : ((paymentConfig as any).prepaid_discount_enabled ? "100" : ""));
      const t2m = (paymentConfig as any).prepaid_discount_tier2_min;
      const t2v = (paymentConfig as any).prepaid_discount_tier2_value;
      setPrepaidDiscountTier2Min(t2m != null && Number(t2m) > 0 ? String(t2m) : "");
      setPrepaidDiscountTier2Value(t2v != null && Number(t2v) > 0 ? String(t2v) : "");
    }
  }, [paymentConfig]);

  const showPaymentConfig = orderMode === "website" || orderMode === "both";
  const onlineEnabled = onlineGateway !== "none";

  // Mutually exclusive switch handler
  const switchGateway = (next: OnlineGateway) => {
    setOnlineGateway(next);
    setRazorpayOpen(next === "razorpay");
    setCashfreeOpen(next === "cashfree");
    setPayuOpen(next === "payu");
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const partialUpdate: Record<string, any> = {
        order_mode: "website",
        partial_payment_enabled: partialEnabled && onlineEnabled,
        partial_payment_type: partialType,
        partial_payment_value: partialEnabled && partialValue ? Number(partialValue) : null,
        checkout_v2_enabled: true,
        checkout_otp_enabled: checkoutOtpEnabled,
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
        if (onlineGateway === "payu") methods.push("payu");
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
        if (onlineGateway === "payu") {
          if (!payuMerchantKey.trim()) throw new Error("PayU Merchant Key is required");
          if (!payuMerchantSalt.trim()) throw new Error("PayU Merchant Salt is required");
        }

        // Persist all sets of credentials so the merchant can flip between gateways
        // without re-typing — but only the active gateway is in `payment_methods`.
        //
        // SAFETY: NEVER overwrite an existing secret with null/empty. If the secret
        // RPC failed transiently (network blip / permissions edge case), state will be ""
        // even though the DB has a real secret. Sending null here would silently wipe
        // the gateway and break every checkout. Only include a secret field when the
        // user actually typed a non-empty value.
        const payload: Record<string, any> = {
          store_id: storeId!,
          payment_methods: methods,
          razorpay_key_id: razorpayKeyId.trim() || null,
          cashfree_app_id: cashfreeAppId.trim() || null,
          cashfree_env: cashfreeEnv,
          payu_merchant_key: payuMerchantKey.trim() || null,
          payu_env: payuEnv,
          prepaid_discount_enabled: prepaidDiscountEnabled && !!prepaidDiscountValue && Number(prepaidDiscountValue) > 0,
          prepaid_discount_type: prepaidDiscountType,
          prepaid_discount_value: prepaidDiscountValue ? Number(prepaidDiscountValue) : 0,
          // Tier-2 is only meaningful for "fixed" and when both threshold + value are set.
          prepaid_discount_tier2_min:
            prepaidDiscountEnabled && prepaidDiscountType === "fixed" && prepaidDiscountTier2Min && Number(prepaidDiscountTier2Min) > 0
              ? Number(prepaidDiscountTier2Min) : null,
          prepaid_discount_tier2_value:
            prepaidDiscountEnabled && prepaidDiscountType === "fixed" && prepaidDiscountTier2Value && Number(prepaidDiscountTier2Value) > 0
              ? Number(prepaidDiscountTier2Value) : null,
        };
        if (razorpayKeySecret.trim()) payload.razorpay_key_secret = razorpayKeySecret.trim();
        if (cashfreeSecretKey.trim()) payload.cashfree_secret_key = cashfreeSecretKey.trim();
        if (payuMerchantSalt.trim()) payload.payu_merchant_salt = payuMerchantSalt.trim();

        if (paymentConfig) {
          const { error } = await (supabase as any)
            .from("store_payment_config")
            .update(payload)
            .eq("id", paymentConfig.id)
            .eq("store_id", storeId!);
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
      queryClient.invalidateQueries({ queryKey: ["payment-store-settings", storeId] });
      queryClient.invalidateQueries({ queryKey: ["store", storeId] });
      queryClient.invalidateQueries({ queryKey: ["admin-store-view"] });
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

  // Derive the gateway that is ACTUALLY live per DB (source of truth for checkout).
  // A stale entry in payment_methods without credentials would silently fall through,
  // so we require both to consider a gateway "live".
  const liveMethods: string[] = (paymentConfig?.payment_methods as string[] | undefined) || [];
  const liveGateway: OnlineGateway =
    liveMethods.includes("razorpay") && paymentConfig?.razorpay_key_id ? "razorpay"
    : liveMethods.includes("cashfree") && paymentConfig?.cashfree_app_id ? "cashfree"
    : liveMethods.includes("payu") && paymentConfig?.payu_merchant_key ? "payu"
    : "none";
  const gatewayMismatch = onlineGateway !== "none" && onlineGateway !== liveGateway;

  return (
    <div className="mx-auto max-w-2xl xl:max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Orders & Payments</h1>
        <p className="text-sm text-muted-foreground">
          Configure how customers place orders and pay
        </p>
      </div>

      {/* Live-gateway indicator — shows what's ACTUALLY charging customers right now,
          not just what's picked in the form. Prevents "I switched but old one still opens". */}
      {showPaymentConfig && (
        <div className={`rounded-xl border p-3 text-sm ${
          gatewayMismatch
            ? "border-warning/50 bg-warning/10 text-foreground"
            : "border-primary/30 bg-primary/5 text-foreground"
        }`}>
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1">
              <p className="font-medium">
                Live on checkout: {liveGateway === "none"
                  ? "COD only (no online gateway saved)"
                  : liveGateway.charAt(0).toUpperCase() + liveGateway.slice(1)}
              </p>
              {gatewayMismatch && (
                <p className="mt-0.5 text-xs">
                  You picked <strong>{onlineGateway}</strong> below, but it's not saved yet.
                  Enter the credentials and click <strong>Save</strong> — otherwise customers keep seeing <strong>{liveGateway}</strong>.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

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
              <label className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition-[transform,opacity,colors,box-shadow] ${orderMode === "whatsapp" ? "border-primary bg-primary/5" : "border-input hover:border-primary/30"}`}>
                <RadioGroupItem value="whatsapp" className="mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <MessageCircle className="h-4 w-4 text-success" /> WhatsApp Orders
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Customers order via WhatsApp message. No online payment needed.
                  </p>
                </div>
              </label>
            )}

            <label className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition-[transform,opacity,colors,box-shadow] ${orderMode === "website" ? "border-primary bg-primary/5" : "border-input hover:border-primary/30"}`}>
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
              <label className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition-[transform,opacity,colors,box-shadow] ${orderMode === "both" ? "border-primary bg-primary/5" : "border-input hover:border-primary/30"}`}>
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
                className="grid gap-2 sm:grid-cols-2"
              >
                <label className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 px-3 py-2.5 transition-[transform,opacity,colors,box-shadow] ${onlineGateway === "none" ? "border-primary bg-primary/5" : "border-input"}`}>
                  <RadioGroupItem value="none" />
                  <span className="text-sm font-medium">None</span>
                </label>
                <label className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 px-3 py-2.5 transition-[transform,opacity,colors,box-shadow] ${onlineGateway === "razorpay" ? "border-primary bg-primary/5" : "border-input"}`}>
                  <RadioGroupItem value="razorpay" />
                  <CreditCard className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium">Razorpay</span>
                </label>
                <label className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 px-3 py-2.5 transition-[transform,opacity,colors,box-shadow] ${onlineGateway === "cashfree" ? "border-primary bg-primary/5" : "border-input"}`}>
                  <RadioGroupItem value="cashfree" />
                  <Zap className="h-4 w-4 text-violet-600" />
                  <span className="text-sm font-medium">Cashfree</span>
                </label>
                <label className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 px-3 py-2.5 transition-[transform,opacity,colors,box-shadow] ${onlineGateway === "payu" ? "border-primary bg-primary/5" : "border-input"}`}>
                  <RadioGroupItem value="payu" />
                  <CreditCard className="h-4 w-4 text-success" />
                  <span className="text-sm font-medium">PayU</span>
                </label>
              </RadioGroup>
            </div>

            {/* Razorpay creds */}
            {onlineGateway === "razorpay" && (
              <Collapsible open={razorpayOpen} onOpenChange={setRazorpayOpen}>
                <div className="rounded-xl border">
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
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
                      <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Toggle Razorpay settings">
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
                      <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Toggle Cashfree settings">
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
                          <label className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 px-4 py-2 transition-[transform,opacity,colors,box-shadow] ${cashfreeEnv === "production" ? "border-primary bg-primary/5" : "border-input"}`}>
                            <RadioGroupItem value="production" />
                            <span className="text-sm font-medium">Production (Live)</span>
                          </label>
                          <label className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 px-4 py-2 transition-[transform,opacity,colors,box-shadow] ${cashfreeEnv === "sandbox" ? "border-primary bg-primary/5" : "border-input"}`}>
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

            {/* PayU creds */}
            {onlineGateway === "payu" && (
              <Collapsible open={payuOpen} onOpenChange={setPayuOpen}>
                <div className="rounded-xl border">
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                        <CreditCard className="h-5 w-5 text-success" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">PayU</p>
                        <p className="text-xs text-muted-foreground">
                          UPI, Cards, Net Banking, Wallets, EMI • Merchant Hosted (Bolt)
                        </p>
                      </div>
                    </div>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Toggle PayU settings">
                        <ChevronDown className={`h-4 w-4 transition-transform ${payuOpen ? "rotate-180" : ""}`} />
                      </Button>
                    </CollapsibleTrigger>
                  </div>

                  <CollapsibleContent>
                    <div className="border-t px-4 pb-4 pt-3 space-y-4">
                      <div className="rounded-lg bg-accent/50 p-3 text-xs text-muted-foreground space-y-1">
                        <p className="font-medium text-foreground flex items-center gap-1.5">
                          <ShieldCheck className="h-3.5 w-3.5" /> Get your PayU API Keys
                        </p>
                        <ol className="list-decimal list-inside space-y-0.5 pl-1">
                          <li>
                            Go to{" "}
                            <a
                              href="https://onboarding.payu.in/app/account/gateway-credentials"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary underline inline-flex items-center gap-0.5"
                            >
                              PayU Dashboard <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          </li>
                          <li>Navigate to Settings → My Account → Merchant Key &amp; Salt</li>
                          <li>Copy your Merchant Key and Salt (use Production for live, Test for sandbox)</li>
                          <li>
                            Set webhook URL in PayU dashboard to:{" "}
                            <code className="text-[10px] bg-muted px-1 py-0.5 rounded">
                              https://{import.meta.env.VITE_SUPABASE_PROJECT_ID}.functions.supabase.co/payu-webhook
                            </code>
                          </li>
                        </ol>
                      </div>

                      <div className="space-y-1.5">
                        <Label>Environment *</Label>
                        <RadioGroup
                          value={payuEnv}
                          onValueChange={(v) => setPayuEnv(v as "production" | "sandbox")}
                          className="flex gap-4"
                        >
                          <label className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 px-4 py-2 transition-[transform,opacity,colors,box-shadow] ${payuEnv === "production" ? "border-primary bg-primary/5" : "border-input"}`}>
                            <RadioGroupItem value="production" />
                            <span className="text-sm font-medium">Production (Live)</span>
                          </label>
                          <label className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 px-4 py-2 transition-[transform,opacity,colors,box-shadow] ${payuEnv === "sandbox" ? "border-primary bg-primary/5" : "border-input"}`}>
                            <RadioGroupItem value="sandbox" />
                            <span className="text-sm font-medium">Sandbox (Test)</span>
                          </label>
                        </RadioGroup>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="payu-key">PayU Merchant Key *</Label>
                        <Input
                          id="payu-key"
                          name="payu-merchant-key"
                          placeholder="e.g. gtKFFx"
                          value={payuMerchantKey}
                          onChange={(e) => setPayuMerchantKey(e.target.value)}
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
                        <Label htmlFor="payu-salt">PayU Merchant Salt *</Label>
                        <Input
                          id="payu-salt"
                          name="payu-merchant-salt"
                          type="password"
                          placeholder="••••••••••••••••••••"
                          value={payuMerchantSalt}
                          onChange={(e) => setPayuMerchantSalt(e.target.value)}
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

      {/* Mobile number verification (WhatsApp OTP) — strictly opt-in */}
      {showPaymentConfig && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="h-5 w-5" /> Verify Mobile Number (WhatsApp OTP)
            </CardTitle>
            <CardDescription>
              Ask customers to confirm a 6-digit code sent on WhatsApp before they continue to
              address &amp; payment. Cuts fake numbers and undelivered parcels.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Enable OTP verification</p>
                <p className="text-xs text-muted-foreground">
                  Off by default. Nothing changes at checkout until you switch this on.
                </p>
              </div>
              <Switch checked={checkoutOtpEnabled} onCheckedChange={setCheckoutOtpEnabled} />
            </div>
            {checkoutOtpEnabled && (
              <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-foreground">
                Customers without WhatsApp on that number can't receive the code. If WhatsApp is
                temporarily unavailable, checkout continues without verification so no order is lost.
              </div>
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
              <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-foreground">
                Select an online gateway (Razorpay, Cashfree or PayU) above for partial payment to take effect at checkout.
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
                    <label className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 px-4 py-2.5 transition-[transform,opacity,colors,box-shadow] ${partialType === "percentage" ? "border-primary bg-primary/5" : "border-input"}`}>
                      <RadioGroupItem value="percentage" />
                      <Percent className="h-4 w-4" />
                      <span className="text-sm font-medium">Percentage</span>
                    </label>
                    <label className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 px-4 py-2.5 transition-[transform,opacity,colors,box-shadow] ${partialType === "fixed" ? "border-primary bg-primary/5" : "border-input"}`}>
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

      {/* Section 3b: Prepaid Discount — reward customers who pay online in full */}
      {showPaymentConfig && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <IndianRupee className="h-5 w-5" /> Prepaid Discount
            </CardTitle>
            <CardDescription>
              Give an instant discount when customers pay online in full. Not applied on Cash on Delivery or partial payment.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!onlineEnabled && (
              <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-foreground">
                Turn on an online gateway (Razorpay / Cashfree / PayU) above so the prepaid discount can be applied at checkout.
              </div>
            )}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Enable Prepaid Discount</p>
                <p className="text-xs text-muted-foreground">Encourages full online payment over COD</p>
              </div>
              <Switch checked={prepaidDiscountEnabled} onCheckedChange={setPrepaidDiscountEnabled} />
            </div>

            {prepaidDiscountEnabled && (
              <>
                <div className="space-y-2">
                  <Label className="text-sm">Discount Type</Label>
                  <RadioGroup
                    value={prepaidDiscountType}
                    onValueChange={(v) => setPrepaidDiscountType(v as "fixed" | "percentage")}
                    className="flex gap-4"
                  >
                    <label className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 px-4 py-2.5 transition-[transform,opacity,colors,box-shadow] ${prepaidDiscountType === "fixed" ? "border-primary bg-primary/5" : "border-input"}`}>
                      <RadioGroupItem value="fixed" />
                      <IndianRupee className="h-4 w-4" />
                      <span className="text-sm font-medium">Fixed ₹</span>
                    </label>
                    <label className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 px-4 py-2.5 transition-[transform,opacity,colors,box-shadow] ${prepaidDiscountType === "percentage" ? "border-primary bg-primary/5" : "border-input"}`}>
                      <RadioGroupItem value="percentage" />
                      <Percent className="h-4 w-4" />
                      <span className="text-sm font-medium">Percentage</span>
                    </label>
                  </RadioGroup>
                </div>

                <div className="space-y-1.5">
                  <Label>
                    {prepaidDiscountType === "percentage" ? "Discount Percentage (%)" : "Discount Amount (₹)"}
                  </Label>
                  <Input
                    type="number"
                    placeholder={prepaidDiscountType === "percentage" ? "e.g. 5" : "e.g. 100"}
                    value={prepaidDiscountValue}
                    onChange={(e) => setPrepaidDiscountValue(e.target.value)}
                    min={1}
                    max={prepaidDiscountType === "percentage" ? 50 : undefined}
                  />
                  <p className="text-xs text-muted-foreground">
                    {prepaidDiscountType === "percentage"
                      ? "Recommended 2–10%. Applied on the order total (after coupon)."
                      : "Flat rupees off when the customer pays online in full."}
                  </p>
                </div>

                {prepaidDiscountType === "fixed" && (
                  <div className="rounded-lg border border-input p-3 space-y-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Bigger discount for larger orders (optional)</p>
                      <p className="text-xs text-muted-foreground">
                        Replaces the base discount above once the order value crosses your threshold. Example: base ₹100 off, but ₹200 off above ₹3,000.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Applies above (₹)</Label>
                        <Input
                          type="number"
                          placeholder="e.g. 3000"
                          value={prepaidDiscountTier2Min}
                          onChange={(e) => setPrepaidDiscountTier2Min(e.target.value)}
                          min={1}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Bigger discount (₹)</Label>
                        <Input
                          type="number"
                          placeholder="e.g. 200"
                          value={prepaidDiscountTier2Value}
                          onChange={(e) => setPrepaidDiscountTier2Value(e.target.value)}
                          min={1}
                        />
                      </div>
                    </div>
                    {(prepaidDiscountTier2Min && Number(prepaidDiscountTier2Min) > 0) !== (prepaidDiscountTier2Value && Number(prepaidDiscountTier2Value) > 0) && (
                      <p className="text-xs text-warning">Set both fields to enable the bigger discount tier.</p>
                    )}
                  </div>
                )}

                {prepaidDiscountValue && Number(prepaidDiscountValue) > 0 && (
                  <div className="rounded-lg border bg-accent/30 p-3">
                    <p className="text-xs font-medium text-foreground mb-1">Preview (₹1,000 order):</p>
                    <p className="text-sm text-foreground">
                      Pay online →{" "}
                      <b>
                        ₹
                        {prepaidDiscountType === "percentage"
                          ? Math.max(0, 1000 - Math.round(1000 * Number(prepaidDiscountValue) / 100))
                          : Math.max(0, 1000 - Math.min(Number(prepaidDiscountValue), 1000))}
                      </b>{" "}
                      <span className="text-muted-foreground">(save ₹{prepaidDiscountType === "percentage"
                        ? Math.round(1000 * Number(prepaidDiscountValue) / 100)
                        : Math.min(Number(prepaidDiscountValue), 1000)})</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">COD stays at ₹1,000 — no discount.</p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Fast Checkout is now the only checkout for every store — toggle retired. */}
      {false && showPaymentConfig && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Zap className="h-5 w-5" /> Fast Checkout (Beta)
            </CardTitle>
            <CardDescription>
              One-page checkout with UPI app deeplinks (GPay, PhonePe, Paytm). Address auto-fills from pincode. Existing checkout keeps working — turn this on only when you're ready to test.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Enable Fast Checkout</p>
                <p className="text-xs text-muted-foreground">
                  You can preview safely anytime by adding <code className="rounded bg-muted px-1">?v2=1</code> to your checkout URL — no need to enable this switch.
                </p>
              </div>
              <Switch checked={checkoutV2Enabled} onCheckedChange={setCheckoutV2Enabled} />
            </div>
            {checkoutV2Enabled && (
              <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-foreground">
                Fast Checkout will be shown to <b>all</b> customers on this store. Make sure you've tested it end-to-end (place a real ₹1 order) before saving.
              </div>
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
