import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  TrendingUp, Wallet, Users, Share2, Repeat, ShieldCheck, Rocket, IndianRupee, ArrowRight,
} from "lucide-react";
import logo from "@/assets/shopbanao-logo.webp";

export default function PartnerLanding() {
  return (
    <div className="min-h-screen bg-background font-dashboard">
      {/* Top nav */}
      <header className="sticky top-0 z-30 border-b border-border/50 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="ShopBanao" width="64" height="64" className="h-10 md:h-12 w-auto" decoding="async" />
            <span className="flex flex-col leading-none">
              <span className="text-lg md:text-xl text-foreground" style={{ fontFamily: "'Alegreya SC', serif", fontWeight: 700 }}>
                ShopBanao
              </span>
              <span className="mt-0.5 text-[10px] md:text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Partners
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/partners/login">
              <Button variant="ghost" size="sm">Login</Button>
            </Link>
            <Link to="/partners/signup">
              <Button size="sm" className="gap-1">Join Now <ArrowRight className="h-3.5 w-3.5" /></Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/40">
        {/* Soft gradient backdrop */}
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-primary/10 via-background to-background" />
        <div
          className="pointer-events-none absolute -left-20 -top-20 -z-10 h-80 w-80 rounded-full bg-primary/15 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-20 top-40 -z-10 h-72 w-72 rounded-full bg-primary/10 blur-3xl"
          aria-hidden
        />

        <div className="mx-auto max-w-5xl px-4 py-16 text-center sm:py-20">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            <Rocket className="h-3.5 w-3.5" /> Recurring partner program
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
            Earn recurring commission for every store you refer.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Share your unique referral link. When someone you refer subscribes to ShopBanao,
            you earn a percentage of every billing cycle — for as long as they stay.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link to="/partners/signup">
              <Button size="lg" className="px-6 shadow-lg shadow-primary/20">
                Join Partner Program <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/partners/login">
              <Button size="lg" variant="outline" className="px-6">Partner Login</Button>
            </Link>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Free to join · No targets · Pay per result</p>
        </div>
      </section>

      {/* Benefits grid */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <h2 className="text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Why become a ShopBanao partner?
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: Repeat, title: "Recurring commission", desc: "Earn a % of every successful subscription payment, not just the first one." },
            { icon: TrendingUp, title: "Scales with usage", desc: "When your referral upgrades to a higher plan, your commission goes up automatically." },
            { icon: Wallet, title: "Transparent wallet", desc: "Track pending and approved earnings in your dashboard in real time." },
            { icon: Share2, title: "Built-in tools", desc: "Referral links, QR codes, WhatsApp share — everything you need to start sharing." },
            { icon: ShieldCheck, title: "Fair attribution", desc: "90-day cookie window. Once your referral pays, they're locked to you for life." },
            { icon: Users, title: "Anyone can join", desc: "Creators, agencies, freelancers, store owners — if you can share a link, you can earn." },
          ].map((b) => (
            <Card key={b.title} className="rounded-2xl border p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
                <b.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-3 text-base font-bold tracking-tight text-foreground">{b.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{b.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-border/40 bg-muted/30">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <h2 className="text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            How it works
          </h2>
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { n: 1, t: "Sign up", d: "Create your free partner account in under a minute." },
              { n: 2, t: "Share your link", d: "Get a unique referral link, QR code, and WhatsApp share button." },
              { n: 3, t: "They subscribe", d: "When someone you refer pays for any plan, you earn." },
              { n: 4, t: "Get paid", d: "Recurring commission flows into your wallet every billing cycle." },
            ].map((s) => (
              <li key={s.n} className="rounded-2xl border border-border/60 bg-background p-5 transition-shadow hover:shadow-md">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-sm font-bold text-primary-foreground shadow-sm">
                  {s.n}
                </div>
                <h3 className="mt-3 font-bold tracking-tight text-foreground">{s.t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Commission explanation */}
      <section className="mx-auto max-w-4xl px-4 py-16">
        <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/10 via-background to-background p-8 text-center">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/10 blur-2xl" aria-hidden />
          <div className="relative">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg">
              <IndianRupee className="h-7 w-7" />
            </div>
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Earn up to 40% recurring
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">
              Commission is calculated on the actual amount your referral pays. If they upgrade, your commission scales
              up automatically — every single billing cycle, for as long as their subscription is active.
            </p>
            <ul className="mx-auto mt-6 grid max-w-xl gap-2 text-left text-sm text-muted-foreground">
              <li>✓ Commission only after a successful paid subscription</li>
              <li>✓ Recurring commissions on every billing cycle</li>
              <li>✓ No commission on free trials, refunds, or failed payments</li>
              <li>✓ Held for 14 days, then released to withdrawable balance</li>
            </ul>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-16">
        <h2 className="text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Frequently asked questions
        </h2>
        <Accordion type="single" collapsible className="mt-8">
          <AccordionItem value="q1">
            <AccordionTrigger>Who can become a ShopBanao partner?</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">
              Anyone — creators, agencies, freelancers, existing store owners, or anyone with an
              audience. There are no targets, no upfront fees, and no exclusivity requirements.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="q2">
            <AccordionTrigger>How long does my referral stay attributed to me?</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">
              Our cookie lasts 90 days from the first click. Once your referral makes their first
              successful payment, they're permanently locked to your account.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="q3">
            <AccordionTrigger>When do I get paid?</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">
              Commissions are added to your wallet immediately after a successful payment, then
              held for 14 days to clear refund risk. After that they become withdrawable.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="q4">
            <AccordionTrigger>What if my referral upgrades or downgrades?</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">
              Your commission is always calculated on the actual amount paid, so plan changes
              automatically adjust what you earn from the next billing cycle.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="q5">
            <AccordionTrigger>Can I refer myself?</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">
              No. Self-referrals are detected and blocked. Suspicious activity may result in
              your partner account being suspended.
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="mt-12 text-center">
          <Link to="/partners/signup">
            <Button size="lg" className="shadow-lg shadow-primary/20">Join the Partner Program</Button>
          </Link>
        </div>
      </section>

      {/* Sticky mobile CTA */}
      <div
        className="fixed bottom-0 left-0 right-0 z-30 border-t border-border/60 bg-background/95 p-3 backdrop-blur sm:hidden"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
      >
        <Link to="/partners/signup">
          <Button className="h-11 w-full shadow-lg shadow-primary/20">
            Join Partner Program <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </Link>
      </div>

      <footer className="border-t border-border/40 py-6 pb-24 text-center text-xs text-muted-foreground sm:pb-6">
        <Link to="/" className="hover:underline">← Back to ShopBanao</Link>
      </footer>
    </div>
  );
}
