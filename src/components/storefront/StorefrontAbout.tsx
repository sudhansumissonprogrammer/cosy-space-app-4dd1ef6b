import { MapPin, Clock, MessageCircle, Instagram, Facebook } from "lucide-react";
import type { StoreData } from "@/layouts/StorefrontLayout";

interface StorefrontAboutProps {
  store: StoreData;
  productCount: number;
}

export default function StorefrontAbout({ store, productCount }: StorefrontAboutProps) {
  return (
    <section className="mt-16 border-t pt-10">
      <h2 className="mb-4 text-xl font-bold text-foreground">About {store.name}</h2>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          {store.description ? (
            <p className="leading-relaxed text-muted-foreground">{store.description}</p>
          ) : (
            <p className="text-muted-foreground">Welcome to our store!</p>
          )}
        </div>
        <div className="space-y-3">
          {store.location && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {store.location}
            </p>
          )}
          {store.business_hours && (
            <div className="space-y-1">
              <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Clock className="h-4 w-4" /> Business Hours
              </p>
              {Object.entries(store.business_hours as Record<string, string>).map(([day, hours]) => (
                hours ? (
                  <p key={day} className="ml-6 text-sm text-muted-foreground">
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
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <MessageCircle className="h-4 w-4" />
              Contact us on WhatsApp
            </a>
          )}
          {store.instagram_url && (
            <a href={store.instagram_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
              <Instagram className="h-4 w-4" /> Instagram
            </a>
          )}
          {store.facebook_url && (
            <a href={store.facebook_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
              <Facebook className="h-4 w-4" /> Facebook
            </a>
          )}
          {productCount > 0 && (
            <p className="text-sm text-muted-foreground">
              {productCount} product{productCount !== 1 ? "s" : ""} available
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
