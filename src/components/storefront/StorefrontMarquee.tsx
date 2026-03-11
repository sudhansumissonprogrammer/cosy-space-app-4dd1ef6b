export default function StorefrontMarquee() {
  const items = [
    { icon: "🚚", text: "Free Delivery" },
    { icon: "🔄", text: "Easy Returns" },
    { icon: "🔒", text: "Secure Payment Gateway" },
    { icon: "💰", text: "Cash On Delivery Available" },
    { icon: "👜", text: "Premium Quality" },
  ];

  const separator = <span className="text-black/70">•</span>;

  const Group = ({ prefix }: { prefix: string }) => (
    <div className="flex items-center gap-[35px] pr-[35px] md:gap-[60px] md:pr-[60px]">
      {items.map((item, idx) => (
        <span key={`${prefix}-${idx}`} className="flex items-center gap-2 whitespace-nowrap">
          <span className="inline-flex items-center gap-2">
            <span>{item.icon}</span>
            <span>{item.text}</span>
          </span>
          {idx < items.length - 1 && separator}
        </span>
      ))}
    </div>
  );

  return (
    <div
      className="w-full overflow-hidden py-2.5 text-[13px] md:text-[15px] font-medium font-sans"
      style={{
        background: "var(--storefront-marquee-gradient, linear-gradient(90deg, #b8873c, #f1d78a, #d1a24a))",
        color: "var(--storefront-text, #000000)",
        fontVariant: "small-caps",
      }}
    >
      <div className="flex w-max animate-marquee hover:[animation-play-state:paused]">
        <Group prefix="a" />
        <Group prefix="b" />
      </div>
    </div>
  );
}
