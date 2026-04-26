import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AlertTriangle, Clock, X } from "lucide-react";
import { useState, useEffect } from "react";
import { useBillingState } from "@/hooks/useBillingState";

export default function BillingBanner() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {
    setDismissed(sessionStorage.getItem("billing-banner-dismissed"));
  }, []);

  const { data: storeId } = useQuery({
    queryKey: ["my-store-id-banner", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("stores").select("id").eq("owner_id", user!.id).limit(1).maybeSingle();
      return data?.id || null;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const { data: state } = useBillingState(storeId);

  if (!state) return null;
  if (state.is_free_lifetime || state.is_one_time) return null;
  if (state.billing_status === "active") return null;
  if (!state.requires_payment && state.billing_status !== "trialing") return null;

  // Show trial banner only in last 3 days
  if (state.billing_status === "trialing" && (state.days_until_action ?? 99) > 3) return null;

  const key = `${state.billing_status}-${state.days_until_action}`;
  if (dismissed === key && state.billing_status === "trialing") return null;

  const isUrgent = state.billing_status === "past_due" || state.billing_status === "suspended";
  const days = state.days_until_action ?? 0;

  let message = "";
  if (state.billing_status === "suspended") {
    message = "Your store is suspended. Pay now to reactivate.";
  } else if (state.billing_status === "past_due") {
    message = `Payment due — ${days} day${days === 1 ? "" : "s"} grace remaining before suspension.`;
  } else if (state.billing_status === "trialing") {
    message = `Free trial ends in ${days} day${days === 1 ? "" : "s"}. Pay to continue.`;
  }

  return (
    <div className={`flex items-center gap-2 px-4 py-2 text-sm ${isUrgent ? "bg-destructive/10 text-destructive border-b border-destructive/30" : "bg-amber-500/10 text-amber-700 dark:text-amber-500 border-b border-amber-500/30"}`}>
      {isUrgent ? <AlertTriangle className="h-4 w-4 flex-shrink-0" /> : <Clock className="h-4 w-4 flex-shrink-0" />}
      <span className="flex-1">{message}</span>
      <Link to="/dashboard/settings/account" className="font-medium underline underline-offset-2">
        Pay Now
      </Link>
      {!isUrgent && (
        <button
          onClick={() => {
            sessionStorage.setItem("billing-banner-dismissed", key);
            setDismissed(key);
          }}
          className="ml-1 opacity-60 hover:opacity-100"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
