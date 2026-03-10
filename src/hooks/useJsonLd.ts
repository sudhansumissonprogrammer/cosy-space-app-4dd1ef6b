import { useEffect } from "react";
import { ROOT_DOMAIN } from "@/lib/subdomain";

const SCRIPT_ID = "json-ld-structured-data";

function setJsonLd(data: Record<string, any>) {
  let el = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement("script");
    el.id = SCRIPT_ID;
    el.type = "application/ld+json";
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

function removeJsonLd() {
  const el = document.getElementById(SCRIPT_ID);
  if (el) el.remove();
}

interface ProductJsonLdOptions {
  product: {
    name: string;
    description?: string | null;
    image_url?: string | null;
    price: number;
    sale_price?: number | null;
    currency: string;
    slug?: string | null;
    id: string;
    category?: string | null;
    stock_quantity?: number;
    sku?: string | null;
  };
  storeSlug: string;
  storeName: string;
}

export function useProductJsonLd({ product, storeSlug, storeName }: ProductJsonLdOptions) {
  useEffect(() => {
    const baseUrl = `https://${storeSlug}.${ROOT_DOMAIN}`;
    const productUrl = `${baseUrl}/product/${product.slug || product.id}`;
    const price = product.sale_price && product.sale_price < product.price
      ? product.sale_price
      : product.price;

    const data: Record<string, any> = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      url: productUrl,
      sku: product.sku || product.id,
      offers: {
        "@type": "Offer",
        price: Number(price).toFixed(2),
        priceCurrency: product.currency || "INR",
        availability: (product.stock_quantity ?? 0) > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
        seller: {
          "@type": "Organization",
          name: storeName,
        },
      },
    };

    if (product.description) data.description = product.description;
    if (product.image_url) data.image = product.image_url;
    if (product.category) data.category = product.category;

    setJsonLd(data);
    return removeJsonLd;
  }, [product, storeSlug, storeName]);
}

interface StoreJsonLdOptions {
  storeName: string;
  storeSlug: string;
  description?: string | null;
  logo?: string | null;
  location?: string | null;
  whatsappNumber?: string | null;
}

export function useStoreJsonLd({ storeName, storeSlug, description, logo, location, whatsappNumber }: StoreJsonLdOptions) {
  useEffect(() => {
    const baseUrl = `https://${storeSlug}.${ROOT_DOMAIN}`;
    const data: Record<string, any> = {
      "@context": "https://schema.org",
      "@type": "Store",
      name: storeName,
      url: baseUrl,
    };
    if (description) data.description = description;
    if (logo) data.logo = logo;
    if (location) data.address = { "@type": "PostalAddress", addressLocality: location };
    if (whatsappNumber) {
      data.contactPoint = {
        "@type": "ContactPoint",
        telephone: whatsappNumber,
        contactType: "customer service",
      };
    }

    setJsonLd(data);
    return removeJsonLd;
  }, [storeName, storeSlug, description, logo, location, whatsappNumber]);
}
