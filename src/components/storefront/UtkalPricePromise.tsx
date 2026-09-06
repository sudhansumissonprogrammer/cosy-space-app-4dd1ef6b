import { useState } from "react";
import {
  BadgeIndianRupee,
  ChevronRight,
  Globe2,
  HandCoins,
  PackageCheck,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

const PROMISES = [
  {
    icon: Scale,
    title: "Compare before you buy",
    text: "Compare the same model, quality and condition with other active sellers. Our pricing is built to stay highly competitive.",
  },
  {
    icon: Globe2,
    title: "Direct-import sourcing",
    text: "We source master-quality, 1:1-style watches through direct import channels, including Japan, and avoid unnecessary middlemen.",
  },
  {
    icon: HandCoins,
    title: "Lower margin, better price",
    text: "We keep our margin low so more of the sourcing advantage reaches you as an unbeatable-value price.",
  },
  {
    icon: PackageCheck,
    title: "₹100 advance, rest on delivery",
    text: "A ₹100 advance is mandatory to confirm intent and reduce fake orders. Pay the remaining amount by COD when your order arrives.",
  },
];

export default function UtkalPricePromise() {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  return (
    <>
      <section
        aria-label="Utkal Watches low price promise"
        className="mb-3 overflow-hidden border"
        style={{
          borderColor: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 16%, transparent)",
          backgroundColor: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 5%, var(--storefront-bg, hsl(var(--background))))",
          color: "var(--storefront-text, hsl(var(--foreground)))",
        }}
      >
        <Button
          type="button"
          variant="ghost"
          onClick={() => setOpen(true)}
          className="h-auto w-full justify-start rounded-none px-3 py-2.5 text-left hover:bg-transparent sm:px-4 sm:py-3"
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{
              backgroundColor: "var(--storefront-text, hsl(var(--foreground)))",
              color: "var(--storefront-bg, hsl(var(--background)))",
            }}
          >
            <BadgeIndianRupee className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </span>

          <span className="min-w-0 flex-1 whitespace-normal">
            <span className="flex items-center gap-2">
              <span className="text-[13px] font-extrabold leading-tight sm:text-sm">Lowest Margin Price Promise</span>
              <span
                className="hidden rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase sm:inline"
                style={{
                  backgroundColor: "var(--storefront-text, hsl(var(--foreground)))",
                  color: "var(--storefront-bg, hsl(var(--background)))",
                }}
              >
                Compare &amp; see
              </span>
            </span>
            <span className="mt-0.5 block text-[10px] font-medium leading-snug opacity-65 sm:text-xs">
              Direct importer · Low margin · ₹100 advance, rest COD
            </span>
          </span>

          <span className="ml-auto inline-flex shrink-0 items-center gap-0.5 text-[10px] font-bold sm:text-xs">
            Why?
            <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </Button>
      </section>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          className={isMobile
            ? "max-h-[88vh] overflow-y-auto rounded-t-lg px-0 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-0"
            : "w-full max-w-md overflow-y-auto px-0 pt-0 sm:max-w-md"}
        >
          <div
            className="border-b px-5 pb-5 pt-7"
            style={{
              borderColor: "color-mix(in srgb, var(--storefront-text, hsl(var(--border))) 14%, transparent)",
              backgroundColor: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 5%, var(--storefront-bg, hsl(var(--background))))",
            }}
          >
            <div
              className="mb-4 flex h-11 w-11 items-center justify-center rounded-full"
              style={{
                backgroundColor: "var(--storefront-text, hsl(var(--foreground)))",
                color: "var(--storefront-bg, hsl(var(--background)))",
              }}
            >
              <ShieldCheck className="h-5 w-5" strokeWidth={2.1} />
            </div>
            <SheetHeader className="pr-10 text-left">
              <SheetTitle className="text-xl font-extrabold leading-tight">Why our watch prices stay lower</SheetTitle>
              <SheetDescription className="text-[13px] leading-relaxed">
                Straightforward sourcing, lean margins and a small order-confirmation advance—explained clearly.
              </SheetDescription>
            </SheetHeader>
          </div>

          <div className="space-y-1 px-5 py-4">
            {PROMISES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex gap-3 border-b border-border/60 py-3.5 last:border-b-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                  <Icon className="h-4 w-4" strokeWidth={2} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">{title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mx-5 border-l-2 border-foreground/70 bg-secondary/60 px-3.5 py-3">
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              <strong className="text-foreground">Product clarity:</strong> “Master quality / 1:1-style” describes the product category and is not a claim that these are authorised brand originals.
            </p>
          </div>

          <SheetFooter className="px-5 pt-5 sm:justify-stretch sm:space-x-0">
            <SheetClose asChild>
              <Button className="w-full">Got it — show me the watches</Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}