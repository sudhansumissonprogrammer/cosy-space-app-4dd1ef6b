import goldIcon from "@/assets/qa/goldplated.webp.asset.json";
import antitarnishIcon from "@/assets/qa/antitarnish.webp.asset.json";
import skinIcon from "@/assets/qa/skinfriendly.webp.asset.json";
import waterIcon from "@/assets/qa/water.webp.asset.json";
import qualityIcon from "@/assets/qa/quality.webp.asset.json";
import realphotoIcon from "@/assets/qa/realphoto.webp.asset.json";
import { ShieldCheck, Gem, Heart } from "lucide-react";

/**
 * Gold-plated / imitation jewellery variant of the quality-assurance grid.
 * Same premium layout as the watch stores, copy tuned for plated jewellery.
 * Icons are tiny (<7KB) lazy-loaded webp sprites — no measurable load cost.
 */

const ITEMS = [
  { icon: goldIcon.url, title: "Premium Gold Plated Finish", sub: "Rich, jeweller-grade gold polish" },
  { icon: antitarnishIcon.url, title: "Anti-Tarnish Coating", sub: "Shine that stays wear after wear" },
  { icon: skinIcon.url, title: "Skin Friendly & Nickel Free", sub: "Gentle even on sensitive skin" },
  { icon: waterIcon.url, title: "Daily Wear Friendly", sub: "Safe from sweat and light splashes" },
  { icon: qualityIcon.url, title: "Quality Checked Before Dispatch", sub: "Every piece is carefully inspected" },
  { icon: realphotoIcon.url, title: "Real Product Images", sub: "What you see is what you get" },
];

const STRIP = [
  { Icon: ShieldCheck, label: "Trusted Quality" },
  { Icon: Gem, label: "Built to Last" },
  { Icon: Heart, label: "Customer First" },
];

export default function JewelleryAssuranceGrid() {
  return (
    <section
      className="mt-5 -mx-4 sm:mx-0"
      data-sf-qa
      style={{ contentVisibility: "auto", containIntrinsicSize: "auto 420px" } as React.CSSProperties}
    >
      <div className="rounded-2xl bg-[#FBF7EE] p-2 sm:p-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
          {ITEMS.map(({ icon, title, sub }) => (
            <div
              key={title}
              className="flex flex-col items-center rounded-xl bg-white/90 px-2 py-3 text-center shadow-[0_1px_3px_rgba(20,40,30,0.06)] ring-1 ring-[#E7DFC9]"
            >
              <img
                src={icon}
                alt=""
                width={44}
                height={44}
                loading="lazy"
                decoding="async"
                className="h-12 w-12 object-contain sm:h-14 sm:w-14"
              />

              {/* Gold divider with diamond */}
              <span className="mt-1.5 flex items-center gap-1" aria-hidden="true">
                <span className="h-px w-5 bg-gradient-to-r from-transparent to-[#D9BE6A]" />
                <span className="h-1 w-1 rotate-45 bg-[#C9A227]" />
                <span className="h-px w-5 bg-gradient-to-l from-transparent to-[#D9BE6A]" />
              </span>

              <h3
                className="mt-1.5 text-[11px] font-bold uppercase leading-tight tracking-wide text-[#12372A] sm:text-[13px]"
                style={{ fontFamily: "var(--storefront-heading-font, 'Alegreya SC'), serif" }}
              >
                {title}
              </h3>
              <p className="mt-0.5 text-[10px] leading-snug text-[#5D6B62] sm:text-[11px]">{sub}</p>
            </div>
          ))}
        </div>

        {/* Dark trust strip — always one line */}
        <div
          className="mt-2 flex w-full items-center justify-between gap-1 rounded-xl px-2.5 py-2.5 sm:mt-3 sm:justify-center sm:gap-6 sm:py-3"
          style={{ background: "linear-gradient(90deg,#12372A 0%,#1B4A37 50%,#12372A 100%)" }}
        >
          {STRIP.map(({ Icon, label }, i) => (
            <div key={label} className="flex min-w-0 items-center">
              {i > 0 && <span className="mr-1.5 h-3.5 w-px shrink-0 bg-white/25 sm:mr-6" aria-hidden="true" />}
              <span className="flex items-center gap-1 whitespace-nowrap">
                <Icon className="h-3 w-3 shrink-0 text-[#E3C463] sm:h-4 sm:w-4" strokeWidth={2} aria-hidden="true" />
                <span className="text-[9px] font-semibold uppercase tracking-[0.06em] text-white sm:text-xs sm:tracking-[0.14em]">
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
