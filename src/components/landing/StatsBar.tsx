import { useEffect, useRef, useState } from "react";

const stats = [
  { target: 500, suffix: "+", label: "Stores Created", shape: "circle" },
  { target: 2, suffix: "Cr+", prefix: "₹", label: "Revenue Processed", shape: "square" },
  { target: 10000, suffix: "+", label: "Products Listed", shape: "diamond" },
];

function useCountUp(target: number, duration = 1800) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const step = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * target));
            if (progress < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);

  return { count, ref };
}

const StatItem = ({ stat }: { stat: typeof stats[0] }) => {
  const { count, ref } = useCountUp(stat.target);
  const display = `${stat.prefix || ""}${count.toLocaleString("en-IN")}${stat.suffix}`;

  return (
    <div ref={ref} className="flex flex-col items-center justify-center py-8 px-4">
      <div
        className={`w-16 h-16 flex items-center justify-center border-4 border-foreground mb-4 ${
          stat.shape === "circle"
            ? "rounded-full bg-bauhaus-red"
            : stat.shape === "diamond"
            ? "rotate-45 bg-bauhaus-blue"
            : "bg-bauhaus-yellow"
        }`}
      >
        <span
          className={`font-black text-lg leading-none ${stat.shape === "diamond" ? "-rotate-45" : ""} ${
            stat.shape === "square" ? "text-foreground" : "text-primary-foreground"
          }`}
        >
          {display}
        </span>
      </div>
      <span className="font-bold uppercase tracking-widest text-sm text-foreground text-center">
        {stat.label}
      </span>
    </div>
  );
};

const StatsBar = () => {
  return (
    <section className="bg-bauhaus-yellow border-b-4 border-foreground py-12 sm:py-16 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-foreground border-2 sm:border-4 border-foreground bg-bauhaus-white">
          {stats.map((s) => (
            <StatItem key={s.label} stat={s} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default StatsBar;
