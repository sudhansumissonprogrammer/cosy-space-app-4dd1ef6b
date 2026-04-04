import { useState } from "react";
import { Package } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface OrderItemImageProps {
  imageUrl?: string | null;
  productName: string;
}

export default function OrderItemImage({ imageUrl, productName }: OrderItemImageProps) {
  const [open, setOpen] = useState(false);

  if (!imageUrl) {
    return (
      <div className="h-20 w-20 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <Package className="h-6 w-6 text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <img
        src={imageUrl}
        alt={productName}
        onClick={() => setOpen(true)}
        className="h-20 w-20 rounded-lg object-cover shrink-0 border cursor-pointer hover:opacity-90 transition-opacity"
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-2 flex items-center justify-center bg-background/95 border-none shadow-xl">
          <img
            src={imageUrl}
            alt={productName}
            className="max-w-full max-h-[85vh] rounded-lg object-contain"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
