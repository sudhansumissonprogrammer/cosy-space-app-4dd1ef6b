import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, X, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

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
 * - Balance below -150 → hard block (modal, cannot dismiss).
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

  // Hard block: keep the blocking modal.
  if (isBlocked) {
    return (
      <AlertDialog open={open}>
        <AlertDialogContent
          onEscapeKeyDown={(e) => {
            if (!dismissible) e.preventDefault();
          }}
          className="max-w-sm relative"
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
          <AlertDialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <AlertDialogTitle className="text-center">
              Wallet blocked — recharge required
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Your wallet balance is{" "}
              <span className="font-semibold text-foreground">
                {balance < 0 ? "−" : ""}₹{Math.abs(balance).toFixed(2)}
              </span>
              . Your balance has dropped below ₹−150. Access to your store dashboard is locked
              until you recharge. You can only access the wallet page to add funds.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => navigate(`/dashboard/stores/${storeSlug}/wallet`)}
              className="w-full"
            >
              Recharge Wallet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // Soft warning: non-blocking bottom banner. No dark backdrop.
  if (bannerDismissed) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-16 z-40 flex justify-center px-3 sm:bottom-4">
      <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-amber-300/60 bg-amber-50 px-3 py-2.5 shadow-lg dark:border-amber-500/30 dark:bg-amber-950/60">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/60">
          <Wallet className="h-4.5 w-4.5 text-amber-700 dark:text-amber-300" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-amber-900 dark:text-amber-100">
            Low wallet balance · ₹{balance.toFixed(2)}
          </p>
          <p className="truncate text-[11px] text-amber-800/80 dark:text-amber-200/80">
            Recharge to keep accepting orders (min ₹{threshold}).
          </p>
        </div>
        <button
          onClick={() => navigate(`/dashboard/stores/${storeSlug}/wallet`)}
          className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm hover:bg-amber-700 active:scale-95 transition"
        >
          Recharge
        </button>
        <button
          onClick={() => {
            setBannerDismissed(true);
            try { localStorage.setItem(storageKey, String(Date.now())); } catch {}
          }}
          aria-label="Dismiss"
          className="shrink-0 rounded-full p-1 text-amber-800/70 hover:bg-amber-100 hover:text-amber-900 dark:text-amber-200/70 dark:hover:bg-amber-900/60"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
