import Navbar from "@/components/landing/Navbar";
import { lazy, Suspense } from "react";
import { ExternalLink } from "lucide-react";

import overlaysTablet from "@/assets/theme-previews/overlays-tablet.png";
import overlaysMobile from "@/assets/theme-previews/overlays-mobile.png";
import stylebazaarTablet from "@/assets/theme-previews/stylebazaar-tablet.png";
import stylebazaarMobile from "@/assets/theme-previews/stylebazaar-mobile.png";

const Footer = lazy(() => import("@/components/landing/Footer"));

const THEMES = [
  {
    name: "Streetwear",
    badge: "Premium",
    badgeColor: "bg-amber-500 text-white",
    category: "Fashion & Apparel",
    tabletImg: overlaysTablet,
    mobileImg: overlaysMobile,
    liveUrl: "https://overlays.shopbanao.in",
    price: "Free",
  },
  {
    name: "Dark Streetwear",
    badge: "Most Liked",
    badgeColor: "bg-emerald-600 text-white",
    category: "Fashion & Apparel",
    tabletImg: stylebazaarTablet,
    mobileImg: stylebazaarMobile,
    liveUrl: "https://stylebazaar.shopbanao.in",
    price: "Free",
  },
];

export default function ThemeShowcase() {
  return (
    <div className="min-h-screen bg-background font-outfit">
      <Navbar />

      <section className="pt-28 pb-16 px-4">
        <div className="max-w-6xl mx-auto text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3">
            Beautiful Store Themes
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto">
            Premium, conversion-optimized templates for your online store. See them live below.
          </p>
        </div>

        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {THEMES.map((theme) => (
            <div
              key={theme.name}
              className="relative rounded-2xl border border-border overflow-hidden bg-background hover:shadow-xl transition-all"
            >
              {/* Badge */}
              <div className={`absolute top-3 left-3 z-10 px-3 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wider ${theme.badgeColor} shadow-md`}
                   style={{ writingMode: "horizontal-tb" }}>
                {theme.badge}
              </div>

              {/* Preview Area — tablet + mobile frames */}
              <div className="relative bg-muted/20 p-5 pb-4 min-h-[420px] flex items-end justify-center">
                {/* Tablet Frame (main large preview) */}
                <div className="relative w-[82%]">
                  {/* Tablet bezel */}
                  <div className="rounded-lg overflow-hidden border-2 border-gray-300 dark:border-gray-600 shadow-lg bg-white dark:bg-gray-800">
                    <img
                      src={theme.tabletImg}
                      alt={`${theme.name} tablet preview`}
                      className="w-full h-auto object-cover object-top"
                      loading="lazy"
                      style={{ maxHeight: "380px" }}
                    />
                  </div>
                </div>

                {/* Mobile Frame (overlapping on right) */}
                <div className="absolute bottom-4 right-4 w-[30%] max-w-[120px]">
                  <div className="bg-gray-900 rounded-[16px] p-[3px] shadow-xl">
                    {/* Notch */}
                    <div className="relative">
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-[6px] bg-gray-900 rounded-b-lg z-10" />
                      <div className="rounded-[13px] overflow-hidden bg-white">
                        <img
                          src={theme.mobileImg}
                          alt={`${theme.name} mobile preview`}
                          className="w-full h-auto object-cover object-top"
                          loading="lazy"
                          style={{ maxHeight: "220px" }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Info Section */}
              <div className="p-4 pt-3 border-t border-border">
                {/* Category Badge */}
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground mb-2 border border-border">
                  {theme.category}
                </span>

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold">{theme.name}</h3>
                    <p className="text-sm text-muted-foreground">{theme.price}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={theme.liveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-full border border-border hover:bg-muted transition-colors"
                    >
                      Preview
                    </a>
                    <a
                      href={theme.liveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-full bg-foreground text-background hover:opacity-90 transition-colors"
                    >
                      View Live <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </div>
  );
}
