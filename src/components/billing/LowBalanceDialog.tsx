import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

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
            {isBlocked ? "Wallet blocked — recharge required" : "Recharge your wallet"}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            Your wallet balance is{" "}
            <span className="font-semibold text-foreground">
              {balance < 0 ? "−" : ""}₹{Math.abs(balance).toFixed(2)}
            </span>
            .{" "}
            {isBlocked ? (
              <>
                Your balance has dropped below ₹−150. Access to your store dashboard is locked
                until you recharge. You can only access the wallet page to add funds.
              </>
            ) : (
              <>
                A minimum balance of ₹{threshold} is required to keep accepting orders on your
                commission plan. Please recharge to continue.
              </>
            )}
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
