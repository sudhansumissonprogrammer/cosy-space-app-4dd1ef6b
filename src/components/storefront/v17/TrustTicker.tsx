export default function TrustTicker() {
  const items = [
    "✦ Premium Fabric",
    "✦ Exclusive Seasonal Picks",
    "✦ Limited Quantity",
    "✦ Everyday Comfort",
    "✦ Oversized Fits",
    "✦ No Restocks",
  ];

  return (
    <div className="overflow-hidden" style={{ backgroundColor: "var(--v17-primary, #2B4C3F)", padding: "18px 0" }}>
      <div className="flex whitespace-nowrap animate-[marquee_20s_linear_infinite]">
        {[...items, ...items].map((text, i) => (
          <span
            key={i}
            style={{
              margin: "0 32px",
              fontSize: "15px",
              fontWeight: 400,
              letterSpacing: "0.05em",
              color: "var(--v17-bg, var(--storefront-bg, #fff))",
              fontFamily: "var(--v17-body-font, 'Jost', sans-serif)",
            }}
          >
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}
