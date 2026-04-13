import { useOutletContext } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Instagram, Facebook, MessageCircle } from "lucide-react";
import { useMemo } from "react";
import StoreTextLogo from "@/components/storefront/StoreTextLogo";
import CustomHtmlRenderer from "@/components/storefront/CustomHtmlRenderer";
import type { StoreData } from "@/layouts/StorefrontLayout";
import { optimizeImageUrl } from "@/lib/imageOptimize";

/* ── Rich Text Renderer ─────────────────────────────────────────── */
const HEADING_PATTERNS = /^(about us|our mission|our story|why choose|our promise|contact us|our vision|what we do|who we are)/i;
const EMOJI_BULLET = /^[✨💎🚚💬🎯🌟⭐🛡️📦❤️🏆🔒💰👜🎁📧📞🏠]/u;

function RichTextRenderer({ text }: { text: string }) {
  const lines = text.split("\n").filter((l) => l.trim());

  return (
    <div className="space-y-4">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (HEADING_PATTERNS.test(trimmed)) {
          return (
            <h2 key={i} className="mt-8 text-2xl font-bold text-foreground">
              {trimmed}
            </h2>
          );
        }
        if (EMOJI_BULLET.test(trimmed)) {
          return (
            <p key={i} className="ml-2 text-base leading-relaxed text-muted-foreground">
              {trimmed}
            </p>
          );
        }
        return (
          <p key={i} className="text-base leading-relaxed text-muted-foreground">
            {trimmed}
          </p>
        );
      })}
    </div>
  );
}

/* ── Default About Content (fixed template + store variables) ──── */
function DefaultAboutContent({ store }: { store: StoreData }) {
  const storeName = store.name;
  const address = [store.location, (store as any).city, (store as any).state].filter(Boolean).join(", ");
  const whatsapp = (store as any).whatsapp_number as string | null;
  const instagram = (store as any).instagram_url as string | null;
  const facebook = (store as any).facebook_url as string | null;

  const { data: ownerEmail } = useQuery({
    queryKey: ["store-public-email", store.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_store_public_email", { _store_id: store.id });
      return (data as string) || null;
    },
    staleTime: 300000,
  });

  return (
    <div className="space-y-10">
      {/* Welcome */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">ABOUT US</h2>
        <div className="space-y-3 text-base leading-relaxed text-muted-foreground">
          <p>
            Welcome to <strong className="text-foreground">{storeName}</strong> — where quality meets passion.
          </p>
          {store.description ? (
            <p>{store.description}</p>
          ) : (
            <p>
              We are passionate about bringing you the best products with exceptional quality and service. Our commitment is to make your shopping experience seamless and enjoyable.
            </p>
          )}
          <p>
            At <strong className="text-foreground">{storeName}</strong>, we believe every product tells a story. Every item we offer is carefully selected for its quality, craftsmanship, and unique design, so you can shop with confidence and delight.
          </p>
        </div>
      </section>

      {/* Our Mission */}
      <section className="space-y-3">
        <h2 className="text-2xl font-bold text-foreground">Our Mission</h2>
        <p className="text-base leading-relaxed text-muted-foreground">
          To make premium-quality products accessible and affordable for everyone, blending traditional charm with contemporary style. We aim to bring the best to your doorstep with trusted service, authentic products, and an unmatched shopping experience.
        </p>
      </section>

      {/* Why Choose Us */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">Why Choose {storeName}?</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { emoji: "✨", title: "Authentic & Handpicked Products", desc: "Every item is sourced and selected with precision and care." },
            { emoji: "💎", title: "Quality You Can Trust", desc: "We prioritise durability, beauty, and attention to detail." },
            { emoji: "🚚", title: "Reliable Delivery", desc: "Fast and safe shipping so your order reaches you on time." },
            { emoji: "💬", title: "Customer Support", desc: "Our friendly team is always ready to assist you." },
          ].map((item) => (
            <div key={item.title} className="rounded-xl border border-border bg-card p-4 transition-all duration-200 hover:shadow-lg hover:-translate-y-1">
              <div className="text-2xl mb-2">{item.emoji}</div>
              <h3 className="text-sm font-bold text-foreground mb-1">{item.title}</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Our Promise */}
      <section className="space-y-3">
        <h2 className="text-2xl font-bold text-foreground">Our Promise</h2>
        <p className="text-base leading-relaxed text-muted-foreground">
          We promise to deliver products that reflect our dedication to quality, creativity, and trust. Your satisfaction is at the heart of everything we do — because at <strong className="text-foreground">{storeName}</strong>, you're not just a customer; you're part of our story.
        </p>
      </section>

      {/* Contact Us */}
      {(ownerEmail || whatsapp || address) && (
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground">Contact Us</h2>
          <div className="space-y-2 text-base text-muted-foreground">
            {ownerEmail && (
              <p>📧 <strong className="text-foreground">Email:</strong>{" "}
                <a href={`mailto:${ownerEmail}`} className="text-primary hover:underline">{ownerEmail}</a>
              </p>
            )}
            {whatsapp && (
              <p>📞 <strong className="text-foreground">Phone:</strong>{" "}
                <a href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{whatsapp}</a>
              </p>
            )}
            {address && (
              <p>🏠 <strong className="text-foreground">Address:</strong> {address}</p>
            )}
          </div>
        </section>
      )}

      {/* Social Links */}
      {(whatsapp || instagram || facebook) && (
        <section className="space-y-4">
          <p className="text-base text-muted-foreground">
            Follow us on social media and stay updated with our latest collections, offers, and trends.
          </p>
          <div className="flex flex-wrap gap-3">
            {whatsapp && (
              <a
                href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-all hover:border-green-500/30 hover:shadow-md"
              >
                <MessageCircle className="h-4 w-4 text-green-600" /> WhatsApp
              </a>
            )}
            {instagram && (
              <a
                href={instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-all hover:border-pink-500/30 hover:shadow-md"
              >
                <Instagram className="h-4 w-4 text-pink-600" /> Instagram
              </a>
            )}
            {facebook && (
              <a
                href={facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-all hover:border-blue-500/30 hover:shadow-md"
              >
                <Facebook className="h-4 w-4 text-blue-600" /> Facebook
              </a>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────────────────── */
export default function StorefrontAboutUs() {
  const store = useOutletContext<StoreData>();
  const aboutUsText = (store as any).about_us_text as string | null;
  const aboutUsImage = (store as any).about_us_image_url as string | null;

  const { data: aboutPage } = useQuery({
    queryKey: ["storefront-about-page-html", store.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("store_pages")
        .select("custom_html")
        .eq("store_id", store.id)
        .in("page_type", ["about_us", "about"])
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!store.id,
    staleTime: 5 * 60 * 1000,
  });

  const customHtml = (aboutPage as any)?.custom_html as string | null;

  if (customHtml?.trim()) {
    return <CustomHtmlRenderer html={customHtml} className="" />;
  }

  return (
    <div className="min-h-[70vh]">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-accent/30 to-background px-4 py-16 lg:py-24 text-center">
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
            <div className="mx-auto mb-4">
              <StoreTextLogo storeName={store.name} size="text-3xl" />
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
      <div className="mx-auto max-w-3xl lg:max-w-4xl px-4 py-12 lg:py-16">
        {/* About Us Image on top */}
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

        {/* If about_us_text exists → render with smart formatting, else → fixed template */}
        {aboutUsText?.trim() ? (
          <RichTextRenderer text={aboutUsText} />
        ) : (
          <DefaultAboutContent store={store} />
        )}
      </div>
    </div>
  );
}
