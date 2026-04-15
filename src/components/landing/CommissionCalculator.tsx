import { useState } from "react";

const WA_LINK = "https://wa.me/919692282485?text=Hi!%20I%20want%20to%20get%20my%20online%20store%20built";

const CommissionCalculator = () => {
  const [revenue, setRevenue] = useState(50000);
  const [commission, setCommission] = useState(25);
  const monthlyLoss = Math.round(revenue * (commission / 100));
  const yearlyLoss = monthlyLoss * 12;

  return (
    <section className="border-b-4 border-foreground py-12 sm:py-16 lg:py-24 px-4 sm:px-6 lg:px-8 bg-bauhaus-canvas">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <span className="font-bold uppercase tracking-widest text-xs text-muted-foreground mb-2 block">Calculator</span>
          <h2 className="font-black uppercase text-3xl sm:text-4xl lg:text-5xl tracking-tighter leading-[0.9] text-foreground">
            How Much Revenue Are You<br /><span className="text-bauhaus-red">Missing?</span>
          </h2>
        </div>
        <div className="bg-bauhaus-white border-2 sm:border-4 border-foreground shadow-bauhaus sm:shadow-bauhaus-lg p-4 sm:p-6 md:p-10">
          <div className="mb-8">
            <div className="flex justify-between items-center mb-3">
              <label className="font-bold uppercase tracking-wider text-sm text-foreground">Monthly Revenue</label>
              <span className="font-black text-2xl text-foreground">₹{revenue.toLocaleString()}</span>
            </div>
            <input type="range" min={10000} max={500000} step={5000} value={revenue} onChange={(e) => setRevenue(Number(e.target.value))} className="w-full h-3 bg-muted appearance-none cursor-pointer border-2 border-foreground [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-bauhaus-red [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-foreground [&::-webkit-slider-thumb]:cursor-pointer" />
            <div className="flex justify-between text-xs font-medium text-muted-foreground mt-1"><span>₹10K</span><span>₹5L</span></div>
          </div>
          <div className="mb-10">
            <div className="flex justify-between items-center mb-3">
              <label className="font-bold uppercase tracking-wider text-sm text-foreground">Marketplace Commission</label>
              <span className="font-black text-2xl text-foreground">{commission}%</span>
            </div>
            <input type="range" min={5} max={50} step={1} value={commission} onChange={(e) => setCommission(Number(e.target.value))} className="w-full h-3 bg-muted appearance-none cursor-pointer border-2 border-foreground [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-bauhaus-blue [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-foreground [&::-webkit-slider-thumb]:cursor-pointer" />
            <div className="flex justify-between text-xs font-medium text-muted-foreground mt-1"><span>5%</span><span>50%</span></div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-bauhaus-red/10 border-4 border-bauhaus-red p-6 text-center">
              <div className="font-bold uppercase tracking-widest text-xs text-bauhaus-red mb-2">You're Losing Monthly</div>
              <div className="font-black text-3xl sm:text-4xl text-bauhaus-red">₹{monthlyLoss.toLocaleString()}</div>
            </div>
            <div className="bg-bauhaus-red/10 border-4 border-bauhaus-red p-6 text-center">
              <div className="font-bold uppercase tracking-widest text-xs text-bauhaus-red mb-2">You're Losing Yearly</div>
              <div className="font-black text-3xl sm:text-4xl text-bauhaus-red">₹{yearlyLoss.toLocaleString()}</div>
            </div>
          </div>
          <div className="mt-8 text-center">
            <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-bauhaus-yellow text-foreground font-bold uppercase tracking-wider px-8 py-3.5 border-2 border-foreground shadow-bauhaus-md hover:bg-bauhaus-yellow/90 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-200">
              Get Your Store Built — ₹10,000
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CommissionCalculator;
