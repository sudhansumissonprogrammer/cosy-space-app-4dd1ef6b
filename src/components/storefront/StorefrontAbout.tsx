import { MapPin, Clock, MessageCircle, Instagram, Facebook } from "lucide-react";
import type { StoreData } from "@/layouts/StorefrontLayout";

interface StorefrontAboutProps {
  store: StoreData;
  productCount: number;
}

export default function StorefrontAbout({ store, productCount }: StorefrontAboutProps) {
  return (
    <section className="mt-16 border-t pt-10" style={{ borderColor: "var(--storefront-text, hsl(var(--foreground)))12" }}>
      <h2 className="mb-4 text-xl font-bold" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>About {store.name}</h2>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          {store.description ? (
            <p className="leading-relaxed" style={{ color: "var(--storefront-text, hsl(var(--foreground)))80" }}>{store.description}</p>
          ) : (
            <p style={{ color: "var(--storefront-text, hsl(var(--foreground)))80" }}>Welcome to our store!</p>
          )}
        </div>
        <div className="space-y-3">
          {store.location && (
            <p className="flex items-center gap-2 text-sm" style={{ color: "var(--storefront-text, hsl(var(--foreground)))80" }}>
              <MapPin className="h-4 w-4" />
              {store.location}
            </p>
          )}
          {store.business_hours && (
            <div className="space-y-1">
              <p className="flex items-center gap-2 text-sm font-medium" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>
                <Clock className="h-4 w-4" /> Business Hours
              </p>
              {Object.entries(store.business_hours as Record<string, string>).map(([day, hours]) => (
                hours ? (
                  <p key={day} className="ml-6 text-sm" style={{ color: "var(--storefront-text, hsl(var(--foreground)))80" }}>
                    <span className="inline-block w-10 capitalize">{day}</span> {hours}
                  </p>
                ) : null
              ))}
            </div>
          )}
          {store.whatsapp_number && (
            <a
              href={`https://wa.me/${encodeURIComponent(store.whatsapp_number.replace(/[^0-9+]/g, ""))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm hover:underline"
              style={{ color: "var(--storefront-primary, hsl(var(--primary)))" }}
            >
              <MessageCircle className="h-4 w-4" />
              Contact us on WhatsApp
            </a>
          )}
          {store.instagram_url && (
            <a href={store.instagram_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm hover:opacity-70 transition-opacity" style={{ color: "var(--storefront-text, hsl(var(--foreground)))80" }}>
              <Instagram className="h-4 w-4" /> Instagram
            </a>
          )}
          {store.facebook_url && (
            <a href={store.facebook_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm hover:opacity-70 transition-opacity" style={{ color: "var(--storefront-text, hsl(var(--foreground)))80" }}>
              <Facebook className="h-4 w-4" /> Facebook
            </a>
          )}
          {productCount > 0 && (
            <p className="text-sm" style={{ color: "var(--storefront-text, hsl(var(--foreground)))80" }}>
              {productCount} product{productCount !== 1 ? "s" : ""} available
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
