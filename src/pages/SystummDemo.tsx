import { useState, useRef, useEffect, useCallback } from "react";
import { Search, User, Heart, ShoppingBag, ChevronLeft, ChevronRight, Star, Truck, Palette, ShieldCheck, Menu, X, ArrowRight } from "lucide-react";

/* ─────────────── Color Tokens ─────────────── */
const C = {
  bg: "#F5F0EB",       // warm cream
  surface: "#FFFFFF",
  dark: "#1B3A2D",     // forest green
  darkHover: "#244a39",
  text: "#1B3A2D",
  textMuted: "#6B7B74",
  border: "#E2DDD7",
  accent: "#D4A853",   // gold accent
} as const;

/* ─────────────── Dummy Data ─────────────── */
const PRODUCTS = [
  { id: "1", name: "Badmoss Quarter-Zip Hoodie – Purple", price: 1399, reviews: 23, badge: null, images: ["/placeholder.svg", "/placeholder.svg"] },
  { id: "2", name: "Chore Haryana Aale Hoodie – Black", price: 1999, reviews: 22, badge: null, images: ["/placeholder.svg", "/placeholder.svg"] },
  { id: "3", name: "SANATANI – Hoodie", price: 999, reviews: 0, badge: null, images: ["/placeholder.svg", "/placeholder.svg"] },
  { id: "4", name: "SYSTUMM Authority Hoodie", price: 1499, reviews: 7, badge: "Pre-Order", images: ["/placeholder.svg", "/placeholder.svg"] },
  { id: "5", name: "Bear Hoodie – Purple", price: 1299, reviews: 16, badge: null, images: ["/placeholder.svg", "/placeholder.svg"] },
  { id: "6", name: "Wings of Growth Hoodie", price: 1099, reviews: 10, badge: null, images: ["/placeholder.svg", "/placeholder.svg"] },
];

const REVIEWS = [
  { name: "Rahul Chandra", text: "Didn't expect this level of thickness and comfort. Feels premium the moment you wear it. Perfect oversized fit and doesn't lose shape after washing.", product: "Badmoss Quarter-Zip Hoodie – Purple", price: 1399, rating: 5 },
  { name: "Abhimanyu Acharya", text: "The fabric feels premium and warm without being bulky. Clean design, great fit, and easily one of the most comfortable sweatshirts I own.", product: "Chore Haryana Aale Hoodie", price: 1899, rating: 5 },
  { name: "Abhishek Kalia", text: "The hoodie feels dense, smooth, and premium, with a soft inner lining that's comfortable from the first wear. It doesn't feel cheap or flimsy at all.", product: "SYSTUMM Bear Hoodie", price: 1999, rating: 5 },
];

const MARQUEE_ITEMS = ["Premium Fabric", "Exclusive Seasonal Picks", "Limited Quantity"];

const TRUST_BADGES = [
  { icon: Truck, title: "Free Shipping", desc: "Enjoy free worldwide shipping and returns, with customs and duties taxes included." },
  { icon: Palette, title: "Exclusive Designs", desc: "Our limited-run, unique collections ensure you are wearing a piece of art that stands out." },
  { icon: ShieldCheck, title: "Premium Quality", desc: "Crafted from superior cotton fleece, featuring high-quality print built to last." },
];

/* ─────────────── Announcement Bar ─────────────── */
function AnnouncementBar() {
  const msgs = ["Premium Fabric. Everyday Comfort.", "Oversized Fits. Premium Feel.", "Limited Drop — No Restocks"];
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % msgs.length), 3500);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ background: C.dark, color: "#fff" }} className="relative flex items-center justify-center h-10 text-xs sm:text-sm tracking-wide overflow-hidden">
      <button onClick={() => setIdx(i => (i - 1 + msgs.length) % msgs.length)} className="absolute left-3 opacity-60 hover:opacity-100 transition-opacity">
        <ChevronLeft size={14} />
      </button>
      <span key={idx} className="animate-fade-in">{msgs[idx]}</span>
      <button onClick={() => setIdx(i => (i + 1) % msgs.length)} className="absolute right-3 opacity-60 hover:opacity-100 transition-opacity">
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

/* ─────────────── Header ─────────────── */
function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50" style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
      <div className="mx-auto max-w-7xl flex items-center justify-between h-16 px-4 lg:px-8">
        {/* Mobile menu toggle */}
        <button className="lg:hidden" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={22} style={{ color: C.dark }} /> : <Menu size={22} style={{ color: C.dark }} />}
        </button>

        {/* Logo */}
        <a href="#" className="text-xl sm:text-2xl font-bold tracking-[0.15em] uppercase" style={{ color: C.dark, fontFamily: "'Times New Roman', serif" }}>
          SYSTUMM CLOTHING
        </a>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-8">
          {["Home", "Catalog", "Contact"].map(item => (
            <a key={item} href="#" className="text-sm font-medium tracking-wide hover:opacity-70 transition-opacity" style={{ color: C.dark }}>
              {item}
            </a>
          ))}
        </nav>

        {/* Right icons */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Search */}
          <div className="hidden lg:flex items-center relative">
            <div className="flex items-center rounded-full border px-3 py-1.5 gap-2" style={{ borderColor: C.border, background: C.surface }}>
              <Search size={15} style={{ color: C.textMuted }} />
              <input placeholder="I'm looking for..." className="bg-transparent outline-none text-sm w-40" style={{ color: C.text }} />
            </div>
          </div>
          <button className="lg:hidden" onClick={() => setSearchOpen(!searchOpen)}>
            <Search size={20} style={{ color: C.dark }} />
          </button>
          <button className="hidden sm:block"><User size={20} style={{ color: C.dark }} /></button>
          <button className="relative">
            <Heart size={20} style={{ color: C.dark }} />
            <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center rounded-full text-[9px] font-bold text-white min-w-[16px] h-4 px-0.5" style={{ background: C.dark }}>0</span>
          </button>
          <button className="relative">
            <ShoppingBag size={20} style={{ color: C.dark }} />
            <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center rounded-full text-[9px] font-bold text-white min-w-[16px] h-4 px-0.5" style={{ background: C.dark }}>0</span>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="lg:hidden border-t animate-fade-in" style={{ borderColor: C.border, background: C.bg }}>
          <nav className="flex flex-col px-6 py-4 gap-4">
            {["Home", "Catalog", "Contact"].map(item => (
              <a key={item} href="#" className="text-base font-medium tracking-wide" style={{ color: C.dark }}>{item}</a>
            ))}
          </nav>
        </div>
      )}

      {/* Mobile search */}
      {searchOpen && (
        <div className="lg:hidden px-4 pb-3 animate-fade-in">
          <div className="flex items-center rounded-full border px-3 py-2 gap-2" style={{ borderColor: C.border, background: C.surface }}>
            <Search size={15} style={{ color: C.textMuted }} />
            <input autoFocus placeholder="Search products..." className="bg-transparent outline-none text-sm flex-1" style={{ color: C.text }} />
          </div>
        </div>
      )}
    </header>
  );
}

/* ─────────────── Hero Section ─────────────── */
function HeroSection() {
  return (
    <section className="relative w-full overflow-hidden" style={{ background: "#E8E3DD", minHeight: "min(85vh, 700px)" }}>
      {/* Background image placeholder */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-[400px] h-[500px] sm:w-[500px] sm:h-[600px] rounded-2xl flex items-center justify-center" style={{ background: "#D5D0CA" }}>
          <span className="text-6xl sm:text-8xl font-bold tracking-[0.2em] opacity-20 text-center leading-tight" style={{ color: C.dark, fontFamily: "'Times New Roman', serif" }}>
            BAD<br/>MOSS
          </span>
        </div>
      </div>
      {/* CTA */}
      <div className="relative z-10 flex items-end justify-center pb-12 sm:pb-16" style={{ minHeight: "min(85vh, 700px)" }}>
        <a
          href="#collection"
          className="inline-flex items-center gap-2 px-10 py-3.5 rounded-full text-sm font-semibold tracking-wider text-white transition-all duration-300 hover:scale-105 hover:shadow-xl"
          style={{ background: C.dark }}
        >
          Shop Collection
          <ArrowRight size={16} />
        </a>
      </div>
    </section>
  );
}

/* ─────────────── Product Card ─────────────── */
function ProductCard({ product }: { product: typeof PRODUCTS[0] }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="group cursor-pointer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Image */}
      <div className="relative overflow-hidden rounded-xl mb-3" style={{ aspectRatio: "3/4", background: "#E8E3DD" }}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={`w-3/4 h-3/4 rounded-lg transition-all duration-500 ${hovered ? "scale-105 opacity-80" : "scale-100"}`} style={{ background: "#D5D0CA" }}>
            <div className="flex items-center justify-center h-full">
              <span className="text-4xl font-bold tracking-wider opacity-15" style={{ color: C.dark, fontFamily: "'Times New Roman', serif" }}>
                {product.name.split(" ")[0]}
              </span>
            </div>
          </div>
        </div>

        {/* Badge */}
        {product.badge && (
          <span className="absolute top-3 left-3 text-[10px] font-bold uppercase tracking-widest text-white px-3 py-1 rounded-full" style={{ background: C.accent }}>
            {product.badge}
          </span>
        )}

        {/* Hover overlay actions */}
        <div className={`absolute bottom-0 left-0 right-0 p-3 flex gap-2 transition-all duration-300 ${hovered ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"}`}>
          <button
            className="flex-1 text-xs font-semibold tracking-wider uppercase py-2.5 rounded-lg text-white transition-colors"
            style={{ background: C.dark }}
          >
            Select Options
          </button>
          <button className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: C.surface }}>
            <Heart size={16} style={{ color: C.dark }} />
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="space-y-1.5 px-1">
        <h3 className="text-sm font-medium leading-snug line-clamp-2 group-hover:underline" style={{ color: C.text }}>
          {product.name}
        </h3>
        {product.reviews > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="flex gap-0.5">
              {[1,2,3,4,5].map(s => <Star key={s} size={11} fill={C.accent} stroke={C.accent} />)}
            </div>
            <span className="text-[11px]" style={{ color: C.textMuted }}>{product.reviews} reviews</span>
          </div>
        )}
        <p className="text-sm font-semibold" style={{ color: C.text }}>
          ₹{product.price.toLocaleString("en-IN")}
        </p>
      </div>
    </div>
  );
}

/* ─────────────── Collection Section ─────────────── */
function CollectionSection() {
  return (
    <section id="collection" className="py-16 sm:py-20 px-4 lg:px-8" style={{ background: C.bg }}>
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="text-center mb-10 sm:mb-14">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-3" style={{ color: C.dark }}>
            All Collection
          </h2>
          <p className="text-sm sm:text-base max-w-md mx-auto" style={{ color: C.textMuted }}>
            Unmatched design and superior comfort. <strong style={{ color: C.text }}>Limited drop. No restocks.</strong>
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          {PRODUCTS.map(p => <ProductCard key={p.id} product={p} />)}
        </div>

        {/* View all */}
        <div className="text-center mt-10">
          <a
            href="#"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full border-2 text-sm font-semibold tracking-wider uppercase transition-all duration-300 hover:text-white"
            style={{ borderColor: C.dark, color: C.dark }}
            onMouseEnter={e => { e.currentTarget.style.background = C.dark; e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.dark; }}
          >
            View All
            <ArrowRight size={16} />
          </a>
        </div>
      </div>
    </section>
  );
}

/* ─────────────── Scrolling Marquee ─────────────── */
function ScrollingMarquee() {
  const items = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS, ...MARQUEE_ITEMS, ...MARQUEE_ITEMS];
  return (
    <div className="overflow-hidden py-5" style={{ background: C.dark }}>
      <div className="flex animate-marquee-systumm whitespace-nowrap">
        {items.map((item, i) => (
          <span key={i} className="mx-8 text-sm sm:text-base font-medium tracking-[0.2em] uppercase text-white/90 flex items-center gap-4">
            {item}
            <span className="w-1.5 h-1.5 rounded-full bg-white/40" />
          </span>
        ))}
      </div>
      <style>{`
        @keyframes marquee-systumm {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee-systumm {
          animation: marquee-systumm 25s linear infinite;
        }
      `}</style>
    </div>
  );
}

/* ─────────────── Reviews Section ─────────────── */
function ReviewsSection() {
  return (
    <section className="py-16 sm:py-20 px-4 lg:px-8" style={{ background: C.surface }}>
      <div className="mx-auto max-w-7xl">
        <div className="text-center mb-10 sm:mb-14">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-3" style={{ color: C.dark }}>
            Customer Say!
          </h2>
          <p className="text-sm sm:text-base" style={{ color: C.textMuted }}>
            Customers love our products and we always strive to please them all.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {REVIEWS.map((r, i) => (
            <div key={i} className="rounded-2xl p-6 transition-all duration-300 hover:shadow-lg" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
              {/* Stars */}
              <div className="flex gap-0.5 mb-4">
                {[1,2,3,4,5].map(s => <Star key={s} size={14} fill={C.accent} stroke={C.accent} />)}
              </div>
              {/* Review text */}
              <p className="text-sm leading-relaxed mb-5" style={{ color: C.text }}>
                "{r.text}"
              </p>
              {/* Reviewer */}
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: C.dark }}>
                  {r.name[0]}
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: C.text }}>{r.name}</p>
                  <p className="text-[11px] italic" style={{ color: C.accent }}>Verified Buyer</p>
                </div>
              </div>
              {/* Linked product */}
              <div className="flex items-center gap-3 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
                <div className="w-14 h-14 rounded-lg flex-shrink-0 flex items-center justify-center" style={{ background: "#E8E3DD" }}>
                  <ShoppingBag size={18} style={{ color: C.textMuted }} />
                </div>
                <div>
                  <p className="text-xs font-medium line-clamp-1" style={{ color: C.text }}>{r.product}</p>
                  <p className="text-xs font-semibold" style={{ color: C.dark }}>₹{r.price.toLocaleString("en-IN")}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────── Trust Badges ─────────────── */
function TrustBadges() {
  return (
    <section className="py-14 sm:py-16 px-4 lg:px-8" style={{ background: C.bg }}>
      <div className="mx-auto max-w-5xl grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-6">
        {TRUST_BADGES.map((b, i) => (
          <div key={i} className="text-center space-y-3">
            <div className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: C.dark }}>
              <b.icon size={24} className="text-white" />
            </div>
            <h3 className="text-base font-bold tracking-wide" style={{ color: C.dark }}>{b.title}</h3>
            <p className="text-xs leading-relaxed max-w-[260px] mx-auto" style={{ color: C.textMuted }}>{b.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─────────────── Footer ─────────────── */
function SystummFooter() {
  return (
    <footer className="py-12 px-4 lg:px-8" style={{ background: C.dark }}>
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div>
            <h3 className="text-lg font-bold tracking-[0.15em] uppercase text-white mb-4" style={{ fontFamily: "'Times New Roman', serif" }}>
              SYSTUMM
            </h3>
            <p className="text-xs leading-relaxed text-white/60">
              Premium streetwear crafted with superior cotton fleece. Limited drops, no restocks.
            </p>
          </div>
          {/* Quick Links */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-white/80 mb-4">Quick Links</h4>
            <ul className="space-y-2.5">
              {["Home", "Shop All", "About Us", "Contact"].map(l => (
                <li key={l}><a href="#" className="text-xs text-white/60 hover:text-white transition-colors">{l}</a></li>
              ))}
            </ul>
          </div>
          {/* Policies */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-white/80 mb-4">Policies</h4>
            <ul className="space-y-2.5">
              {["Shipping Policy", "Return Policy", "Terms & Conditions", "Privacy Policy"].map(l => (
                <li key={l}><a href="#" className="text-xs text-white/60 hover:text-white transition-colors">{l}</a></li>
              ))}
            </ul>
          </div>
          {/* Newsletter */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-white/80 mb-4">Stay Updated</h4>
            <p className="text-xs text-white/60 mb-3">Get notified about new drops and exclusive offers.</p>
            <div className="flex">
              <input placeholder="Your email" className="flex-1 text-xs px-3 py-2.5 rounded-l-lg bg-white/10 text-white border border-white/20 outline-none placeholder:text-white/40 focus:border-white/40" />
              <button className="px-4 py-2.5 rounded-r-lg text-xs font-semibold tracking-wide" style={{ background: C.accent, color: C.dark }}>
                Join
              </button>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10 pt-6 text-center">
          <p className="text-[11px] text-white/40">© 2026 Systumm Clothing. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

/* ─────────────── Mobile Bottom Nav ─────────────── */
function MobileBottomNav() {
  const items = [
    { icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/></svg>, label: "Home" },
    { icon: <User size={20} />, label: "Account" },
    { icon: <ShoppingBag size={20} />, label: "Shop" },
    { icon: <Heart size={20} />, label: "Wishlist", count: 0 },
    { icon: <ShoppingBag size={20} />, label: "Cart", count: 0 },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden" style={{ background: C.surface, borderTop: `1px solid ${C.border}` }}>
      <div className="flex items-center justify-around py-2">
        {items.map((item, i) => (
          <button key={i} className="flex flex-col items-center gap-0.5 px-2 py-1 relative">
            <div className="relative">
              <span style={{ color: i === 0 ? C.dark : C.textMuted }}>{item.icon}</span>
              {item.count !== undefined && (
                <span className="absolute -top-1 -right-2 flex items-center justify-center rounded-full text-[8px] font-bold text-white min-w-[14px] h-3.5 px-0.5" style={{ background: C.dark }}>
                  {item.count}
                </span>
              )}
            </div>
            <span className="text-[10px]" style={{ color: i === 0 ? C.dark : C.textMuted }}>{item.label}</span>
          </button>
        ))}
      </div>
      {/* Safe area */}
      <div className="h-[env(safe-area-inset-bottom)]" style={{ background: C.surface }} />
    </div>
  );
}

/* ─────────────── Main Page ─────────────── */
export default function SystummDemo() {
  return (
    <div style={{ background: C.bg, color: C.text }} className="min-h-screen pb-16 lg:pb-0">
      <AnnouncementBar />
      <Header />
      <HeroSection />
      <CollectionSection />
      <ScrollingMarquee />
      <ReviewsSection />
      <TrustBadges />
      <SystummFooter />
      <MobileBottomNav />
    </div>
  );
}
