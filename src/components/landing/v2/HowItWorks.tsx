const steps = [
  { n: "01", title: "Pick a theme", body: "Choose from 20+ Indian-grade storefronts. Your brand colours, fonts and logo wire up automatically." },
  { n: "02", title: "Plug in integrations", body: "UPI, Razorpay, Cashfree, Shiprocket, Delhivery, WhatsApp Business — connected in clicks, not days." },
  { n: "03", title: "Set up WhatsApp", body: "Order updates, COD confirmation and abandoned-cart recovery go out automatically on WhatsApp." },
  { n: "04", title: "Activate logistics", body: "Auto-assign couriers by pincode, RTO score and weight. AI calls high-risk COD before pickup." },
  { n: "05", title: "Watch the data unify", body: "Every order, recovery call and delivery in one timeline. Pay a flat 3% on every sale." },
];

const HowItWorks = () => (
  <section className="border-b-4 border-foreground bg-bauhaus-blue py-14 sm:py-20 px-4 sm:px-6 lg:px-8">
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-10 sm:mb-14">
        <span className="font-bold uppercase tracking-widest text-xs text-bauhaus-white/80 mb-2 block">How It Works</span>
        <h2 className="font-black uppercase text-3xl sm:text-4xl lg:text-5xl tracking-tighter leading-[0.95] text-bauhaus-white">
          Live in a week.<br />Profitable in a quarter.
        </h2>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-5">
        {steps.map((s) => (
          <div key={s.n} className="bg-bauhaus-white border-4 border-foreground shadow-bauhaus-md p-5">
            <div className="font-black text-3xl text-bauhaus-red mb-2">{s.n}</div>
            <h3 className="font-black uppercase text-base text-foreground mb-2 tracking-tight">{s.title}</h3>
            <p className="font-medium text-[13px] text-muted-foreground leading-relaxed">{s.body}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default HowItWorks;
