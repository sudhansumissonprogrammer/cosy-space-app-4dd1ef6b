import { Truck, Gem, ShieldCheck } from "lucide-react";

export default function TrustBadges() {
  const badges = [
    { icon: Truck, label: "Free Shipping", desc: "On orders above ₹999" },
    { icon: Gem, label: "Exclusive Designs", desc: "Limited edition drops" },
    { icon: ShieldCheck, label: "Premium Quality", desc: "Handpicked fabrics" },
  ];
  return (
    <section className="py-10 px-4 border-t">
      <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
        {badges.map((b, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <b.icon className="h-8 w-8" style={{ color: "var(--storefront-primary, #1B3A2D)" }} />
            <p className="font-semibold text-sm text-gray-800">{b.label}</p>
            <p className="text-xs text-gray-500">{b.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
