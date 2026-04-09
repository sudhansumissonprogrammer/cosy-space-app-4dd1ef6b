import { Truck, Gem, ShieldCheck } from "lucide-react";

export default function TrustBadges() {
  const badges = [
    { icon: Truck, label: "Free Shipping", desc: "On orders above ₹999" },
    { icon: Gem, label: "Exclusive Designs", desc: "Limited edition drops" },
    { icon: ShieldCheck, label: "Premium Quality", desc: "Handpicked fabrics" },
  ];
  return (
    <section style={{ padding: "40px 15px", borderTop: "1px solid var(--v17-border, #e8e8e3)" }}>
      <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
        {badges.map((b, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <b.icon style={{ width: "32px", height: "32px", color: "var(--v17-primary, #2B4C3F)" }} />
            <p style={{ fontWeight: 600, fontSize: "14px", color: "var(--v17-text, #1a1a1a)", fontFamily: "var(--v17-body-font, 'Jost', sans-serif)" }}>{b.label}</p>
            <p style={{ fontSize: "12px", color: "var(--v17-text-muted, #666)", fontFamily: "var(--v17-body-font, 'Jost', sans-serif)" }}>{b.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
