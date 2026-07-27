import { SectionHeading } from "@/components/landing/bauhaus/BauhausKit";

const steps = [
  { n: "01", title: "Pick a theme", body: "Choose from 20+ Indian-grade storefronts. Your brand colours, fonts and logo wire up automatically." },
  { n: "02", title: "Plug in integrations", body: "UPI, Razorpay, Cashfree, Shiprocket, Delhivery, WhatsApp Business — connected in clicks, not days." },
  { n: "03", title: "Connect ad accounts", body: "Meta, Google and Pixel events stream into a single attribution view. No more spreadsheets at month-end." },
  { n: "04", title: "Activate logistics", body: "Auto-assign couriers by pincode, RTO score and weight. AI calls high-risk COD before pickup." },
  { n: "05", title: "Watch the data unify", body: "Every order, ad click, recovery call and delivery in one timeline. Pay 3% only on what actually delivers." },
];

/** Step numbers sit inside geometric badges; every 3rd badge is rotated 45°
 *  with the number counter-rotated so it stays upright. */
const HowItWorks = () => (
  <section className="border-b-4 border-foreground bg-bauhaus-blue py-14 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 opacity-10"
      style={{ backgroundImage: "radial-gradient(hsl(var(--bauhaus-white)) 2px, transparent 2px)", backgroundSize: "20px 20px" }}
    />
    <div className="max-w-6xl mx-auto relative z-10">
      <SectionHeading label="How It Works" tone="light" size="lg" labelShape="triangle">
        Live in a week.<br />Profitable in a quarter.
      </SectionHeading>

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-5">
        {steps.map((s, i) => {
          const rotated = i % 3 === 2;
          return (
            <div
              key={s.n}
              className="relative bg-bauhaus-white border-2 sm:border-4 border-foreground shadow-bauhaus sm:shadow-bauhaus-md p-5 pt-7 transition-transform duration-200 ease-out hover:-translate-y-1"
            >
              <div
                className={`absolute -top-4 left-5 w-9 h-9 border-2 border-foreground flex items-center justify-center ${
                  rotated ? "rotate-45 bg-bauhaus-yellow" : i % 3 === 0 ? "rounded-full bg-bauhaus-red" : "bg-bauhaus-yellow"
                }`}
              >
                <span className={`font-black text-sm ${rotated ? "-rotate-45" : ""} ${i % 3 === 0 ? "text-primary-foreground" : "text-foreground"}`}>
                  {s.n}
                </span>
              </div>
              <h3 className="font-black uppercase text-base text-foreground mb-2 tracking-tight">{s.title}</h3>
              <p className="font-medium text-[13px] text-muted-foreground leading-relaxed">{s.body}</p>
            </div>
          );
        })}
      </div>
    </div>
  </section>
);

export default HowItWorks;
