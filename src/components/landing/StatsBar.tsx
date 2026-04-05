const stats = [
  { number: "15+", label: "Sellers Onboarded", shape: "circle" },
  { number: "15", label: "Active Stores", shape: "square" },
  { number: "120+", label: "Orders Processed", shape: "diamond" },
];

const StatsBar = () => {
  return (
    <section className="bg-bauhaus-yellow border-b-4 border-foreground py-12 sm:py-16 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-foreground border-2 sm:border-4 border-foreground bg-bauhaus-white">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col items-center justify-center py-8 px-4">
              <div className={`w-16 h-16 flex items-center justify-center border-4 border-foreground mb-4 ${
                s.shape === "circle" ? "rounded-full bg-bauhaus-red" : s.shape === "diamond" ? "rotate-45 bg-bauhaus-blue" : "bg-bauhaus-yellow"
              }`}>
                <span className={`font-black text-2xl ${s.shape === "diamond" ? "-rotate-45" : ""} ${s.shape === "yellow" ? "text-foreground" : "text-primary-foreground"} ${s.shape === "square" ? "text-foreground" : ""}`}>
                  {s.number}
                </span>
              </div>
              <span className="font-bold uppercase tracking-widest text-sm text-foreground text-center">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StatsBar;
