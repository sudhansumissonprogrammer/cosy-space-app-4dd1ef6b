import { AlertTriangle, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface LowBalanceDialogProps {
  open: boolean;
  balance: number;
  storeSlug: string;
  /** Unused — popup is always blocking. Kept for API compatibility. */
  dismissible?: boolean;
  onClose?: () => void;
  threshold?: number;
}

/**
 * Wallet balance warning.
 *
 * Triggered from DashboardLayout when balance ≤ −20. Always blocking:
 * the merchant can only reach /wallet (to recharge) and /settings.
 */
export default function LowBalanceDialog({
  open,
  balance,
  storeSlug,
}: LowBalanceDialogProps) {
  const navigate = useNavigate();

  if (!open) return null;

  const formattedBalance = `${balance < 0 ? "−" : ""}₹${Math.abs(balance).toFixed(2)}`;
  const walletPath = `/dashboard/stores/${storeSlug}/wallet`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 px-4 backdrop-blur-sm">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="low-balance-title"
        aria-describedby="low-balance-description"
        className="relative w-full max-w-sm rounded-lg border border-border bg-card p-6 text-card-foreground shadow-xl"
      >
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <h2 id="low-balance-title" className="text-lg font-semibold leading-tight">
            Wallet balance low — recharge required
          </h2>
          <p id="low-balance-description" className="text-sm text-muted-foreground">
            Your wallet balance is {formattedBalance}. Access to your store dashboard is locked until you recharge. You can only access the wallet page to add funds.
          </p>
          <Button onClick={() => navigate(walletPath)} className="w-full">
            <Wallet className="mr-2 h-4 w-4" />
            Recharge Wallet
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate("/dashboard/stores")}
          >
            Switch store
          </Button>
        </div>
      </div>
    </div>
  );
}
