import Navbar from "@/components/landing/Navbar";
import { lazy, Suspense } from "react";
import { ExternalLink } from "lucide-react";

import overlaysTablet from "@/assets/theme-previews/overlays-tablet.png";
import overlaysMobile from "@/assets/theme-previews/overlays-mobile.png";
import stylebazaarTablet from "@/assets/theme-previews/stylebazaar-tablet.png";
import stylebazaarMobile from "@/assets/theme-previews/stylebazaar-mobile.png";
import serdiyaTablet from "@/assets/theme-previews/serdiya-tablet.webp";
import serdiyaMobile from "@/assets/theme-previews/serdiya-mobile.webp";
import arrokTablet from "@/assets/theme-previews/arrok-tablet.webp";
import arrokMobile from "@/assets/theme-previews/arrok-mobile.webp";
import medivaTablet from "@/assets/theme-previews/mediva-tablet.webp";
import medivaMobile from "@/assets/theme-previews/mediva-mobile.webp";
import auroraTablet from "@/assets/theme-previews/aurora-tablet.webp";
import auroraMobile from "@/assets/theme-previews/aurora-mobile.webp";
import homedecorTablet from "@/assets/theme-previews/homedecor-tablet.png";
import homedecorMobile from "@/assets/theme-previews/homedecor-mobile.png";

import sanskritiPreview from "@/assets/theme-previews/sanskriti-preview.png";
import thunderRushPreview from "@/assets/theme-previews/thunder-rush-preview.png";
import vividauraPreview from "@/assets/theme-previews/vividaura-preview.png";
import goldenAuraPreview from "@/assets/theme-previews/golden-aura-preview.png";

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
  {
    name: "Serdiya Jewellers",
    badge: "Live Store",
    badgeColor: "bg-purple-600 text-white",
    category: "Jewellery",
    tabletImg: serdiyaTablet,
    mobileImg: serdiyaMobile,
    liveUrl: "https://serdiyajewellers.shop",
    price: "Free",
  },
  {
    name: "Arrok",
    badge: "Live Store",
    badgeColor: "bg-teal-600 text-white",
    category: "Ethnic Fashion",
    tabletImg: arrokTablet,
    mobileImg: arrokMobile,
    liveUrl: "https://arrok.shopbanao.in",
    price: "Free",
  },
  {
    name: "Mediva",
    badge: "Live Store",
    badgeColor: "bg-blue-600 text-white",
    category: "Health & Wellness",
    tabletImg: medivaTablet,
    mobileImg: medivaMobile,
    liveUrl: "https://mediva.shopbanao.in",
    price: "Free",
  },
  {
    name: "Aurora",
    badge: "Live Store",
    badgeColor: "bg-indigo-600 text-white",
    category: "Electronics & Gadgets",
    tabletImg: auroraTablet,
    mobileImg: auroraMobile,
    liveUrl: "https://aurora.shopbanao.in",
    price: "Free",
  },
];

const COMING_SOON = [
  { name: "Sanskriti", category: "Ethnic & Saree", img: sanskritiPreview },
  { name: "PeakBlitz", category: "Food & Beverages", img: thunderRushPreview },
  { name: "FlexiHerb", category: "Hair & Beauty", img: vividauraPreview },
  { name: "BraviaLove", category: "Luxury Perfumes", img: goldenAuraPreview },
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
              <div className={`absolute top-0 left-0 z-10 ${theme.badgeColor} shadow-md`}
                   style={{
                     padding: "4px 32px",
                     fontSize: "10px",
                     fontWeight: 800,
                     letterSpacing: "0.08em",
                     textTransform: "uppercase",
                     transform: "rotate(-45deg) translate(-28%, -40%)",
                     transformOrigin: "center center",
                   }}>
                {theme.badge}
              </div>

              <div className="relative bg-muted/10 px-5 pt-6 pb-5 min-h-[520px] flex items-end justify-center">
                <div className="relative w-[88%]">
                  <div className="rounded-lg overflow-hidden border-2 border-gray-300 dark:border-gray-600 shadow-lg bg-white dark:bg-gray-800">
                    <img
                      src={theme.tabletImg}
                      alt={`${theme.name} tablet preview`}
                      className="w-full h-auto object-cover object-top"
                      loading="lazy"
                    />
                  </div>
                </div>

                <div className="absolute bottom-4 right-3 w-[34%] max-w-[160px]">
                  <div className="bg-gray-900 rounded-[18px] p-[3px] shadow-2xl">
                    <div className="relative">
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-14 h-[7px] bg-gray-900 rounded-b-lg z-10" />
                      <div className="rounded-[15px] overflow-hidden bg-white">
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

              <div className="p-4 pt-3 border-t border-border">
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground mb-2 border border-border">
                  {theme.category}
                </span>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold">{theme.name}</h3>
                    <p className="text-sm text-muted-foreground">{theme.price}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <a href={theme.liveUrl} target="_blank" rel="noopener noreferrer"
                       className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-full border border-border hover:bg-muted transition-colors">
                      Preview
                    </a>
                    <a href={theme.liveUrl} target="_blank" rel="noopener noreferrer"
                       className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-full bg-foreground text-background hover:opacity-90 transition-colors">
                      View Live <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Coming Soon Strip */}
      <section className="pb-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <span className="inline-block px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest bg-amber-500/10 text-amber-600 border border-amber-500/30 mb-3">
              Coming Soon
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              More Themes on the Way
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base mt-2 max-w-md mx-auto">
              Stunning new templates launching soon. Stay tuned!
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {COMING_SOON.map((t) => (
              <div key={t.name} className="relative rounded-2xl border border-border overflow-hidden bg-background group">
                <div className="absolute top-0 left-0 z-10 bg-amber-500 text-white shadow-md"
                     style={{
                       padding: "4px 32px",
                       fontSize: "10px",
                       fontWeight: 800,
                       letterSpacing: "0.08em",
                       textTransform: "uppercase",
                       transform: "rotate(-45deg) translate(-28%, -40%)",
                       transformOrigin: "center center",
                     }}>
                  Soon
                </div>
                <div className="relative overflow-hidden">
                  <img
                    src={t.img}
                    alt={`${t.name} theme preview`}
                    className="w-full h-auto object-cover object-top group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-foreground/5 group-hover:bg-foreground/0 transition-colors" />
                </div>
                <div className="p-3 border-t border-border">
                  <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground mb-1.5 border border-border">
                    {t.category}
                  </span>
                  <h3 className="text-sm font-bold">{t.name}</h3>
                  <p className="text-xs text-muted-foreground">Coming Soon</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </div>
  );
}
