import { useState } from "react";
import {
  BadgeIndianRupee,
  ChevronRight,
  Globe2,
  HandCoins,
  ShieldCheck,
  Sparkles,
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
    icon: Globe2,
    title: "Direct sourcing",
    text: "We source our watches directly from trusted suppliers, reducing unnecessary middlemen and extra markups.",
  },
  {
    icon: Sparkles,
    title: "Quality comes first",
    text: "We don't cut quality to lower the price. Every watch is selected for its design, finish and overall quality.",
  },
  {
    icon: HandCoins,
    title: "Why ₹100 upfront?",
    text: "We offer COD, but ask for ₹100 to confirm your order.\n\nA failed COD order can cost us delivery + return shipping + advertising costs, while the watch may remain tied up for 14–15 days.\n\nThis small confirmation amount helps us reduce these losses — so we can keep our prices lower for everyone.",
  },
];

export default function UtkalPricePromise() {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  const storefrontText = "var(--storefront-text, hsl(var(--foreground)))";
  const storefrontBg = "var(--storefront-bg, hsl(var(--background)))";

  return (
    <>
      <section
        aria-label="Utkal Watches lowest price guarantee"
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
              backgroundColor: storefrontText,
              color: storefrontBg,
            }}
          >
            <BadgeIndianRupee className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </span>

          <span className="min-w-0 flex-1 whitespace-normal">
            <span className="flex items-center gap-2">
              <span className="text-[13px] font-extrabold leading-tight sm:text-sm">Lowest Price Guarantee</span>
              <span
                className="hidden rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase sm:inline"
                style={{
                  backgroundColor: storefrontText,
                  color: storefrontBg,
                }}
              >
                See why
              </span>
            </span>
            <span className="mt-0.5 block text-[10px] font-medium leading-snug opacity-65 sm:text-xs">
              Direct sourcing · Fair pricing · ₹100 advance, rest COD
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
          style={{ fontFamily: "var(--storefront-heading-font)" }}
          className={isMobile
            ? "max-h-[85vh] overflow-y-auto rounded-t-lg px-0 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-0"
            : "w-full max-w-sm overflow-y-auto px-0 pt-0 sm:max-w-sm"}
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
                backgroundColor: storefrontText,
                color: storefrontBg,
              }}
            >
              <ShieldCheck className="h-[18px] w-[18px]" strokeWidth={2.1} />
            </div>
            <SheetHeader className="pr-10 text-left">
              <SheetTitle className="text-lg font-extrabold leading-snug">How we keep our prices lower</SheetTitle>
              <SheetDescription className="text-xs leading-relaxed">
                We source directly and cut unnecessary costs — so you get better prices without compromising on quality.
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
                  <p className="mt-0.5 whitespace-pre-line text-[11px] leading-[1.55] text-muted-foreground">
                    {text}
                  </p>
                </div>
              </div>
            ))}

            <div
              className="mt-4 rounded-xl border p-4"
              style={{
                borderColor: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 14%, transparent)",
                backgroundColor: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 6%, var(--storefront-bg, hsl(var(--background))))",
              }}
            >
              <p className="text-[13px] font-extrabold leading-snug text-foreground">
                ₹100 is adjusted against your order total
              </p>
              <p
                className="mt-1 inline-block rounded px-1.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 12%, transparent)",
                  color: "var(--storefront-text, hsl(var(--foreground)))",
                }}
              >
                It's NOT an extra charge.
              </p>
              <p className="mt-2 text-[11px] leading-[1.55] text-muted-foreground">
                Pay the remaining amount when your watch is delivered.
              </p>
            </div>
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
