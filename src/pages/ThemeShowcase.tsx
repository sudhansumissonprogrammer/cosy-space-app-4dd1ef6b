import Navbar from "@/components/landing/Navbar";
import { lazy, Suspense } from "react";
import { ExternalLink } from "lucide-react";

import overlaysDesktop from "@/assets/theme-previews/overlays-desktop.png";
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
    desktopImg: overlaysDesktop,
    mobileImg: overlaysMobile,
    liveUrl: "https://overlays.shopbanao.in",
    price: "Free",
  },
  {
    name: "Dark Streetwear",
    badge: "Most Liked",
    badgeColor: "bg-emerald-600 text-white",
    category: "Fashion & Apparel",
    desktopImg: stylebazaarTablet,
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

        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10">
          {THEMES.map((theme) => (
            <div
              key={theme.name}
              className="relative rounded-2xl border border-border overflow-hidden bg-background hover:shadow-xl transition-all"
            >
              {/* Badge — diagonal ribbon style */}
              <div className={`absolute top-0 left-0 z-10 ${theme.badgeColor} shadow-md`}
                   style={{
                     padding: "6px 40px",
                     fontSize: "11px",
                     fontWeight: 800,
                     letterSpacing: "0.08em",
                     textTransform: "uppercase",
                     transform: "rotate(-45deg) translate(-28%, -40%)",
                     transformOrigin: "center center",
                   }}>
                {theme.badge}
              </div>

              {/* Preview Area — desktop + mobile frames */}
              <div className="relative bg-muted/10 px-6 pt-8 pb-6" style={{ minHeight: "560px" }}>
                {/* Desktop Frame (main large preview) */}
                <div className="relative w-[85%]">
                  <div className="rounded-lg overflow-hidden border-2 border-gray-300 dark:border-gray-600 shadow-lg">
                    <img
                      src={theme.desktopImg}
                      alt={`${theme.name} desktop preview`}
                      className="w-full h-auto"
                      loading="lazy"
                    />
                  </div>
                </div>

                {/* Mobile Frame (overlapping on right) */}
                <div className="absolute bottom-5 right-4 w-[38%] max-w-[180px]">
                  <div className="rounded-[20px] p-[3px] shadow-2xl" style={{ backgroundColor: "#1a1a1a" }}>
                    <div className="relative">
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-[7px] rounded-b-lg z-10" style={{ backgroundColor: "#1a1a1a" }} />
                      <div className="rounded-[17px] overflow-hidden">
                        <img
                          src={theme.mobileImg}
                          alt={`${theme.name} mobile preview`}
                          className="w-full h-auto object-cover object-top"
                          loading="lazy"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Info Section */}
              <div className="p-5 pt-4 border-t border-border">
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground mb-2 border border-border">
                  {theme.category}
                </span>

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold">{theme.name}</h3>
                    <p className="text-sm text-muted-foreground">{theme.price}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={theme.liveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-medium rounded-full border border-border hover:bg-muted transition-colors"
                    >
                      Preview
                    </a>
                    <a
                      href={theme.liveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-medium rounded-full bg-foreground text-background hover:opacity-90 transition-colors"
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
