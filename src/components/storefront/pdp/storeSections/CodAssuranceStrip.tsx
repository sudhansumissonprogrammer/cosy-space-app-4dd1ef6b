import { Banknote, RefreshCw, ReceiptText, Plane } from "lucide-react";

/**
 * Three-up assurance strip shown directly above the packaging selector.
 * Cream card, hairline dividers, green serif labels — matches the
 * quality-assurance grid it sits under. Dark-mode safe via [data-sf-qa].
 *
 * `codLabel` lets partial-payment stores say "Partial COD Available"
 * instead of the default "100% COD Available".
 */
interface Props {
  codLabel?: string;
  utkalAssurances?: boolean;
}

export default function CodAssuranceStrip({ codLabel = "100% COD\nAvailable", utkalAssurances = false }: Props) {
  const ITEMS = [
    { Icon: Banknote, label: utkalAssurances ? "COD\nAvailable" : codLabel },
    { Icon: RefreshCw, label: utkalAssurances ? "Exchange Only\nWithin 3 Days" : "3 Days\nReplacement" },
    { Icon: utkalAssurances ? Plane : ReceiptText, label: utkalAssurances ? "Express Air Shipping\nAvailable at Checkout" : "Refund on\nEligible Returns" },
  ];

  return (
    <section className="mt-4" data-sf-qa>
      <div className="rounded-2xl bg-[#FBF7EE] px-1 py-3 ring-1 ring-[#E7DFC9]">
        <div className="grid grid-cols-3">
          {ITEMS.map(({ Icon, label }, i) => (
            <div
              key={label}
              className={`flex flex-col items-center gap-1.5 px-1.5 text-center ${
                i > 0 ? "border-l border-[#DED6C0]" : ""
              }`}
            >
              <Icon className="h-[18px] w-[18px] text-[#3E6B4F]" strokeWidth={1.6} aria-hidden="true" />
              <p
                className="max-w-full whitespace-pre-line text-[11.5px] font-bold leading-tight text-[#12372A] sm:text-[13px]"
                style={{ fontFamily: "var(--storefront-heading-font, 'Alegreya SC'), serif" }}
              >
                {label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
