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
    title: "Compare our price",
    text: "Check the same model and quality with other sellers before you buy.",
  },
  {
    icon: Globe2,
    title: "Direct importer",
    text: "We source master-quality watches directly, including from Japan, with fewer middlemen.",
  },
  {
    icon: HandCoins,
    title: "Lowest possible margin",
    text: "A lean margin helps us offer stronger value on every watch.",
  },
  {
    icon: PackageCheck,
    title: "₹100 advance, rest on delivery",
    text: "The small advance confirms your order and reduces fake bookings. Pay the balance on delivery.",
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
            ? "max-h-[82vh] overflow-y-auto rounded-t-lg px-0 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-0 font-sans"
            : "w-full max-w-sm overflow-y-auto px-0 pt-0 font-sans sm:max-w-sm"}
        >
          <div
            className="border-b px-5 pb-4 pt-6"
            style={{
              borderColor: "color-mix(in srgb, var(--storefront-text, hsl(var(--border))) 14%, transparent)",
              backgroundColor: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 5%, var(--storefront-bg, hsl(var(--background))))",
            }}
          >
            <div
              className="mb-3 flex h-10 w-10 items-center justify-center rounded-full"
              style={{
                backgroundColor: "var(--storefront-text, hsl(var(--foreground)))",
                color: "var(--storefront-bg, hsl(var(--background)))",
              }}
            >
              <ShieldCheck className="h-[18px] w-[18px]" strokeWidth={2.1} />
            </div>
            <SheetHeader className="pr-10 text-left">
              <SheetTitle className="text-lg font-extrabold leading-snug">How we keep prices lower</SheetTitle>
              <SheetDescription className="text-xs leading-relaxed">
                Direct sourcing, low margins and fewer fake orders.
              </SheetDescription>
            </SheetHeader>
          </div>

          <div className="px-5 py-2.5">
            {PROMISES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex gap-3 border-b border-border/60 py-3 last:border-b-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                  <Icon className="h-4 w-4" strokeWidth={2} />
                </div>
                <div>
                  <h3 className="text-[13px] font-bold leading-5 text-foreground">{title}</h3>
                  <p className="mt-0.5 text-[11px] leading-[1.55] text-muted-foreground">{text}</p>
                </div>
              </div>
            ))}
          </div>

          <SheetFooter className="px-5 pt-2 sm:justify-stretch sm:space-x-0">
            <SheetClose asChild>
              <Button className="h-10 w-full text-xs font-bold">Continue shopping</Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}