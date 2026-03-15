import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Share2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { ROOT_DOMAIN } from "@/lib/subdomain";

interface ShareStoreDialogProps {
  storeSlug: string;
  storeName: string;
  trigger?: React.ReactNode;
  iconOnly?: boolean;
}

export default function ShareStoreDialog({ storeSlug, storeName, trigger, iconOnly }: ShareStoreDialogProps) {
  const [copied, setCopied] = useState(false);
  const storeUrl = `https://${storeSlug}.${ROOT_DOMAIN}`;
  // Share URL goes through edge function so social crawlers can read OG tags without Cloudflare blocking
  const shareUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/share-page?slug=${encodeURIComponent(storeSlug)}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(storeUrl)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: storeName, url: storeUrl });
      } catch { /* cancelled */ }
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          iconOnly ? (
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Share2 className="h-4 w-4" />
            </Button>
          ) : (
            <Button variant="outline" size="sm">
              <Share2 className="mr-1 h-3 w-3" /> Share
            </Button>
          )
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share {storeName}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          <img
            src={qrUrl}
            alt="QR Code"
            className="h-48 w-48 rounded-lg border bg-white p-2"
            loading="lazy"
          />
          <div className="flex w-full gap-2">
            <Input value={storeUrl} readOnly className="text-sm" />
            <Button size="icon" variant="outline" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          {typeof navigator.share === "function" && (
            <Button variant="secondary" className="w-full" onClick={handleNativeShare}>
              <Share2 className="mr-2 h-4 w-4" /> Share via device
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
