const DEFAULT_TEXT = "🚚 Free Delivery • 🔄 Easy Returns • 🔒 Secure Payments • 💰 Cash On Delivery • 👜 Premium Quality";

interface Props {
  text?: string;
}

export default function StorefrontMarquee({ text }: Props) {
  const displayText = text || DEFAULT_TEXT;
  const segments = displayText.split(" • ").filter(Boolean);

  const Group = ({ prefix }: { prefix: string }) => (
    <div className="flex items-center gap-[35px] pr-[35px] md:gap-[60px] md:pr-[60px]">
      {segments.map((segment, idx) => (
        <span key={`${prefix}-${idx}`} className="flex items-center gap-2 whitespace-nowrap">
          <span>{segment.trim()}</span>
          {idx < segments.length - 1 && <span className="text-black/70">•</span>}
        </span>
      ))}
    </div>
  );

  return (
    <div
      className="w-full overflow-hidden py-2.5 text-[13px] md:text-[15px] font-medium"
      style={{
        background: "var(--storefront-marquee-gradient, linear-gradient(90deg, #004643, #02615C, #004643))",
        color: "var(--storefront-marquee-text-color, #ffffff)",
        fontVariant: "small-caps",
        height: 38,
        contain: "layout style",
      }}
      role="marquee"
      aria-label="Store announcements"
    >
      <div className="flex w-max animate-marquee hover:[animation-play-state:paused]">
        <Group prefix="a" />
        <Group prefix="b" />
      </div>
    </div>
  );
}
