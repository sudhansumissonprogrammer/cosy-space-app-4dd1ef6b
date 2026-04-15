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
          "ShopBanao is India's easiest platform to create your own online store — zero commission, WhatsApp ordering, and UPI payments built in.",
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
          description: "Free plan available — launch your store at zero cost",
        },
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: "4.8",
          ratingCount: "520",
          bestRating: "5",
          worstRating: "1",
        },
        description:
          "Create your online store in 10 minutes. Manage products, accept UPI payments, and take orders via WhatsApp — zero commission.",
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
