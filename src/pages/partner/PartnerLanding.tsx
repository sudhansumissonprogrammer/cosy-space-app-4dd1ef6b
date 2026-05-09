import { Link } from "react-router-dom";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  TrendingUp, Wallet, Users, Share2, Repeat, ShieldCheck, Rocket, IndianRupee, ArrowRight, CheckCircle2,
} from "lucide-react";
import PartnerNav from "@/components/partner/PartnerNav";

const benefits = [
  { icon: Repeat, color: "bg-bauhaus-red", title: "Recurring commission", desc: "Earn a % of every successful subscription payment, not just the first one." },
  { icon: TrendingUp, color: "bg-bauhaus-blue", title: "Scales with usage", desc: "When your referral upgrades to a higher plan, your commission goes up automatically." },
  { icon: Wallet, color: "bg-bauhaus-yellow", title: "Transparent wallet", desc: "Track pending and approved earnings in your dashboard in real time." },
  { icon: Share2, color: "bg-bauhaus-blue", title: "Built-in tools", desc: "Referral links, QR codes, WhatsApp share — everything you need to start sharing." },
  { icon: ShieldCheck, color: "bg-bauhaus-yellow", title: "Fair attribution", desc: "90-day cookie window. Once your referral pays, they're locked to you for life." },
  { icon: Users, color: "bg-bauhaus-red", title: "Anyone can join", desc: "Creators, agencies, freelancers, store owners — if you can share a link, you can earn." },
];

const steps = [
  { n: "01", t: "Sign up", d: "Create your free partner account in under a minute.", color: "bg-bauhaus-yellow" },
  { n: "02", t: "Share your link", d: "Get a unique referral link, QR code, and WhatsApp share button.", color: "bg-bauhaus-blue" },
  { n: "03", t: "They subscribe", d: "When someone you refer pays for any plan, you earn.", color: "bg-bauhaus-red" },
  { n: "04", t: "Get paid", d: "Recurring commission flows into your wallet every billing cycle.", color: "bg-bauhaus-canvas" },
];

export default function PartnerLanding() {
  return (
    <div className="min-h-screen bg-bauhaus-white">
      <PartnerNav />

      {/* Hero */}
      <section className="border-b-4 border-foreground bg-bauhaus-canvas">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 py-14 sm:py-20 lg:py-24">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <div className="inline-flex items-center gap-2 border-2 border-foreground px-3 py-1.5 mb-6 shadow-bauhaus-sm bg-bauhaus-yellow w-fit">
                <Rocket className="h-3.5 w-3.5" />
                <span className="font-bold uppercase tracking-widest text-[10px] sm:text-xs text-foreground">Recurring Partner Program</span>
              </div>

              <h1 className="font-black text-[30px] sm:text-5xl lg:text-6xl tracking-tight leading-[1.05] text-foreground mb-5">
                Earn recurring <span className="text-bauhaus-red">commission</span> for every store you refer.
              </h1>

              <p className="font-medium text-sm sm:text-base lg:text-lg text-muted-foreground leading-relaxed mb-7 max-w-xl">
                Share your unique referral link. When someone you refer subscribes to ShopBanao, you earn a percentage of every billing cycle — for as long as they stay.
              </p>

              <div className="flex flex-wrap gap-3 mb-6">
                <Link
                  to="/partners/signup"
                  className="inline-flex items-center justify-center gap-2 bg-bauhaus-red text-primary-foreground font-bold uppercase tracking-wider text-xs sm:text-sm px-6 sm:px-8 py-3 sm:py-3.5 border-2 border-foreground shadow-bauhaus hover:bg-bauhaus-red/90 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-200"
                >
                  Join Partner Program <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/partners/login"
                  className="inline-flex items-center justify-center gap-2 bg-bauhaus-white text-foreground font-bold uppercase tracking-wider text-xs sm:text-sm px-6 sm:px-8 py-3 sm:py-3.5 border-2 border-foreground shadow-bauhaus hover:bg-muted active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-200"
                >
                  Partner Login
                </Link>
              </div>

              <div className="flex flex-wrap items-center gap-4 sm:gap-5">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-bauhaus-blue" />
                  <span className="font-medium text-[11px] sm:text-xs text-muted-foreground">Free to join</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-bauhaus-blue" />
                  <span className="font-medium text-[11px] sm:text-xs text-muted-foreground">No targets</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-bauhaus-blue" />
                  <span className="font-medium text-[11px] sm:text-xs text-muted-foreground">Pay per result</span>
                </div>
              </div>
            </div>

            {/* Bauhaus stat panel */}
            <div className="hidden lg:flex justify-center">
              <div className="grid grid-cols-2 gap-4 w-full max-w-md">
                <div className="bg-bauhaus-red border-3 border-foreground shadow-bauhaus-lg p-5 text-primary-foreground -rotate-1">
                  <Wallet className="h-6 w-6 mb-3" />
                  <div className="text-[10px] font-bold uppercase tracking-widest opacity-80">This Month</div>
                  <div className="text-3xl font-black mt-1">Recurring</div>
                  <div className="text-xs font-medium opacity-90 mt-1">Every billing cycle</div>
                </div>
                <div className="bg-bauhaus-yellow border-3 border-foreground shadow-bauhaus-lg p-5 text-foreground rotate-2 translate-y-4">
                  <Users className="h-6 w-6 mb-3" />
                  <div className="text-[10px] font-bold uppercase tracking-widest opacity-70">Lifetime</div>
                  <div className="text-3xl font-black mt-1">Locked</div>
                  <div className="text-xs font-medium mt-1">Once paid, yours</div>
                </div>
                <div className="bg-bauhaus-blue border-3 border-foreground shadow-bauhaus-lg p-5 text-primary-foreground rotate-1 col-span-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest opacity-80">Up to</div>
                      <div className="text-4xl font-black mt-1">40%</div>
                      <div className="text-xs font-medium opacity-90 mt-1">Commission rate</div>
                    </div>
                    <IndianRupee className="h-12 w-12 opacity-30" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="border-b-4 border-foreground bg-bauhaus-white">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 py-16 sm:py-20">
          <div className="text-center mb-10 sm:mb-14">
            <div className="inline-block border-2 border-foreground bg-bauhaus-yellow px-3 py-1 mb-4 shadow-bauhaus-sm">
              <span className="font-bold uppercase tracking-widest text-[10px] sm:text-xs text-foreground">Why Partner</span>
            </div>
            <h2 className="font-black text-3xl sm:text-4xl lg:text-5xl tracking-tight text-foreground">
              Built for serious referrers.
            </h2>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {benefits.map((b) => (
              <div
                key={b.title}
                className="bg-bauhaus-white border-3 border-foreground shadow-bauhaus p-6 hover:shadow-bauhaus-md hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className={`flex h-12 w-12 items-center justify-center border-2 border-foreground ${b.color}`}>
                  <b.icon className="h-6 w-6 text-foreground" />
                </div>
                <h3 className="mt-4 font-black uppercase tracking-wide text-base text-foreground">{b.title}</h3>
                <p className="mt-2 font-medium text-sm text-muted-foreground leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-b-4 border-foreground bg-bauhaus-canvas">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 py-16 sm:py-20">
          <div className="text-center mb-10 sm:mb-14">
            <div className="inline-block border-2 border-foreground bg-bauhaus-red text-primary-foreground px-3 py-1 mb-4 shadow-bauhaus-sm">
              <span className="font-bold uppercase tracking-widest text-[10px] sm:text-xs">How It Works</span>
            </div>
            <h2 className="font-black text-3xl sm:text-4xl lg:text-5xl tracking-tight text-foreground">
              Four steps. That's it.
            </h2>
          </div>

          <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s) => (
              <li key={s.n} className={`${s.color} border-3 border-foreground shadow-bauhaus p-6`}>
                <div className="font-black text-4xl text-foreground tracking-tight">{s.n}</div>
                <h3 className="mt-3 font-black uppercase tracking-wide text-base text-foreground">{s.t}</h3>
                <p className="mt-2 font-medium text-sm text-foreground/70 leading-relaxed">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Commission explainer */}
      <section className="border-b-4 border-foreground bg-bauhaus-white">
        <div className="max-w-4xl mx-auto px-5 sm:px-8 lg:px-12 py-16 sm:py-20">
          <div className="bg-foreground text-primary-foreground border-3 border-foreground shadow-bauhaus-lg p-8 sm:p-12 text-center">
            <div className="inline-flex items-center justify-center h-16 w-16 bg-bauhaus-yellow border-3 border-primary-foreground/20 mb-5">
              <IndianRupee className="h-8 w-8 text-foreground" />
            </div>
            <h2 className="font-black text-3xl sm:text-4xl tracking-tight">
              Earn up to <span className="text-bauhaus-yellow">40% recurring</span>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl font-medium text-sm sm:text-base text-primary-foreground/70 leading-relaxed">
              Commission is calculated on the actual amount your referral pays. If they're on a small plan, you earn from the small plan. If they upgrade, your commission scales up automatically — every single billing cycle, for as long as their subscription is active.
            </p>
            <ul className="mx-auto mt-8 grid max-w-xl gap-3 text-left">
              {[
                "Commission only after a successful paid subscription",
                "Recurring commissions on every billing cycle",
                "No commission on free trials, refunds, or failed payments",
                "Held for 14 days, then released to withdrawable balance",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 font-medium text-sm text-primary-foreground/85">
                  <CheckCircle2 className="h-5 w-5 text-bauhaus-yellow flex-shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-b-4 border-foreground bg-bauhaus-canvas">
        <div className="max-w-3xl mx-auto px-5 sm:px-8 lg:px-12 py-16 sm:py-20">
          <div className="text-center mb-10">
            <div className="inline-block border-2 border-foreground bg-bauhaus-blue text-primary-foreground px-3 py-1 mb-4 shadow-bauhaus-sm">
              <span className="font-bold uppercase tracking-widest text-[10px] sm:text-xs">FAQ</span>
            </div>
            <h2 className="font-black text-3xl sm:text-4xl tracking-tight text-foreground">Common questions</h2>
          </div>

          <div className="bg-bauhaus-white border-3 border-foreground shadow-bauhaus-lg p-2 sm:p-4">
            <Accordion type="single" collapsible>
              {[
                { q: "Who can become a ShopBanao partner?", a: "Anyone — creators, agencies, freelancers, existing store owners, or anyone with an audience. There are no targets, no upfront fees, and no exclusivity requirements." },
                { q: "How long does my referral stay attributed to me?", a: "Our cookie lasts 90 days from the first click. Once your referral makes their first successful payment, they're permanently locked to your account." },
                { q: "When do I get paid?", a: "Commissions are added to your wallet immediately after a successful payment, then held for 14 days to clear refund risk. After that they become withdrawable." },
                { q: "What if my referral upgrades or downgrades?", a: "Your commission is always calculated on the actual amount paid, so plan changes automatically adjust what you earn from the next billing cycle." },
                { q: "Can I refer myself?", a: "No. Self-referrals are detected and blocked. Suspicious activity may result in your partner account being suspended." },
              ].map((item, i) => (
                <AccordionItem key={i} value={`q${i}`} className="border-b-2 border-foreground last:border-b-0">
                  <AccordionTrigger className="font-bold uppercase tracking-wide text-sm text-foreground hover:no-underline px-3">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="font-medium text-sm text-muted-foreground leading-relaxed px-3">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          <div className="mt-12 text-center">
            <Link
              to="/partners/signup"
              className="inline-flex items-center justify-center gap-2 bg-bauhaus-red text-primary-foreground font-bold uppercase tracking-wider text-xs sm:text-sm px-8 py-3.5 border-2 border-foreground shadow-bauhaus hover:bg-bauhaus-red/90 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-200"
            >
              Join the Partner Program <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-foreground text-primary-foreground py-8 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="font-medium text-xs text-primary-foreground/40">© 2025 ShopBanao Partner Program</p>
          <div className="flex items-center gap-4">
            <Link to="/" className="font-bold uppercase tracking-wider text-xs text-primary-foreground/70 hover:text-bauhaus-yellow">← Back to ShopBanao</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
