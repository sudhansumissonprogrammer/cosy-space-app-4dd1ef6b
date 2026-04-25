import { useState } from "react";
import { Menu, X } from "lucide-react";
import logo from "@/assets/shopbanao-logo.webp";

/**
 * Prefetch the FullApp chunk on first hover/touch of an auth link so that
 * the hard navigation to /login or /signup feels instant. We use plain
 * `<a href>` for cross-app links to avoid mounting a second BrowserRouter
 * (LandingApp has its own minimal router).
 */
let prefetched = false;
function prefetchFullApp() {
  if (prefetched) return;
  prefetched = true;
  import("@/App").catch(() => {});
}

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-bauhaus-white border-b-4 border-foreground">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 flex items-center justify-between h-14 md:h-20">
        <a href="/" className="flex items-center -space-x-1">
          <img src={logo} alt="ShopBanao" width="64" height="64" className="h-14 md:h-16 w-auto" fetchPriority="high" decoding="async" />
          <span className="text-2xl md:text-3xl text-foreground" style={{ fontFamily: "'Alegreya SC', serif", fontWeight: 700 }}>
            ShopBanao
          </span>
        </a>

        <div className="hidden md:flex items-center gap-8">
          <a href="/#features" className="font-bold uppercase tracking-wider text-sm text-foreground hover:text-bauhaus-red transition-colors duration-200">Features</a>
          <a href="/#pricing" className="font-bold uppercase tracking-wider text-sm text-foreground hover:text-bauhaus-red transition-colors duration-200">Pricing</a>
          <a href="/#sellers" className="font-bold uppercase tracking-wider text-sm text-foreground hover:text-bauhaus-red transition-colors duration-200">For Sellers</a>
          <a href="/#faq" className="font-bold uppercase tracking-wider text-sm text-foreground hover:text-bauhaus-red transition-colors duration-200">FAQ</a>
          <a
            href="/login"
            className="font-bold uppercase tracking-wider text-sm text-foreground hover:text-bauhaus-red transition-colors duration-200"
            onMouseEnter={prefetchFullApp}
            onTouchStart={prefetchFullApp}
          >
            Store Owner Login
          </a>
        </div>

        <div className="hidden md:flex items-center gap-4">
          <a
            href="/signup"
            className="bg-bauhaus-red text-primary-foreground font-bold uppercase tracking-wider text-xs px-4 py-2 border-2 border-foreground shadow-bauhaus hover:bg-bauhaus-red/90 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-200"
            onMouseEnter={prefetchFullApp}
            onTouchStart={prefetchFullApp}
          >
            Start Free
          </a>
        </div>

        <div className="flex md:hidden items-center gap-2">
          <button className="p-2 border-2 border-foreground" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t-4 border-foreground bg-bauhaus-white px-4 py-6 space-y-4">
          <a href="/#features" className="block font-bold uppercase tracking-wider text-foreground" onClick={() => setMobileOpen(false)}>Features</a>
          <a href="/#pricing" className="block font-bold uppercase tracking-wider text-foreground" onClick={() => setMobileOpen(false)}>Pricing</a>
          <a href="/#sellers" className="block font-bold uppercase tracking-wider text-foreground" onClick={() => setMobileOpen(false)}>For Sellers</a>
          <a href="/#faq" className="block font-bold uppercase tracking-wider text-foreground" onClick={() => setMobileOpen(false)}>FAQ</a>
          <a
            href="/login"
            className="block font-bold uppercase tracking-wider text-foreground"
            onClick={() => { setMobileOpen(false); prefetchFullApp(); }}
          >
            Store Owner Login
          </a>
          <div className="pt-4 border-t-2 border-foreground space-y-3">
            <a
              href="/signup"
              className="block text-center bg-bauhaus-red text-primary-foreground font-bold uppercase tracking-wider px-6 py-3 border-2 border-foreground shadow-bauhaus"
              onClick={() => { setMobileOpen(false); prefetchFullApp(); }}
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

