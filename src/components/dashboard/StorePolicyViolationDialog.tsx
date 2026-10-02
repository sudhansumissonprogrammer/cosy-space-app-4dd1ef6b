import { AlertTriangle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface StorePolicyViolationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function StorePolicyViolationDialog({
  open,
  onOpenChange,
}: StorePolicyViolationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-destructive/40 p-0 overflow-hidden">
        <div className="border-b border-destructive/20 bg-destructive/10 px-6 py-5">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <DialogHeader className="text-left">
            <DialogTitle className="text-xl leading-snug text-destructive">
              ShopBanao policy violation
            </DialogTitle>
            <DialogDescription className="text-sm font-medium text-foreground">
              Your website is scheduled for permanent suspension.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-3 px-6 text-sm leading-6 text-muted-foreground">
          <p>
            We found product listings that violate ShopBanao&apos;s policy against misleading
            product images or showing one product and sending another.
          </p>
          <p className="font-semibold text-foreground">
            Your website may go down in 5 hours. If you are running ads, turn them off now.
          </p>
        </div>

        <DialogFooter className="gap-2 px-6 pb-6 sm:justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button asChild variant="destructive">
            <a href="/terms-and-conditions" target="_blank" rel="noreferrer">
              Read Terms &amp; Conditions
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}