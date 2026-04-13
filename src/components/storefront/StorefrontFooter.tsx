import { Link } from "react-router-dom";
import { MapPin, Clock, MessageCircle, Instagram, Facebook } from "lucide-react";
import shopbanaoLogo from "@/assets/shopbanao-logo.png";
import StoreTextLogo from "@/components/storefront/StoreTextLogo";
import type { StoreData } from "@/layouts/StorefrontLayout";
import { storefrontPath } from "@/lib/subdomain";
import { optimizeImageUrl } from "@/lib/imageOptimize";

interface StorefrontFooterProps {
  store: StoreData;
}

export default function StorefrontFooter({ store }: StorefrontFooterProps) {
  const year = new Date().getFullYear();
  const hours = store.business_hours as Record<string, string> | null;
  const hasHours = hours && Object.values(hours).some((v) => v?.trim());
  const address = [store.location, store.city, store.state].filter(Boolean).join(", ");

  return (
    <footer
      className="mt-16 border-t"
      style={{
        backgroundColor: "var(--storefront-primary, #1a1a1a)",
        color: "var(--storefront-footer-text, #ffffff)",
      }}
    >
      <div className="mx-auto max-w-6xl lg:max-w-7xl px-4 py-10">
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
          </div>

          {/* Column 2: Quick Links */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider">Quick Links</h3>
            <nav className="flex flex-col gap-2">
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
                  className="text-sm opacity-75 transition-opacity hover:opacity-100"
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

          {/* Column 4: Contact & Address */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider">Contact</h3>
            <div className="space-y-2.5">
              {address && (
                <p className="flex items-start gap-2 text-sm opacity-75">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {address}
                </p>
              )}
              {store.whatsapp_number && (
                <a
                  href={`https://wa.me/${encodeURIComponent(store.whatsapp_number.replace(/[^0-9+]/g, ""))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm opacity-75 transition-opacity hover:opacity-100"
                  style={{ color: "inherit" }}
                >
                  <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                </a>
              )}
              {store.instagram_url && (
                <a
                  href={store.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm opacity-75 transition-opacity hover:opacity-100"
                  style={{ color: "inherit" }}
                >
                  <Instagram className="h-3.5 w-3.5" /> Instagram
                </a>
              )}
              {store.facebook_url && (
                <a
                  href={store.facebook_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm opacity-75 transition-opacity hover:opacity-100"
                  style={{ color: "inherit" }}
                >
                  <Facebook className="h-3.5 w-3.5" /> Facebook
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 border-t pt-6 pb-20 sm:pb-6 text-center space-y-2" style={{ borderColor: "currentcolor", borderTopWidth: "1px", opacity: 1 }}>
          <p className="text-xs opacity-60">
            © {year} {store.name}. All rights reserved.
          </p>
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
