import { Store, Clock, ThumbsUp, MapPin } from "lucide-react";

const results = [
  { icon: Store, value: "10+", label: "Stores Built", color: "bg-bauhaus-red", textColor: "text-primary-foreground" },
  { icon: Clock, value: "48hr", label: "Average Delivery", color: "bg-bauhaus-blue", textColor: "text-primary-foreground" },
  { icon: ThumbsUp, value: "100%", label: "Client Satisfaction", color: "bg-bauhaus-yellow", textColor: "text-foreground" },
  { icon: MapPin, value: "5+", label: "Cities Served", color: "bg-bauhaus-white", textColor: "text-foreground" },
];

const ClientResults = () => {
  return (
    <section className="border-b-4 border-foreground bg-bauhaus-canvas py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <span className="inline-block font-bold uppercase tracking-widest text-xs text-primary-foreground bg-bauhaus-red border-2 border-foreground px-4 py-1.5 shadow-bauhaus-sm mb-4">
            Results
          </span>
          <h2 className="font-black uppercase text-3xl sm:text-4xl lg:text-5xl tracking-tighter leading-[0.9] text-foreground">
            Our Track Record
          </h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {results.map((r) => (
            <div
              key={r.label}
              className={`${r.color} border-2 lg:border-4 border-foreground shadow-bauhaus p-5 sm:p-6 lg:p-8 text-center`}
            >
              <r.icon className={`h-7 w-7 mx-auto mb-3 ${r.textColor}`} strokeWidth={2.5} />
              <div className={`text-3xl sm:text-4xl lg:text-5xl font-black ${r.textColor} mb-1`}>
                {r.value}
              </div>
              <div className={`text-[10px] sm:text-xs font-bold uppercase tracking-widest ${r.textColor} opacity-80`}>
                {r.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ClientResults;
