import { useEffect } from "react";
import { getStoreBaseUrl } from "@/lib/storeUrl";

const SCRIPT_ID = "json-ld-structured-data";
const BREADCRUMB_SCRIPT_ID = "json-ld-breadcrumb";
const ITEM_LIST_SCRIPT_ID = "json-ld-item-list";

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
  customDomain?: string | null;
  /** Real review data — omit aggregateRating if empty */
  reviews?: { rating: number }[];
}

export function useProductJsonLd({ product, storeSlug, storeName, customDomain, reviews }: ProductJsonLdOptions) {
  useEffect(() => {
    const baseUrl = getStoreBaseUrl(storeSlug, customDomain);
    const productUrl = `${baseUrl}/product/${product.slug || product.id}`;
    const price = product.sale_price && product.sale_price < product.price
      ? product.sale_price
      : product.price;

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
    };

    // Only add aggregateRating if we have real reviews
    if (reviews && reviews.length > 0) {
      const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
      data.aggregateRating = {
        "@type": "AggregateRating",
        ratingValue: avg.toFixed(1),
        reviewCount: reviews.length,
        bestRating: "5",
        worstRating: "1",
      };
    }

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
  }, [product, storeSlug, storeName, customDomain, reviews]);
}

interface StoreJsonLdOptions {
  storeName: string;
  storeSlug: string;
  description?: string | null;
  logo?: string | null;
  location?: string | null;
  whatsappNumber?: string | null;
  customDomain?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  city?: string | null;
  state?: string | null;
  businessHours?: any | null;
}

export function useStoreJsonLd({
  storeName, storeSlug, description, logo, location, whatsappNumber, customDomain,
  instagramUrl, facebookUrl, city, state, businessHours,
}: StoreJsonLdOptions) {
  useEffect(() => {
    const baseUrl = getStoreBaseUrl(storeSlug, customDomain);
    const data: Record<string, any> = {
      "@context": "https://schema.org",
      "@type": "Store",
      name: storeName,
      url: baseUrl,
    };
    if (description) data.description = description;
    if (logo) data.logo = logo;

    // Address
    if (city || state || location) {
      data.address = {
        "@type": "PostalAddress",
        ...(city && { addressLocality: city }),
        ...(state && { addressRegion: state }),
        ...(location && { streetAddress: location }),
        addressCountry: "IN",
      };
    }

    if (whatsappNumber) {
      data.contactPoint = {
        "@type": "ContactPoint",
        telephone: whatsappNumber,
        contactType: "customer service",
      };
    }

    // sameAs social links
    const sameAs: string[] = [];
    if (instagramUrl) sameAs.push(instagramUrl);
    if (facebookUrl) sameAs.push(facebookUrl);
    if (sameAs.length > 0) data.sameAs = sameAs;

    // Search action
    data.potentialAction = {
      "@type": "SearchAction",
      target: `${baseUrl}/shop?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    };

    data.priceRange = "₹";

    setJsonLd(data);
    return () => removeJsonLd();
  }, [storeName, storeSlug, description, logo, location, whatsappNumber, customDomain, instagramUrl, facebookUrl, city, state, businessHours]);
}

/** ItemList schema for product listing pages (Shop All, Category, Home) */
interface ProductListJsonLdOptions {
  products: { id: string; name: string; slug?: string | null; image_url?: string | null; price: number; sale_price?: number | null; currency?: string }[];
  storeSlug: string;
  listName?: string;
  customDomain?: string | null;
}

export function useProductListJsonLd({ products, storeSlug, listName, customDomain }: ProductListJsonLdOptions) {
  useEffect(() => {
    if (!products || products.length === 0) {
      removeJsonLd(ITEM_LIST_SCRIPT_ID);
      return;
    }
    const baseUrl = getStoreBaseUrl(storeSlug, customDomain);
    const data: Record<string, any> = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: listName || "Products",
      numberOfItems: products.length,
      itemListElement: products.slice(0, 30).map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${baseUrl}/product/${p.slug || p.id}`,
        name: p.name,
        image: p.image_url || undefined,
      })),
    };
    setJsonLd(data, ITEM_LIST_SCRIPT_ID);
    return () => removeJsonLd(ITEM_LIST_SCRIPT_ID);
  }, [products, storeSlug, listName, customDomain]);
}
