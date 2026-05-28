import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface LowBalanceDialogProps {
  open: boolean;
  balance: number;
  storeSlug: string;
}

export default function LowBalanceDialog({ open, balance, storeSlug }: LowBalanceDialogProps) {
  const navigate = useNavigate();

  return (
    <AlertDialog open={open}>
      <AlertDialogContent
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="max-w-sm"
      >
        <AlertDialogHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <AlertDialogTitle className="text-center">Recharge your wallet</AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            Your wallet balance is{" "}
            <span className="font-semibold text-foreground">
              {balance < 0 ? "−" : ""}₹{Math.abs(balance).toFixed(2)}
            </span>
            . A minimum balance of ₹100 is required to keep accepting orders on your commission plan.
            Please recharge to continue.
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
