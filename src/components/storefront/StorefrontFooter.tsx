import { useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Clock, MessageCircle, Instagram, Facebook, Send } from "lucide-react";
import shopbanaoLogo from "@/assets/shopbanao-logo.png";
import StoreTextLogo from "@/components/storefront/StoreTextLogo";
import type { StoreData } from "@/layouts/StorefrontLayout";
import { storefrontPath } from "@/lib/subdomain";
import { optimizeImageUrl } from "@/lib/imageOptimize";
import { toast } from "sonner";

interface StorefrontFooterProps {
  store: StoreData;
}

function PaymentIcons() {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Visa */}
      <div className="h-7 w-11 rounded bg-white/10 flex items-center justify-center text-[9px] font-bold tracking-wide opacity-60">VISA</div>
      {/* Mastercard */}
      <div className="h-7 w-11 rounded bg-white/10 flex items-center justify-center text-[9px] font-bold tracking-wide opacity-60">MC</div>
      {/* UPI */}
      <div className="h-7 w-11 rounded bg-white/10 flex items-center justify-center text-[9px] font-bold tracking-wide opacity-60">UPI</div>
      {/* COD */}
      <div className="h-7 w-11 rounded bg-white/10 flex items-center justify-center text-[9px] font-bold tracking-wide opacity-60">COD</div>
    </div>
  );
}

export default function StorefrontFooter({ store }: StorefrontFooterProps) {
  const year = new Date().getFullYear();
  const hours = store.business_hours as Record<string, string> | null;
  const hasHours = hours && Object.values(hours).some((v) => v?.trim());
  const address = [store.location, store.city, store.state].filter(Boolean).join(", ");
  const [email, setEmail] = useState("");

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    toast.success("Thanks for subscribing!");
    setEmail("");
  };

  return (
    <footer
      className="mt-16 border-t"
      style={{
        backgroundColor: "var(--storefront-primary, #1a1a1a)",
        color: "var(--storefront-footer-text, #ffffff)",
      }}
    >
      {/* Newsletter Bar */}
      <div
        className="py-8 lg:py-10"
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <div className="mx-auto max-w-6xl lg:max-w-7xl px-4 lg:px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-base lg:text-lg font-bold" style={{ fontFamily: "var(--storefront-heading-font, inherit)" }}>
                Stay Updated
              </h3>
              <p className="text-sm opacity-70 mt-0.5">Get updates on new arrivals & exclusive offers</p>
            </div>
            <form onSubmit={handleNewsletterSubmit} className="flex w-full max-w-md">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="flex-1 px-4 py-2.5 text-sm rounded-l-lg border-0 outline-none"
                style={{
                  backgroundColor: "rgba(255,255,255,0.12)",
                  color: "inherit",
                }}
                required
              />
              <button
                type="submit"
                className="px-5 py-2.5 text-sm font-semibold rounded-r-lg transition-all hover:brightness-110 active:scale-95 flex items-center gap-1.5"
                style={{
                  backgroundColor: "var(--storefront-accent, rgba(255,255,255,0.2))",
                  color: "inherit",
                }}
              >
                <Send className="h-3.5 w-3.5" />
                Subscribe
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl lg:max-w-7xl px-4 lg:px-6 py-10">
        <div className={`grid gap-8 sm:grid-cols-2 ${hasHours ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
          {/* Column 1: Brand */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {store.logo_url ? (
                <img src={optimizeImageUrl(store.logo_url, 160, 80)} alt={store.name} width={160} height={56} className="h-14 w-auto max-w-[160px] object-contain" loading="lazy" decoding="async" />
              ) : (
                <StoreTextLogo storeName={store.name} size="text-lg" color="inherit" />
              )}
            </div>
            {store.description && (
              <p className="text-sm leading-relaxed opacity-80 line-clamp-3">
                {store.description}
              </p>
            )}
            {/* Social icons row */}
            <div className="flex items-center gap-3 pt-1">
              {store.whatsapp_number && (
                <a
                  href={`https://wa.me/${encodeURIComponent(store.whatsapp_number.replace(/[^0-9+]/g, ""))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-full transition-all hover:scale-110"
                  style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
                  aria-label="WhatsApp"
                >
                  <MessageCircle className="h-4 w-4" />
                </a>
              )}
              {store.instagram_url && (
                <a
                  href={store.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-full transition-all hover:scale-110"
                  style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
                  aria-label="Instagram"
                >
                  <Instagram className="h-4 w-4" />
                </a>
              )}
              {store.facebook_url && (
                <a
                  href={store.facebook_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-full transition-all hover:scale-110"
                  style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
                  aria-label="Facebook"
                >
                  <Facebook className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider">Quick Links</h3>
            <nav className="flex flex-col gap-2.5">
              {[
                { to: storefrontPath(store.slug), label: "Home" },
                { to: storefrontPath(store.slug, "about"), label: "About Us" },
                { to: storefrontPath(store.slug, "contact"), label: "Contact Us" },
                { to: storefrontPath(store.slug, "return-policy"), label: "Return, Refund & Cancellation" },
                { to: storefrontPath(store.slug, "shipping-policy"), label: "Shipping Policy" },
                { to: storefrontPath(store.slug, "terms"), label: "Terms & Conditions" },
                { to: storefrontPath(store.slug, "privacy-policy"), label: "Privacy Policy" },
              ].map((link) => (
                <Link
                  key={link.label}
                  to={link.to}
                  className="text-[13px] sm:text-sm opacity-75 transition-opacity hover:opacity-100"
                  style={{ color: "inherit" }}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Column 3: Business Hours */}
          {hasHours && (
            <div className="space-y-3">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wider">
                <Clock className="h-3.5 w-3.5" /> Business Hours
              </h3>
              <div className="space-y-1">
                {Object.entries(hours!).map(([day, time]) =>
                  time?.trim() ? (
                    <div key={day} className="flex justify-between text-sm">
                      <span className="capitalize opacity-75">{day}</span>
                      <span>{time}</span>
                    </div>
                  ) : null
                )}
              </div>
            </div>
          )}

          {/* Column: Contact & Address */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider">Contact</h3>
            <div className="space-y-2.5">
              {address && (
                <p className="flex items-start gap-2 text-sm opacity-75">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {address}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Bottom bar with payment icons */}
        <div className="mt-8 border-t pt-6 pb-24 sm:pb-6 space-y-4" style={{ borderColor: "currentcolor", borderTopWidth: "1px", opacity: 1 }}>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs opacity-60">
              © {year} {store.name}. All rights reserved.
            </p>
            <PaymentIcons />
          </div>
          <p className="text-xs opacity-50 flex items-center justify-center gap-1">
            Powered by{" "}
            <a
              href="https://shopbanao.in"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 underline hover:opacity-100 transition-opacity"
              style={{ color: "inherit" }}
            >
              <img src={shopbanaoLogo} alt="ShopBanao" className="h-5 w-auto inline-block" loading="lazy" />
              ShopBanao
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
