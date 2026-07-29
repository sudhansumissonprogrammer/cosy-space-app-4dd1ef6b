interface Props {
  /** e.g. "FLAT ₹100 OFF" — hidden when no auto-apply coupon exists. */
  flatOffLabel?: string | null;
  heading?: string;
}

/**
 * Lime "STEAL DEALS" tag + heading above the side-cart upsell carousels.
 */
export default function CartStealDealsHeader({ flatOffLabel, heading = "Complete your set" }: Props) {
  return (
    <div className="mt-3 flex items-center gap-2">
      <span className="relative inline-flex -skew-x-6 items-center rounded-md bg-[hsl(75_85%_58%)] px-2.5 py-1 shadow-[3px_3px_0_0_rgba(0,0,0,0.9)]">
        <span className="skew-x-6 text-[10.5px] font-black italic tracking-tight text-black">STEAL DEALS</span>
      </span>
      <span
        className="truncate text-[13px] font-bold"
        style={{ color: "var(--storefront-text, inherit)" }}
      >
        {heading}
      </span>
      {flatOffLabel && (
        <span className="ml-auto shrink-0 rounded-full bg-red-600 px-2 py-[2px] text-[9.5px] font-extrabold text-white">
          {flatOffLabel}
        </span>
      )}
    </div>
  );
}
