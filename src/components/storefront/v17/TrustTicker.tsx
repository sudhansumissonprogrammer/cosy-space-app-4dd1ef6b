export default function TrustTicker() {
  const items = [
    "✦ Premium Fabric",
    "✦ Exclusive Seasonal Picks",
    "✦ Limited Quantity",
    "✦ Premium Fabric",
    "✦ Exclusive Seasonal Picks",
    "✦ Limited Quantity",
  ];

  return (
    <div className="overflow-hidden py-5" style={{ backgroundColor: "var(--storefront-primary, #1B3A2D)" }}>
      <div className="flex whitespace-nowrap animate-[marquee_20s_linear_infinite]">
        {[...items, ...items].map((text, i) => (
          <span key={i} className="mx-8 text-lg font-medium tracking-wide text-white">
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}
