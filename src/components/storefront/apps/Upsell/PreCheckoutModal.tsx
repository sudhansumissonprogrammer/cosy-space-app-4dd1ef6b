/**
 * Pre-checkout "Wait! Add this before you checkout" modal.
 * Wraps the "Proceed to checkout" button.
 *
 * Usage:
 *   <PreCheckoutModal offers={matchedOffers} storeId={...} currency={...} onProceed={goToCheckout}>
 *     <Button>Proceed to Checkout</Button>
 *   </PreCheckoutModal>
 */
import { useState, cloneElement, isValidElement, type ReactElement } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import UpsellStrip from "./UpsellStrip";
import type { UpsellOffer } from "@/lib/appStore/upsell/types";

interface Props {
  offers: UpsellOffer[];
  storeId: string;
  currency: string;
  excludeProductIds?: string[];
  onProceed: () => void;
  children: ReactElement;
}

const SEEN_KEY = "sf_precheckout_seen";

export default function PreCheckoutModal({
  offers,
  storeId,
  currency,
  excludeProductIds = [],
  onProceed,
  children,
}: Props) {
  const [open, setOpen] = useState(false);

  const shouldShow = () => {
    if (!offers || offers.length === 0) return false;
    try {
      if (sessionStorage.getItem(SEEN_KEY)) return false;
    } catch { /* noop */ }
    return true;
  };

  const handleClick = (e: any) => {
    if (shouldShow()) {
      e?.preventDefault?.();
      e?.stopPropagation?.();
      try { sessionStorage.setItem(SEEN_KEY, "1"); } catch { /* noop */ }
      setOpen(true);
      return;
    }
    onProceed();
  };

  const trigger = isValidElement(children)
    ? cloneElement(children as any, { onClick: handleClick })
    : children;

  const offer = offers[0];

  return (
    <>
      {trigger}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{offer?.display?.title || "Wait! Add this before you checkout"}</DialogTitle>
            {offer?.display?.subtitle ? (
              <DialogDescription>{offer.display.subtitle}</DialogDescription>
            ) : null}
          </DialogHeader>

          <UpsellStrip
            storeId={storeId}
            currency={currency}
            offers={offers}
            placement="pre_checkout"
            excludeProductIds={excludeProductIds}
            embedded
          />

          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="ghost" onClick={() => { setOpen(false); onProceed(); }}>
              No thanks, continue
            </Button>
            <Button onClick={() => { setOpen(false); onProceed(); }}>
              Continue to checkout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}