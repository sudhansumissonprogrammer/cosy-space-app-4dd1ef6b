import { useState } from "react";
import { Menu, X } from "lucide-react";
import { onAuthCtaIntent } from "@/lib/prefetchLandingAuth";
import { BauhausMark, bauButtonClass } from "@/components/landing/bauhaus/BauhausKit";

// NOTE: We deliberately do NOT prefetch App.tsx from landing — any
// `import("@/App")` reference here would make Rollup add modulepreload links
// for App + radix + supabase + react-query (~500KB) onto the landing critical
// path. Hard nav to /login or /signup loads them on demand.

const navLinks = [
  { label: "Platform", href: "/#features" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Savings", href: "/#savings" },
  { label: "FAQ", href: "/#faq" },
];

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-bauhaus-white border-b-4 border-foreground">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 flex items-center justify-between h-14 md:h-20">
        {/* Geometric brand mark: circle + square + triangle in the primaries */}
        <a href="/" className="flex items-center gap-2.5 group" aria-label="ShopBanao home">
          <span className="border-2 border-foreground bg-bauhaus-canvas px-2 py-1.5 shadow-bauhaus-sm transition-transform duration-200 ease-out group-hover:-translate-y-0.5">
            <BauhausMark size="h-3.5 w-3.5 md:h-4 md:w-4" />
          </span>
          <span className="font-black uppercase tracking-tighter text-xl md:text-2xl text-foreground leading-none">
            Shop<span className="text-bauhaus-red">Banao</span>
          </span>
        </a>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="font-bold uppercase tracking-wider text-sm text-foreground hover:text-bauhaus-red transition-colors duration-200"
            >
              {l.label}
            </a>
          ))}
          <a
            href="/login"
            {...onAuthCtaIntent}
            className="font-bold uppercase tracking-wider text-sm text-foreground hover:text-bauhaus-red transition-colors duration-200"
          >
            Login
          </a>
        </div>

        <div className="hidden md:flex items-center gap-3">
          <a href="/#demo" className={bauButtonClass({ variant: "outline", size: "sm", shadow: "shadow-none" })}>
            Book a Demo
          </a>
          <a href="/signup" {...onAuthCtaIntent} className={bauButtonClass({ variant: "red", size: "sm" })}>
            Start Free
          </a>
        </div>

        <div className="flex md:hidden items-center gap-2">
          <button
            className="p-2 border-2 border-foreground bg-bauhaus-white shadow-bauhaus-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-[transform,box-shadow] duration-200"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t-4 border-foreground bg-bauhaus-white px-4 py-6 space-y-4">
          <a href="/#features" className="block font-bold uppercase tracking-wider text-foreground" onClick={() => setMobileOpen(false)}>Features</a>
          <a href="/#sellers" className="block font-bold uppercase tracking-wider text-foreground" onClick={() => setMobileOpen(false)}>For Sellers</a>
          <a href="/partners" className="block font-bold uppercase tracking-wider text-foreground" onClick={() => setMobileOpen(false)}>Partners</a>
          <a href="/#faq" className="block font-bold uppercase tracking-wider text-foreground" onClick={() => setMobileOpen(false)}>FAQ</a>
          <a href="/login" className="block font-bold uppercase tracking-wider text-foreground" onClick={() => setMobileOpen(false)}>
            Store Owner Login
          </a>
          <div className="pt-4 border-t-2 border-foreground">
            <a
              href="/signup"
              className={`${bauButtonClass({ variant: "red", size: "md" })} w-full`}
              onClick={() => setMobileOpen(false)}
            >
              Start Free
            </a>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
