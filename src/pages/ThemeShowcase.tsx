import Navbar from "@/components/landing/Navbar";
import { lazy, Suspense } from "react";
import { ExternalLink } from "lucide-react";

import overlaysDesktop from "@/assets/theme-previews/overlays-desktop.png";
import overlaysMobile from "@/assets/theme-previews/overlays-mobile.png";
import stylebazaarDesktop from "@/assets/theme-previews/stylebazaar-desktop.png";
import stylebazaarMobile from "@/assets/theme-previews/stylebazaar-mobile.png";

const Footer = lazy(() => import("@/components/landing/Footer"));

const THEMES = [
  {
    name: "Streetwear",
    badge: "Premium",
    badgeColor: "bg-amber-500 text-white",
    desktopImg: overlaysDesktop,
    mobileImg: overlaysMobile,
    liveUrl: "https://overlays.shopbanao.in",
  },
  {
    name: "Dark Streetwear",
    badge: "Most Liked",
    badgeColor: "bg-emerald-600 text-white",
    desktopImg: stylebazaarDesktop,
    mobileImg: stylebazaarMobile,
    liveUrl: "https://stylebazaar.shopbanao.in",
  },
];

export default function ThemeShowcase() {
  return (
    <div className="min-h-screen bg-background font-outfit">
      <Navbar />

      <section className="pt-28 pb-16 px-4">
        <div className="max-w-5xl mx-auto text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3">
            Beautiful Store Themes
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto">
            Premium, conversion-optimized templates for your online store. See them live below.
          </p>
        </div>

        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
          {THEMES.map((theme) => (
            <div
              key={theme.name}
              className="relative rounded-2xl border-2 border-border overflow-hidden group hover:shadow-xl transition-all"
            >
              {/* Badge */}
              <div className={`absolute top-3 left-3 z-10 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${theme.badgeColor} shadow-md`}>
                {theme.badge}
              </div>

              {/* Desktop + Mobile Frame Area */}
              <div className="relative bg-muted/30 p-4 sm:p-6 pb-2 flex items-end justify-center gap-3 min-h-[260px] sm:min-h-[320px]">
                {/* Desktop Frame */}
                <div className="relative flex-1 max-w-[75%]">
                  <div className="bg-gray-200 dark:bg-gray-700 rounded-t-lg px-3 py-1.5 flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-red-400" />
                    <div className="w-2 h-2 rounded-full bg-yellow-400" />
                    <div className="w-2 h-2 rounded-full bg-green-400" />
                    <div className="ml-2 flex-1 bg-white dark:bg-gray-600 rounded h-3.5 max-w-[60%]" />
                  </div>
                  <div className="overflow-hidden rounded-b-lg border border-t-0 border-gray-200 dark:border-gray-600">
                    <img
                      src={theme.desktopImg}
                      alt={`${theme.name} desktop preview`}
                      className="w-full h-auto object-cover object-top"
                      loading="lazy"
                      style={{ maxHeight: "240px" }}
                    />
                  </div>
                </div>

                {/* Mobile Frame */}
                <div className="relative w-[22%] min-w-[70px] max-w-[100px] flex-shrink-0 self-start mt-4">
                  <div className="bg-gray-800 dark:bg-gray-900 rounded-t-xl pt-1.5 px-1.5">
                    <div className="mx-auto w-8 h-1 bg-gray-600 rounded-full mb-1" />
                  </div>
                  <div className="overflow-hidden border-x-2 border-b-2 border-gray-800 dark:border-gray-900 rounded-b-xl bg-white">
                    <img
                      src={theme.mobileImg}
                      alt={`${theme.name} mobile preview`}
                      className="w-full h-auto object-cover object-top"
                      loading="lazy"
                      style={{ maxHeight: "200px" }}
                    />
                  </div>
                </div>
              </div>

              {/* Theme Name & Live Link */}
              <div className="p-4 flex items-center justify-between bg-background">
                <h3 className="text-base font-bold">{theme.name}</h3>
                <a
                  href={theme.liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  View Live <ExternalLink className="h-3.5 w-3.5" />
                </a>
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
