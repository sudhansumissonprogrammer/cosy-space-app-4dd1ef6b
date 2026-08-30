import { useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";

const fmt = (n: number) =>
  "₹" + Math.max(0, Math.round(n)).toLocaleString("en-IN");

const SavingsCalculator = () => {
  const [orders, setOrders] = useState(500);
  const [aov, setAov] = useState(1200);
  const [toolSpend, setToolSpend] = useState(25000);
  const [rto, setRto] = useState(28);

  const result = useMemo(() => {
    const gmv = orders * aov;
    const sbFee = gmv * 0.02; // flat 2% on every order, incl. RTO
    const sbTotal = sbFee; // ₹0 subscription
    const oldTotal = toolSpend + orders * aov * (rto / 100) * 0.15; // RTO logistics burn estimate
    const monthlySavings = oldTotal - sbTotal;
    return {
      gmv,
      sbTotal,
      oldTotal,
      monthlySavings,
      annualSavings: monthlySavings * 12,
      deliveredPct: 100 - rto,
    };
  }, [orders, aov, toolSpend, rto]);

  return (
    <section id="savings" className="border-b-4 border-foreground bg-bauhaus-white py-14 sm:py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10 sm:mb-14">
          <span className="font-bold uppercase tracking-widest text-xs text-muted-foreground mb-2 block">Savings Calculator</span>
          <h2 className="font-black uppercase text-3xl sm:text-4xl lg:text-5xl tracking-tighter leading-[0.95] text-foreground">
            See what you'd save<br />on <span className="text-bauhaus-red">ShopBanao.</span>
          </h2>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 sm:gap-8">
          <div className="bg-bauhaus-canvas border-4 border-foreground shadow-bauhaus-lg p-6 sm:p-8 space-y-6">
            <Slider label="Orders per month" value={orders} min={50} max={5000} step={50} suffix="" onChange={setOrders} />
            <Slider label="Average order value" value={aov} min={200} max={5000} step={50} prefix="₹" onChange={setAov} />
            <Slider label="Current monthly tool spend" value={toolSpend} min={0} max={200000} step={1000} prefix="₹" onChange={setToolSpend} />
            <Slider label="Current RTO %" value={rto} min={0} max={60} step={1} suffix="%" onChange={setRto} />
          </div>

          <div className="bg-bauhaus-yellow border-4 border-foreground shadow-bauhaus-lg p-6 sm:p-8 flex flex-col">
            <div className="font-bold uppercase tracking-widest text-[10px] text-foreground/70 mb-2">Estimated monthly impact</div>

            <div className="border-4 border-foreground bg-bauhaus-white p-5 mb-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-bauhaus-red" />
                <span className="font-bold uppercase tracking-widest text-[10px] text-muted-foreground">You save / month</span>
              </div>
              <div className="font-black text-4xl sm:text-5xl text-bauhaus-red tracking-tight">{fmt(result.monthlySavings)}</div>
              <div className="font-bold text-xs text-foreground/70 mt-1">vs running your current stack manually</div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Stat label="Annual savings" value={fmt(result.annualSavings)} />
              <Stat label="Monthly GMV" value={fmt(result.gmv)} />
              <Stat label="ShopBanao cost" value={fmt(result.sbTotal)} />
              <Stat label="Old stack cost" value={fmt(result.oldTotal)} />
            </div>

            <p className="font-medium text-[11px] text-foreground/60 mt-4 leading-relaxed">
              Estimates only. Real numbers depend on your category, pricing and operational maturity. Talk to us for a custom model.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

const Slider = ({
  label, value, min, max, step, prefix = "", suffix = "", onChange,
}: { label: string; value: number; min: number; max: number; step: number; prefix?: string; suffix?: string; onChange: (n: number) => void; }) => (
  <div>
    <div className="flex items-baseline justify-between mb-2">
      <label className="font-bold uppercase tracking-widest text-[11px] text-foreground/70">{label}</label>
      <span className="font-black text-lg text-foreground">{prefix}{value.toLocaleString("en-IN")}{suffix}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full h-2 bg-foreground/10 border-2 border-foreground appearance-none cursor-pointer accent-bauhaus-red"
    />
  </div>
);

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-bauhaus-white border-2 border-foreground p-3">
    <div className="font-bold uppercase tracking-widest text-[9px] text-muted-foreground">{label}</div>
    <div className="font-black text-base text-foreground">{value}</div>
  </div>
);

export default SavingsCalculator;
