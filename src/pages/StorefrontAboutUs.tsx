import { useOutletContext } from "react-router-dom";
import { MapPin, Instagram, Facebook, MessageCircle, Heart, Award, Leaf, Shield, Star, Sparkles, Truck, ThumbsUp } from "lucide-react";
import StoreTextLogo from "@/components/storefront/StoreTextLogo";
import type { StoreData } from "@/layouts/StorefrontLayout";
import { optimizeImageUrl } from "@/lib/imageOptimize";

const ICON_MAP: Record<string, React.ElementType> = {
  Award, Leaf, Shield, Star, Sparkles, Heart, Truck, ThumbsUp,
};

interface Feature {
  icon: string;
  title: string;
  description: string;
}

function DefaultAboutContent({ store }: { store: StoreData }) {
  const features: Feature[] = ((store as any).features as Feature[]) || [];
  const address = [store.location, (store as any).city, (store as any).state].filter(Boolean).join(", ");

  return (
    <div className="space-y-12">
      {/* Our Story */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">🏪 Our Story</h2>
        <div className="rounded-2xl border border-border bg-card p-6">
          {store.description ? (
            <p className="text-base leading-relaxed text-muted-foreground">{store.description}</p>
          ) : (
            <p className="text-base leading-relaxed text-muted-foreground">
              Welcome to <strong className="text-foreground">{store.name}</strong>! We are passionate about bringing you the best products with exceptional quality and service. Our commitment is to make your shopping experience seamless and enjoyable. 🛍️
            </p>
          )}
        </div>
      </section>

      {/* Where to Find Us */}
      {address && (
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground">📍 Where to Find Us</h2>
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Our Location</p>
                <p className="mt-1 text-muted-foreground">{address}</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Why Choose Us */}
      {features.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground">✨ Why Choose Us</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {features.map((feature, idx) => {
              const IconComponent = ICON_MAP[feature.icon] || Award;
              return (
                <div key={idx} className="group rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-md">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 transition-transform group-hover:scale-110">
                      <IconComponent className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground">{feature.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{feature.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Connect With Us */}
      {((store as any).whatsapp_number || (store as any).instagram_url || (store as any).facebook_url) && (
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground">📱 Connect With Us</h2>
          <div className="flex flex-wrap gap-3">
            {(store as any).whatsapp_number && (
              <a
                href={`https://wa.me/${(store as any).whatsapp_number.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 rounded-2xl border border-border bg-card px-5 py-3.5 text-sm font-medium text-foreground transition-all hover:border-green-500/30 hover:shadow-md"
              >
                <MessageCircle className="h-5 w-5 text-green-600" />
                WhatsApp
              </a>
            )}
            {(store as any).instagram_url && (
              <a
                href={(store as any).instagram_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 rounded-2xl border border-border bg-card px-5 py-3.5 text-sm font-medium text-foreground transition-all hover:border-pink-500/30 hover:shadow-md"
              >
                <Instagram className="h-5 w-5 text-pink-600" />
                Instagram
              </a>
            )}
            {(store as any).facebook_url && (
              <a
                href={(store as any).facebook_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 rounded-2xl border border-border bg-card px-5 py-3.5 text-sm font-medium text-foreground transition-all hover:border-blue-500/30 hover:shadow-md"
              >
                <Facebook className="h-5 w-5 text-blue-600" />
                Facebook
              </a>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

export default function StorefrontAboutUs() {
  const store = useOutletContext<StoreData>();
  const aboutUsText = (store as any).about_us_text as string | null;
  const aboutUsImage = (store as any).about_us_image_url as string | null;

  return (
    <div className="min-h-[70vh]">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-accent/30 to-background px-4 py-16 text-center">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.08),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,hsl(var(--accent)/0.15),transparent_50%)]" />
        <div className="relative mx-auto max-w-2xl">
          {store.logo_url ? (
            <img
              src={optimizeImageUrl(store.logo_url, 160, 80)}
              alt={store.name}
              className="mx-auto mb-4 h-16 w-auto max-w-[160px] object-contain"
              loading="eager"
            />
          ) : (
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 backdrop-blur-sm">
              <Store className="h-8 w-8 text-primary" />
            </div>
          )}
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            About {store.name}
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Get to know us and what makes us special ✨
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-4 py-12">
        {/* About Us Image */}
        {aboutUsImage && (
          <div className="mb-10 overflow-hidden rounded-2xl border border-border">
            <img
              src={optimizeImageUrl(aboutUsImage, 900)}
              alt={`About ${store.name}`}
              className="w-full object-cover"
              style={{ maxHeight: "400px" }}
              loading="eager"
            />
          </div>
        )}

        {/* Custom or Default content */}
        {aboutUsText?.trim() ? (
          <div className="prose prose-lg max-w-none text-muted-foreground">
            {aboutUsText.split("\n").map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        ) : (
          <DefaultAboutContent store={store} />
        )}
      </div>
    </div>
  );
}
