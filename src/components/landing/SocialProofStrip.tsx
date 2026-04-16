import { useEffect, useRef, useState } from "react";

function useCountUp(end: number, duration = 1200) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const animate = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setValue(Math.round(eased * end));
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end, duration]);

  return { value, ref };
}

const metrics = [
  { end: 10, suffix: "+", label: "Stores Delivered", color: "bg-bauhaus-red" },
  { end: 5, suffix: "L+", label: "Revenue Generated", prefix: "₹", color: "bg-bauhaus-blue" },
  { end: 5, suffix: "+", label: "Cities Across India", color: "bg-bauhaus-yellow" },
  { end: 48, suffix: "hr", label: "Average Delivery", color: "bg-bauhaus-red" },
];

const SocialProofStrip = () => {
  return (
    <section className="border-b-4 border-foreground bg-foreground">
      <div className="max-w-6xl mx-auto grid grid-cols-2 lg:grid-cols-4">
        {metrics.map((m, i) => {
          const { value, ref } = useCountUp(m.end);
          return (
            <div
              key={m.label}
              ref={ref}
              className={`flex flex-col items-center justify-center py-5 sm:py-6 px-3 ${i < 3 ? "border-r-2 border-white/10" : ""} ${i < 2 ? "border-b-2 lg:border-b-0 border-white/10" : ""}`}
            >
              <div className="flex items-baseline gap-0.5">
                <span className="text-2xl sm:text-3xl lg:text-4xl font-black text-bauhaus-white">
                  {m.prefix || ""}{value}{m.suffix}
                </span>
              </div>
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-white/60 mt-1">
                {m.label}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default SocialProofStrip;
