import { Link } from "react-router-dom";
import { MapPin, Clock, MessageCircle, Instagram, Facebook } from "lucide-react";
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
    <footer className="mt-16 border-t" style={{ backgroundColor: "var(--storefront-accent, hsl(var(--card)))", color: "#ffffff" }}>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Column 1: Brand */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {store.logo_url ? (
                <img src={optimizeImageUrl(store.logo_url, 120, 80)} alt={store.name} width={120} height={40} className="h-10 w-auto max-w-[120px] object-contain" loading="lazy" decoding="async" />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20">
                  <Store className="h-4 w-4 text-white" />
                </div>
              )}
              {!store.logo_url && (
                <span className="text-lg font-bold text-white">{store.name}</span>
              )}
            </div>
            {store.description && (
              <p className="text-sm leading-relaxed text-white/90 line-clamp-3">
                {store.description}
              </p>
            )}
          </div>

          {/* Column 2: Quick Links */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white">Quick Links</h3>
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
                  className="text-sm text-white/80 transition-colors hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Column 3: Business Hours */}
          {hasHours && (
            <div className="space-y-3">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wider text-white">
                <Clock className="h-3.5 w-3.5" /> Business Hours
              </h3>
              <div className="space-y-1">
                {Object.entries(hours!).map(([day, time]) =>
                  time?.trim() ? (
                    <div key={day} className="flex justify-between text-sm">
                      <span className="capitalize text-white/80">{day}</span>
                      <span className="text-white">{time}</span>
                    </div>
                  ) : null
                )}
              </div>
            </div>
          )}

          {/* Column 4: Contact & Address */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white">Contact</h3>
            <div className="space-y-2.5">
              {address && (
                <p className="flex items-start gap-2 text-sm text-white/80">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {address}
                </p>
              )}
              {store.whatsapp_number && (
                <a
                  href={`https://wa.me/${encodeURIComponent(store.whatsapp_number.replace(/[^0-9+]/g, ""))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-white/80 transition-colors hover:text-white"
                >
                  <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                </a>
              )}
              {store.instagram_url && (
                <a
                  href={store.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-white/80 transition-colors hover:text-white"
                >
                  <Instagram className="h-3.5 w-3.5" /> Instagram
                </a>
              )}
              {store.facebook_url && (
                <a
                  href={store.facebook_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-white/80 transition-colors hover:text-white"
                >
                  <Facebook className="h-3.5 w-3.5" /> Facebook
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 border-t border-white/20 pt-6 text-center">
          <p className="text-xs text-white/70">
            © {year} {store.name}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
