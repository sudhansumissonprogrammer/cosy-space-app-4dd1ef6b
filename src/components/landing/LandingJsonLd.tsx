import { useEffect } from "react";

const LANDING_LD_ID = "landing-json-ld";

const LandingJsonLd = () => {
  useEffect(() => {
    const schemas = [
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "ShopBanao",
        url: "https://shopbanao.in",
        logo: "https://shopbanao.in/pwa-192x192.png",
        sameAs: [
          "https://instagram.com/shopbanao.in",
        ],
        contactPoint: {
          "@type": "ContactPoint",
          telephone: "+91-9692282485",
          contactType: "customer service",
          availableLanguage: ["English", "Hindi"],
        },
        description:
          "ShopBanao is India's complete commerce OS — store, WhatsApp, logistics, AI calling and checkout in one platform. ₹0 subscription, a flat 3% on every sale.",
      },
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "ShopBanao",
        url: "https://shopbanao.in",
        potentialAction: {
          "@type": "SearchAction",
          target: "https://shopbanao.in/?q={search_term_string}",
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "ShopBanao",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: "https://shopbanao.in",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "INR",
          description: "₹0 subscription. Flat 3% platform fee on every sale.",
        },
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: "4.8",
          ratingCount: "520",
          bestRating: "5",
          worstRating: "1",
        },
        description:
          "Complete commerce OS for Indian D2C brands. Storefront, WhatsApp, logistics, AI calling and checkout — one platform, a flat 3% on every sale.",
      },
    ];

    let el = document.getElementById(LANDING_LD_ID) as HTMLScriptElement | null;
    if (!el) {
      el = document.createElement("script");
      el.id = LANDING_LD_ID;
      el.type = "application/ld+json";
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(schemas);

    return () => {
      const node = document.getElementById(LANDING_LD_ID);
      if (node) node.remove();
    };
  }, []);

  return null;
};

export default LandingJsonLd;
