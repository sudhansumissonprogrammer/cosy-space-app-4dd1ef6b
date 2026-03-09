export default function StorefrontMarquee() {
  const items = [
    { icon: "🚚", text: "FREE DELIVERY" },
    { icon: "👜", text: "PREMIUM QUALITY" },
  ];

  return (
    <div className="overflow-hidden bg-[#1a1a2e] py-2">
      <div className="flex animate-marquee whitespace-nowrap">
        {/* First set */}
        {items.map((item, idx) => (
          <div key={`set1-${idx}`} className="mx-8 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[hsl(40_70%_55%)]">
            <span>{item.icon}</span>
            <span>{item.text}</span>
            <span className="mx-4 text-[hsl(40_70%_55%)]">◆</span>
          </div>
        ))}
        {/* Second set (duplicate for seamless loop) */}
        {items.map((item, idx) => (
          <div key={`set2-${idx}`} className="mx-8 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[hsl(40_70%_55%)]">
            <span>{item.icon}</span>
            <span>{item.text}</span>
            <span className="mx-4 text-[hsl(40_70%_55%)]">◆</span>
          </div>
        ))}
      </div>
    </div>
  );
}
