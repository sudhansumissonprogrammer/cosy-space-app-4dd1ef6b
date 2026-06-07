/**
 * WarrantyBadge — Gold "Gold Polished · 5 Year Colour Warranty" pill
 * shown as an overlay on product images when the store enables it via theme
 * settings. Visual reference: zilmor.com — black/gold metallic pill.
 */
interface Props {
  size?: "sm" | "md";
  className?: string;
}

export default function WarrantyBadge({ size = "md", className = "" }: Props) {
  const isSm = size === "sm";
  return (
    <div
      className={`pointer-events-none select-none inline-flex items-stretch overflow-hidden ${
        isSm ? "h-[16px]" : "h-[26px]"
      } rounded-[3px] shadow-[0_1px_4px_rgba(0,0,0,0.3)] ${className}`}
      style={{
        background: "linear-gradient(180deg, #1a1a1a 0%, #0a0a0a 100%)",
        border: "1px solid rgba(212,175,55,0.55)",
      }}
      aria-hidden="true"
    >
      {/* Gold metallic block: Gold Polished */}
      <div
        className={`flex items-center justify-center ${isSm ? "px-1" : "px-1.5"}`}
        style={{
          background:
            "linear-gradient(180deg, #f7e08a 0%, #d4af37 45%, #b8860b 100%)",
          color: "#2a1f00",
          textShadow: "0 1px 0 rgba(255,255,255,0.35)",
        }}
      >
        <span
          className={`font-extrabold leading-none tracking-tight ${
            isSm ? "text-[7px]" : "text-[10px]"
          }`}
        >
          GOLD POLISHED
        </span>
      </div>

      {/* Dark block: 5 Year Colour Warranty */}
      <div
        className={`flex flex-col items-start justify-center ${
          isSm ? "px-1" : "px-1.5"
        }`}
      >
        <span
          className={`leading-none font-medium ${
            isSm ? "text-[5px]" : "text-[8px]"
          }`}
          style={{ color: "#e6c97a" }}
        >
          5 Year Colour
        </span>
        <span
          className={`leading-none font-extrabold italic ${
            isSm ? "text-[7px]" : "text-[11px]"
          }`}
          style={{
            background:
              "linear-gradient(180deg, #fff1b0 0%, #d4af37 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          warranty
        </span>
      </div>
    </div>
  );
}
