import { MapPin } from "lucide-react";

const cities = [
  { name: "Bhubaneswar", sellers: "6" },
  { name: "Rajasthan", sellers: "3" },
  { name: "Mumbai", sellers: "2" },
  { name: "Bangalore", sellers: "2" },
  { name: "Jaipur", sellers: "1" },
];

const CitiesGrid = () => {
  return (
    <section className="border-b-4 border-foreground py-12 sm:py-16 lg:py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <span className="font-bold uppercase tracking-widest text-xs text-muted-foreground mb-2 block">Pan India</span>
          <h2 className="font-black uppercase text-3xl sm:text-4xl lg:text-5xl tracking-tighter leading-[0.9] text-foreground">
            Sellers Across<br /><span className="text-bauhaus-blue">India</span>
          </h2>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {cities.map((c, i) => (
            <div key={c.name} className="bg-bauhaus-white border-2 lg:border-4 border-foreground shadow-bauhaus p-4 text-center hover:-translate-y-1 transition-transform duration-200">
              <MapPin className={`h-6 w-6 mx-auto mb-2 ${i % 3 === 0 ? "text-bauhaus-red" : i % 3 === 1 ? "text-bauhaus-blue" : "text-bauhaus-yellow"}`} />
              <div className="font-bold uppercase tracking-wider text-sm text-foreground">{c.name}</div>
              <div className="font-black text-xl text-foreground">{c.sellers}</div>
              <div className="font-medium text-xs text-muted-foreground">sellers</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CitiesGrid;
