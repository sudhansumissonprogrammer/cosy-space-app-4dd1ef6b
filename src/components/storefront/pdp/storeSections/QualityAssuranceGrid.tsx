import { ShieldCheck, Droplets, Sparkles, CalendarCheck, PackageCheck, Camera, Gem, Heart } from "lucide-react";

/**
 * Premium gold "quality assurance" grid shown under the PDP price.
 * Pure code (no images) — gold gradient icon medallions, serif titles,
 * and a dark trust strip at the bottom.
 */

const GOLD = "linear-gradient(145deg,#F3E3A6 0%,#D9B softly)";

const ITEMS = [
  { Icon: ShieldCheck, title: "Premium Stainless Steel Build", sub: "High quality steel that's made to last" },
  { Icon: Droplets, title: "Water Resistant", sub: "Wear it worry-free, rain or shine" },
  { Icon: Sparkles, title: "Scratch Resistant Finish", sub: "Keeps your jewellery flawless every day" },
  { Icon: CalendarCheck, title: "6 Months Warranty", sub: "Guaranteed quality you can trust" },
  { Icon: PackageCheck, title: "Quality Checked Before Dispatch", sub: "Every piece is carefully inspected for perfection" },
  { Icon: Camera, title: "Real Product Images", sub: "What you see is what you get" },
];

const STRIP = [
  { Icon: ShieldCheck, label: "Trusted Quality" },
  { Icon: Gem, label: "Built to Last" },
  { Icon: Heart, label: "Customer First" },
];

export default function QualityAssuranceGrid() {
  return (
    <section className="mt-5">
      <div className="rounded-2xl bg-[#FBF7EE] p-2.5 sm:p-4">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4">
          {ITEMS.map(({ Icon, title, sub }) => (
            <div
              key={title}
              className="flex flex-col items-center rounded-xl bg-white/85 px-2.5 py-4 text-center shadow-[0_1px_3px_rgba(20,40,30,0.06)] ring-1 ring-[#E7DFC9]"
            >
              {/* Gold medallion */}
              <span
                className="relative flex h-12 w-12 items-center justify-center rounded-full sm:h-14 sm:w-14"
                style={{
                  background: "linear-gradient(145deg,#F7EBBE 0%,#E3C463 45%,#C9A227 100%)",
                  boxShadow: "inset 0 1px 2px rgba(255,255,255,.85), 0 3px 8px rgba(201,162,39,.28)",
                }}
              >
                <Icon className="h-6 w-6 sm:h-7 sm:w-7 text-white" strokeWidth={1.9} aria-hidden="true" />
              </span>

              {/* Gold divider with diamond */}
              <span className="mt-3 flex items-center gap-1.5" aria-hidden="true">
                <span className="h-px w-6 bg-gradient-to-r from-transparent to-[#D9BE6A]" />
                <span className="h-1.5 w-1.5 rotate-45 bg-[#C9A227]" />
                <span className="h-px w-6 bg-gradient-to-l from-transparent to-[#D9BE6A]" />
              </span>

              <h3
                className="mt-2 text-[12px] font-bold uppercase leading-tight tracking-wide text-[#12372A] sm:text-sm"
                style={{ fontFamily: "var(--storefront-heading-font, 'Alegreya SC'), serif" }}
              >
                {title}
              </h3>
              <p className="mt-1 text-[11px] leading-snug text-[#5D6B62] sm:text-xs">{sub}</p>
            </div>
          ))}
        </div>

        {/* Dark trust strip */}
        <div
          className="mt-2.5 flex items-center justify-center gap-2 rounded-xl px-2 py-3 sm:mt-4 sm:gap-6 sm:py-3.5"
          style={{ background: "linear-gradient(90deg,#12372A 0%,#1B4A37 50%,#12372A 100%)" }}
        >
          {STRIP.map(({ Icon, label }, i) => (
            <div key={label} className="flex items-center">
              {i > 0 && <span className="mr-2 h-4 w-px bg-white/25 sm:mr-6" aria-hidden="true" />}
              <span className="flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5 text-[#E3C463] sm:h-4 sm:w-4" strokeWidth={2} aria-hidden="true" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white sm:text-xs sm:tracking-[0.14em]">
                  {label}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
