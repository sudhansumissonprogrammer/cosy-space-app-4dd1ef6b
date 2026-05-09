import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Link } from "react-router-dom";
import logo from "@/assets/shopbanao-logo.webp";

/**
 * Bauhaus-styled top nav used on public partner pages
 * (landing, login, signup). Matches the main marketing nav.
 */
export default function PartnerNav() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-bauhaus-white border-b-4 border-foreground">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 flex items-center justify-between h-14 md:h-20">
        <Link to="/" className="flex items-center -space-x-1">
          <img src={logo} alt="ShopBanao" width="64" height="64" className="h-12 md:h-16 w-auto" decoding="async" />
          <span className="text-xl md:text-3xl text-foreground" style={{ fontFamily: "'Alegreya SC', serif", fontWeight: 700 }}>
            ShopBanao
          </span>
          <span className="ml-2 hidden sm:inline border-2 border-foreground bg-bauhaus-yellow px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-foreground shadow-bauhaus-sm">
            Partners
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-6">
          <Link to="/partners" className="font-bold uppercase tracking-wider text-sm text-foreground hover:text-bauhaus-red transition-colors">Program</Link>
          <a href="/#features" className="font-bold uppercase tracking-wider text-sm text-foreground hover:text-bauhaus-red transition-colors">Features</a>
          <Link to="/partners/login" className="font-bold uppercase tracking-wider text-sm text-foreground hover:text-bauhaus-red transition-colors">Login</Link>
          <Link
            to="/partners/signup"
            className="bg-bauhaus-red text-primary-foreground font-bold uppercase tracking-wider text-xs px-4 py-2 border-2 border-foreground shadow-bauhaus hover:bg-bauhaus-red/90 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-200"
          >
            Join Now
          </Link>
        </div>

        <button className="md:hidden p-2 border-2 border-foreground" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t-4 border-foreground bg-bauhaus-white px-4 py-5 space-y-3">
          <Link to="/partners" onClick={() => setOpen(false)} className="block font-bold uppercase tracking-wider text-foreground">Program</Link>
          <a href="/#features" onClick={() => setOpen(false)} className="block font-bold uppercase tracking-wider text-foreground">Features</a>
          <Link to="/partners/login" onClick={() => setOpen(false)} className="block font-bold uppercase tracking-wider text-foreground">Login</Link>
          <Link
            to="/partners/signup"
            onClick={() => setOpen(false)}
            className="block text-center bg-bauhaus-red text-primary-foreground font-bold uppercase tracking-wider px-6 py-3 border-2 border-foreground shadow-bauhaus"
          >
            Join Now
          </Link>
        </div>
      )}
    </nav>
  );
}
