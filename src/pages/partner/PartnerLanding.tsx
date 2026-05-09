import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  TrendingUp, Wallet, Users, Share2, Repeat, ShieldCheck, Rocket, IndianRupee,
} from "lucide-react";

export default function PartnerLanding() {
  return (
    <div className="min-h-screen bg-background">
      {/* Top nav */}
      <header className="sticky top-0 z-30 border-b border-border/50 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="text-base font-semibold text-foreground">ShopBanao Partners</Link>
          <div className="flex items-center gap-2">
            <Link to="/partners/login">
              <Button variant="ghost" size="sm">Login</Button>
            </Link>
            <Link to="/partners/signup">
              <Button size="sm">Join Now</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-border/40">
        <div className="mx-auto max-w-5xl px-4 py-16 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
            <Rocket className="h-3.5 w-3.5" /> Recurring partner program
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Earn recurring commission for every store you refer.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground">
            Share your unique referral link. When someone you refer subscribes to ShopBanao,
            you earn a percentage of every billing cycle — for as long as they stay.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link to="/partners/signup">
              <Button size="lg" className="px-6">Join Partner Program</Button>
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
        <h2 className="text-center text-2xl font-semibold text-foreground sm:text-3xl">
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
            <Card key={b.title} className="p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <b.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-3 text-base font-semibold text-foreground">{b.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{b.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-border/40 bg-muted/30">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <h2 className="text-center text-2xl font-semibold text-foreground sm:text-3xl">
            How it works
          </h2>
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { n: 1, t: "Sign up", d: "Create your free partner account in under a minute." },
              { n: 2, t: "Share your link", d: "Get a unique referral link, QR code, and WhatsApp share button." },
              { n: 3, t: "They subscribe", d: "When someone you refer pays for any plan, you earn." },
              { n: 4, t: "Get paid", d: "Recurring commission flows into your wallet every billing cycle." },
            ].map((s) => (
              <li key={s.n} className="rounded-xl border border-border/60 bg-background p-5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {s.n}
                </div>
                <h3 className="mt-3 font-semibold text-foreground">{s.t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Commission explanation */}
      <section className="mx-auto max-w-4xl px-4 py-16">
        <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-primary/10 via-background to-background p-8 text-center">
          <IndianRupee className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-3 text-2xl font-bold text-foreground sm:text-3xl">
            Earn up to 40% recurring
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">
            Commission is calculated on the actual amount your referral pays. If they're on a
            small plan, you earn from the small plan. If they upgrade, your commission scales
            up automatically — every single billing cycle, for as long as their subscription
            is active.
          </p>
          <ul className="mx-auto mt-6 grid max-w-xl gap-2 text-left text-sm text-muted-foreground">
            <li>✓ Commission only after a successful paid subscription</li>
            <li>✓ Recurring commissions on every billing cycle</li>
            <li>✓ No commission on free trials, refunds, or failed payments</li>
            <li>✓ Held for 14 days, then released to withdrawable balance</li>
          </ul>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-16">
        <h2 className="text-center text-2xl font-semibold text-foreground sm:text-3xl">
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
            <Button size="lg">Join the Partner Program</Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-border/40 py-6 text-center text-xs text-muted-foreground">
        <Link to="/" className="hover:underline">← Back to ShopBanao</Link>
      </footer>
    </div>
  );
}
