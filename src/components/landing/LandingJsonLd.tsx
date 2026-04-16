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
          "ShopBanao builds professional ecommerce websites for Indian businesses — custom domain, UPI payments, and everything included.",
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
        "@type": "Service",
        name: "ShopBanao — Ecommerce Website Development",
        serviceType: "Ecommerce Website Development",
        provider: {
          "@type": "Organization",
          name: "ShopBanao",
          url: "https://shopbanao.in",
        },
        areaServed: {
          "@type": "Country",
          name: "India",
        },
        offers: {
          "@type": "Offer",
          price: "10000",
          priceCurrency: "INR",
          description: "Complete ecommerce website built for your business — custom domain, payments, design, and launch included.",
        },
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: "4.8",
          ratingCount: "520",
          bestRating: "5",
          worstRating: "1",
        },
        description:
          "We build professional online stores for Indian businesses. Custom design, UPI & card payments, WhatsApp integration, and custom domain included.",
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
