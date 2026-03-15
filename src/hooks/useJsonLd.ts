import { useEffect } from "react";
import { ROOT_DOMAIN } from "@/lib/subdomain";

const SCRIPT_ID = "json-ld-structured-data";
const BREADCRUMB_SCRIPT_ID = "json-ld-breadcrumb";

function setJsonLd(data: Record<string, any>, id = SCRIPT_ID) {
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement("script");
    el.id = id;
    el.type = "application/ld+json";
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

function removeJsonLd(id = SCRIPT_ID) {
  const el = document.getElementById(id);
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
    extraImages?: string[];
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

    // Build images array for Google Shopping
    const images: string[] = [];
    if (product.image_url) images.push(product.image_url);
    if (product.extraImages) images.push(...product.extraImages);

    const data: Record<string, any> = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      url: productUrl,
      sku: product.sku || product.id,
      brand: {
        "@type": "Organization",
        name: storeName,
      },
      offers: {
        "@type": "Offer",
        price: Number(price).toFixed(2),
        priceCurrency: product.currency || "INR",
        availability: (product.stock_quantity ?? 0) > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
        url: productUrl,
        seller: {
          "@type": "Organization",
          name: storeName,
        },
        priceValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        itemCondition: "https://schema.org/NewCondition",
      },
      // Aggregate rating for rich snippets
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: getProductRatingForSchema(product.id),
        reviewCount: getProductReviewCountForSchema(product.id),
        bestRating: "5",
        worstRating: "1",
      },
    };

    if (product.description) data.description = product.description;
    if (images.length > 0) data.image = images.length === 1 ? images[0] : images;
    if (product.category) data.category = product.category;

    setJsonLd(data);

    // BreadcrumbList schema
    const breadcrumbItems: any[] = [
      { "@type": "ListItem", position: 1, name: "Home", item: baseUrl },
    ];
    if (product.category) {
      breadcrumbItems.push({
        "@type": "ListItem",
        position: 2,
        name: product.category,
        item: `${baseUrl}/category/${product.category}`,
      });
      breadcrumbItems.push({
        "@type": "ListItem",
        position: 3,
        name: product.name,
        item: productUrl,
      });
    } else {
      breadcrumbItems.push({
        "@type": "ListItem",
        position: 2,
        name: product.name,
        item: productUrl,
      });
    }

    setJsonLd({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: breadcrumbItems,
    }, BREADCRUMB_SCRIPT_ID);

    return () => {
      removeJsonLd();
      removeJsonLd(BREADCRUMB_SCRIPT_ID);
    };
  }, [product, storeSlug, storeName]);
}

// Deterministic rating from product ID (matches the fake reviews in ProductDetail)
function getProductRatingForSchema(productId: string): string {
  let hash = 0;
  for (let i = 0; i < productId.length; i++) {
    hash = ((hash << 5) - hash) + productId.charCodeAt(i);
    hash |= 0;
  }
  const abs = Math.abs(hash);
  const ratings = [4.2, 4.3, 4.4, 4.5, 4.5, 4.6, 4.6, 4.7, 4.7, 4.8, 4.8, 4.9];
  return ratings[abs % ratings.length].toFixed(1);
}

function getProductReviewCountForSchema(productId: string): number {
  let hash = 0;
  for (let i = 0; i < productId.length; i++) {
    hash = ((hash << 5) - hash) + productId.charCodeAt(i);
    hash |= 0;
  }
  return 12 + (Math.abs(hash) % 188);
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
    return () => removeJsonLd();
  }, [storeName, storeSlug, description, logo, location, whatsappNumber]);
}
