import { Instagram } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { storefrontPath } from "@/lib/subdomain";
import { cleanImageUrl } from "@/lib/imageOptimize";
import type { StoreData } from "@/layouts/StorefrontLayout";

interface StorefrontInstagramSectionProps {
  store: StoreData;
}

export default function StorefrontInstagramSection({ store }: StorefrontInstagramSectionProps) {
  const queryClient = useQueryClient();
  const products = queryClient.getQueryData<any[]>(["storefront-products", store.id]);

  // Only show if store has an Instagram URL
  if (!store.instagram_url) return null;

  // Get up to 7 product images (prefer products with images)
  const images = (products || [])
    .filter((p: any) => p.image_url && p.is_active)
    .slice(0, 7)
    .map((p: any) => ({
      id: p.id,
      url: cleanImageUrl(p.image_url),
      name: p.name,
      slug: p.slug,
    }));

  if (images.length < 3) return null;

  // Extract Instagram handle from URL
  const getHandle = (url: string) => {
    try {
      const match = url.match(/instagram\.com\/([^/?#]+)/);
      return match ? `@${match[1]}` : null;
    } catch {
      return null;
    }
  };

  const handle = getHandle(store.instagram_url);

  return (
    <section className="relative overflow-hidden">
      {/* Top decorative line */}
      <div
        className="h-[2px] w-full"
        style={{ background: "var(--storefront-marquee-gradient, linear-gradient(90deg, var(--storefront-primary, hsl(var(--primary))), var(--storefront-accent, hsl(var(--accent))), var(--storefront-primary, hsl(var(--primary)))))" }}
      />

      <div
        className="py-12 md:py-16"
        style={{
          backgroundColor: "var(--storefront-bg, hsl(var(--background)))",
          color: "var(--storefront-text, hsl(var(--foreground)))",
        }}
      >
        {/* Header */}
        <div className="mx-auto max-w-6xl px-4 text-center mb-8 md:mb-10">
          <a
            href={store.instagram_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 group"
          >
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl transition-transform group-hover:scale-110"
              style={{
                background: "linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
              }}
            >
              <Instagram className="h-5 w-5 text-white" />
            </div>
            <div className="text-left">
              <h2
                className="text-lg md:text-xl font-bold tracking-tight"
                style={{ fontFamily: "var(--storefront-heading-font, inherit)" }}
              >
                Follow Us on Instagram
              </h2>
              {handle && (
                <p className="text-xs md:text-sm opacity-60 group-hover:opacity-100 transition-opacity">
                  {handle}
                </p>
              )}
            </div>
          </a>
        </div>

        {/* Image Grid — full width, edge to edge */}
        <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-7 gap-[2px] md:gap-1">
          {images.map((img: any) => (
            <Link
              key={img.id}
              to={storefrontPath(store.slug, `product/${img.slug || img.id}`)}
              className="group relative aspect-square overflow-hidden bg-black/5"
            >
              <img
                src={img.url}
                alt={img.name}
                loading="lazy"
                className="h-full w-full object-cover transition-all duration-500 group-hover:scale-110 group-hover:brightness-75"
              />
              {/* Hover overlay */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-black shadow-lg backdrop-blur-sm">
                  <Instagram className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">View</span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* CTA Button */}
        <div className="mx-auto max-w-6xl px-4 mt-8 text-center">
          <a
            href={store.instagram_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg px-5 py-[7px] text-[14px] font-semibold transition-all duration-200 hover:opacity-90 active:scale-95"
            style={{
              background: "linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
              color: "#ffffff",
              borderRadius: "8px",
              letterSpacing: "0.01em",
            }}
          >
            Follow
          </a>
        </div>
      </div>
    </section>
  );
}
