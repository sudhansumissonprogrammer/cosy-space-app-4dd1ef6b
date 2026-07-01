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
  threshold = 100,
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

  // Hard block: blocking modal, but never a black backdrop.
  if (isBlocked) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 px-4 backdrop-blur-sm">
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="low-balance-title"
          aria-describedby="low-balance-description"
          className="relative w-full max-w-sm rounded-lg border border-border bg-card p-6 text-card-foreground shadow-xl"
        >
          {dismissible && (
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <h2 id="low-balance-title" className="text-lg font-semibold leading-tight">
              Wallet blocked — recharge required
            </h2>
            <p id="low-balance-description" className="text-sm text-muted-foreground">
              Your wallet balance is{" "}
              <span className="font-semibold text-foreground">{formattedBalance}</span>
              . Your balance has dropped below ₹−150. Access to your store dashboard is locked
              until you recharge. You can only access the wallet page to add funds.
            </p>
            <Button onClick={() => navigate(walletPath)} className="w-full">
              Recharge Wallet
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Soft warning: non-blocking bottom banner. No dark backdrop.
  if (bannerDismissed) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-16 z-40 flex justify-center px-3 sm:bottom-4">
      <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-lg border border-warning/30 bg-card px-3 py-2.5 text-card-foreground shadow-lg ring-1 ring-warning/10">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning/10">
          <Wallet className="h-4 w-4 text-warning" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-foreground">
            Wallet below ₹{threshold} · {formattedBalance}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            Recharge now to keep accepting orders.
          </p>
        </div>
        <button
          onClick={() => navigate(walletPath)}
          className="shrink-0 rounded-lg bg-warning px-3 py-1.5 text-[11px] font-bold text-warning-foreground shadow-sm transition active:scale-95 hover:opacity-90"
        >
          Recharge
        </button>
        {dismissible && (
          <button
            onClick={() => {
              setBannerDismissed(true);
              try { localStorage.setItem(storageKey, String(Date.now())); } catch {}
              onClose?.();
            }}
            aria-label="Dismiss"
            className="shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
