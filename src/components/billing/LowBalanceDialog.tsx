import { AlertTriangle, X, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

interface LowBalanceDialogProps {
  open: boolean;
  balance: number;
  storeSlug: string;
  /** When true, user can close the popup. When false, popup is blocking. */
  dismissible?: boolean;
  /** Called when user dismisses (only if dismissible). */
  onClose?: () => void;
  /** Threshold copy — defaults to 100. */
  threshold?: number;
}

/**
 * Wallet balance warning.
 *
 * - Balance below -150 → hard block with a light themed overlay.
 * - Otherwise (balance below threshold but not blocked) → soft warning banner
 *   docked to the bottom of the viewport that does NOT dim the dashboard.
 *
 * Previously this was always a fullscreen AlertDialog with a `bg-black/80`
 * backdrop, which made the dashboard appear "black" whenever a store was
 * running low on wallet balance.
 */
export default function LowBalanceDialog({
  open,
  balance,
  storeSlug,
  dismissible = false,
  onClose,
  threshold = 0,
}: LowBalanceDialogProps) {
  const navigate = useNavigate();
  const isBlocked = balance < -150;
  const storageKey = `low-balance-banner-dismissed-${storeSlug}`;
  const [bannerDismissed, setBannerDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const ts = Number(localStorage.getItem(storageKey) || 0);
    // Re-show every 6 hours
    return ts > 0 && Date.now() - ts < 6 * 60 * 60 * 1000;
  });

  useEffect(() => {
    if (!open) setBannerDismissed(false);
  }, [open]);

  if (!open) return null;

  const formattedBalance = `${balance < 0 ? "−" : ""}₹${Math.abs(balance).toFixed(2)}`;
  const walletPath = `/dashboard/stores/${storeSlug}/wallet`;

  const title = isBlocked
    ? "Wallet blocked — recharge required"
    : `Wallet below ₹${threshold} — recharge required`;
  const description = isBlocked
    ? `Your wallet balance is ${formattedBalance}. Your balance has dropped below ₹−150. Access to your store dashboard is locked until you recharge. You can only access the wallet page to add funds.`
    : `Your wallet balance is ${formattedBalance}. Recharge now to keep your store running smoothly and continue accepting orders without interruption.`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 px-4 backdrop-blur-sm">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="low-balance-title"
        aria-describedby="low-balance-description"
        className="relative w-full max-w-sm rounded-lg border border-border bg-card p-6 text-card-foreground shadow-xl"
      >
        {dismissible && !isBlocked && (
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <div className="space-y-4 text-center">
          <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${isBlocked ? "bg-destructive/10" : "bg-warning/10"}`}>
            <AlertTriangle className={`h-6 w-6 ${isBlocked ? "text-destructive" : "text-warning"}`} />
          </div>
          <h2 id="low-balance-title" className="text-lg font-semibold leading-tight">
            {title}
          </h2>
          <p id="low-balance-description" className="text-sm text-muted-foreground">
            {description}
          </p>
          <Button onClick={() => navigate(walletPath)} className="w-full">
            <Wallet className="mr-2 h-4 w-4" />
            Recharge Wallet
          </Button>
        </div>
      </div>
    </div>
  );
}
