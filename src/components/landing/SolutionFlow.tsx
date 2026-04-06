import { useRef, useLayoutEffect, useState } from "react";
import { Store, PackagePlus, CreditCard, Rocket } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import stepCreateStore from "@/assets/step-create-store.png";
import stepAddProducts from "@/assets/step-add-products.png";
import stepAcceptPayments from "@/assets/step-accept-payments.png";
import stepStartSelling from "@/assets/step-start-selling.png";

gsap.registerPlugin(ScrollTrigger);

const steps = [
  {
    num: "01",
    icon: Store,
    title: "Create Your Store",
    desc: "Launch your own online store in minutes with your custom domain.",
    color: "bg-bauhaus-blue",
    img: stepCreateStore,
  },
  {
    num: "02",
    icon: PackagePlus,
    title: "Add Your Products",
    desc: "Upload products, images, pricing, and inventory easily.",
    color: "bg-bauhaus-red",
    img: stepAddProducts,
  },
  {
    num: "03",
    icon: CreditCard,
    title: "Accept Payments",
    desc: "Start collecting payments via UPI, cards, and more instantly.",
    color: "bg-bauhaus-yellow",
    img: stepAcceptPayments,
  },
  {
    num: "04",
    icon: Rocket,
    title: "Start Selling",
    desc: "Share your store link and start selling 24/7.",
    color: "bg-bauhaus-blue",
    img: stepStartSelling,
  },
];

const SolutionFlow = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [activeStep, setActiveStep] = useState(0);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      const panels = section.querySelectorAll<HTMLElement>(".step-panel");

      panels.forEach((panel, i) => {
        ScrollTrigger.create({
          trigger: panel,
          start: "top center",
          end: "bottom center",
          onEnter: () => setActiveStep(i),
          onEnterBack: () => setActiveStep(i),
        });
      });
    }, section);

    return () => ctx.revert();
  }, []);

  const active = steps[activeStep];
  const ActiveIcon = active.icon;

  return (
    <section
      ref={sectionRef}
      className="relative border-y-4 border-foreground bg-bauhaus-white"
    >
      {/* Dot pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(hsl(var(--foreground)) 1.5px, transparent 1.5px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Section header */}
      <div className="text-center pt-10 sm:pt-14 lg:pt-20 pb-6 sm:pb-10 px-5 relative z-10">
        <span className="inline-block bg-bauhaus-blue text-bauhaus-white font-bold text-xs uppercase tracking-[0.15em] px-4 py-2 border-2 border-foreground mb-4">
          Simple Process
        </span>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black uppercase tracking-tighter leading-[0.9] text-foreground">
          How It{" "}
          <span className="text-bauhaus-blue font-['Alegreya_SC',serif] italic">
            Works
          </span>
        </h2>
      </div>

      {/* Sticky container with scroll panels */}
      <div className="relative lg:grid lg:grid-cols-2 lg:gap-0">
        {/* LEFT: Sticky visual (desktop) / top sticky (mobile) */}
        <div className="lg:order-2 sticky top-0 lg:top-0 z-20 flex items-center justify-center h-[50vh] lg:h-screen bg-bauhaus-white/80 backdrop-blur-sm lg:bg-transparent lg:backdrop-blur-none">
          <div className="relative w-[180px] sm:w-[220px] lg:w-[260px]">
            {/* Phone image with transition */}
            <div className="transition-all duration-500 ease-out">
              <img
                key={activeStep}
                src={active.img}
                alt={active.title}
                className="w-full h-auto drop-shadow-2xl animate-fade-in"
                width={512}
                height={960}
                loading="lazy"
              />
            </div>

            {/* Step badge */}
            <div
              className={`absolute -top-2 -right-2 lg:-top-3 lg:-right-3 w-12 h-12 lg:w-14 lg:h-14 ${active.color} border-2 border-foreground flex items-center justify-center shadow-bauhaus transition-colors duration-300`}
            >
              <ActiveIcon className="h-6 w-6 lg:h-7 lg:w-7 text-bauhaus-white" strokeWidth={2.5} />
            </div>
          </div>
        </div>

        {/* RIGHT: Scrolling step panels */}
        <div className="lg:order-1 relative z-10">
          {steps.map((step, i) => {
            const Icon = step.icon;
            const isActive = activeStep === i;
            return (
              <div
                key={i}
                className="step-panel flex items-center min-h-[50vh] lg:min-h-screen px-5 sm:px-8 lg:px-12 xl:px-20"
              >
                <div
                  className={`max-w-md transition-all duration-500 ${
                    isActive
                      ? "opacity-100 translate-y-0"
                      : "opacity-30 translate-y-4"
                  }`}
                >
                  {/* Progress indicator */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex gap-1.5">
                      {steps.map((_, j) => (
                        <div
                          key={j}
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            j === i
                              ? `w-8 ${step.color}`
                              : j < i
                              ? "w-3 bg-foreground/30"
                              : "w-3 bg-foreground/10"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Step {step.num}
                    </span>
                  </div>

                  {/* Icon + Title */}
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className={`w-10 h-10 lg:w-12 lg:h-12 ${step.color} border-2 border-foreground flex items-center justify-center`}
                    >
                      <Icon
                        className="h-5 w-5 lg:h-6 lg:w-6 text-bauhaus-white"
                        strokeWidth={2.5}
                      />
                    </div>
                    <h3 className="text-xl sm:text-2xl lg:text-3xl font-black uppercase tracking-tight text-foreground">
                      {step.title}
                    </h3>
                  </div>

                  {/* Description */}
                  <p className="text-sm sm:text-base lg:text-lg text-muted-foreground font-medium leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="relative z-10 text-center pb-10 sm:pb-14 lg:pb-20 px-5">
        <div className="bg-bauhaus-white border-2 md:border-4 border-foreground shadow-bauhaus p-5 md:p-6 max-w-2xl mx-auto mb-6">
          <p className="text-base md:text-xl font-black text-[#16a34a] uppercase tracking-wide">
            👉 Fully Automated — Selling, Ordering & Tracking
          </p>
        </div>
        <a
          href="/signup"
          className="inline-block bg-bauhaus-red text-bauhaus-white font-black text-sm md:text-lg uppercase tracking-wider px-8 py-4 border-2 md:border-4 border-foreground shadow-bauhaus hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_hsl(var(--foreground))] transition-all duration-200"
        >
          Create Your Store in 10 Minutes
        </a>
        <p className="mt-3 text-xs md:text-sm text-muted-foreground font-semibold">
          7-day free trial • No setup cost
        </p>
      </div>
    </section>
  );
};

export default SolutionFlow;
